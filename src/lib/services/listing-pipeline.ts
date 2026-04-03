import { analyzeImage } from "@/lib/ai/analyze";
import { generatePricing } from "@/lib/ai/price";
import { fetchComps } from "@/lib/comps/search-api";
import { removeBackground } from "@/lib/images/remove-bg";
import type { VisionAnalysis, PricingResult } from "@/lib/ai/schemas";
import type { CompResult } from "@/lib/comps/types";

export interface PipelineInput {
  /** Public URL of the primary image (already uploaded to Vercel Blob) */
  imageUrl: string;
  /** Listing ID (for organizing blob paths and DB records) */
  listingId: string;
  /** Additional image URLs (already uploaded) */
  additionalImageUrls?: string[];
}

export interface PipelineResult {
  analysis: VisionAnalysis;
  comps: CompResult;
  pricing: PricingResult;
  heroUrl: string | null;
  /** Whether AI flagged fields for seller review */
  needsReview: boolean;
  /** Fields that need seller review */
  reviewFields: string[];
  /** Processing time in ms */
  processingTimeMs: number;
}

export interface PipelineError {
  stage: "analysis" | "comps" | "pricing" | "bg_removal";
  error: string;
  recoverable: boolean;
}

/**
 * Run the full AI listing pipeline:
 * 1. Claude Haiku vision analysis (identify item)
 * 2. SearchAPI.io comp search (find sold prices) — parallel with bg removal
 * 3. Claude Haiku pricing (suggest price from comps)
 * 4. PixelAPI bg removal (hero image) — parallel with step 2-3
 *
 * Fallbacks at every stage ensure the pipeline never fully fails.
 */
export async function runListingPipeline(
  input: PipelineInput,
): Promise<{ result: PipelineResult; errors: PipelineError[] }> {
  const startTime = Date.now();
  const errors: PipelineError[] = [];

  // Step 1: AI Vision Analysis (required — no fallback)
  let analysis: VisionAnalysis;
  try {
    analysis = await analyzeImage(input.imageUrl);
  } catch (error) {
    // Vision is critical — can't proceed without it
    throw new Error(
      `AI analysis failed: ${(error as Error).message}. Manual entry required.`,
    );
  }

  // Step 2 & 4: Comps + BG removal in parallel
  const [compsResult, bgResult] = await Promise.allSettled([
    fetchCompsWithFallback(analysis.search_query, errors),
    removeBackgroundWithFallback(input.imageUrl, input.listingId, errors),
  ]);

  const comps: CompResult =
    compsResult.status === "fulfilled"
      ? compsResult.value
      : {
          items: [],
          avg_price_cents: 0,
          count: 0,
          source: "fallback",
          fetched_at: new Date().toISOString(),
        };

  const heroUrl: string | null =
    bgResult.status === "fulfilled" ? bgResult.value : null;

  // Step 3: AI Pricing (uses analysis + comps)
  let pricing: PricingResult;
  try {
    pricing = await generatePricing(analysis, comps);
  } catch (error) {
    errors.push({
      stage: "pricing",
      error: (error as Error).message,
      recoverable: true,
    });
    // Fallback: basic pricing from comp average
    pricing = buildFallbackPricing(comps);
  }

  const processingTimeMs = Date.now() - startTime;

  return {
    result: {
      analysis,
      comps,
      pricing,
      heroUrl,
      needsReview: analysis.flags.length > 0 || analysis.confidence < 0.7,
      reviewFields: analysis.flags,
      processingTimeMs,
    },
    errors,
  };
}

async function fetchCompsWithFallback(
  searchQuery: string,
  errors: PipelineError[],
): Promise<CompResult> {
  try {
    return await fetchComps(searchQuery);
  } catch (error) {
    errors.push({
      stage: "comps",
      error: (error as Error).message,
      recoverable: true,
    });
    return {
      items: [],
      avg_price_cents: 0,
      count: 0,
      source: "fallback",
      fetched_at: new Date().toISOString(),
    };
  }
}

async function removeBackgroundWithFallback(
  imageUrl: string,
  listingId: string,
  errors: PipelineError[],
): Promise<string | null> {
  try {
    const result = await removeBackground(imageUrl, listingId);
    return result?.hero_url ?? null;
  } catch (error) {
    errors.push({
      stage: "bg_removal",
      error: (error as Error).message,
      recoverable: true,
    });
    return null;
  }
}

function buildFallbackPricing(comps: CompResult): PricingResult {
  const suggestedPrice =
    comps.avg_price_cents > 0
      ? Math.round(comps.avg_price_cents * 0.45) // 45% of eBay avg for garage sale
      : 1000; // Default $10 if no comps

  const minPrice = Math.max(suggestedPrice, 500); // $5 minimum

  return {
    suggested_price_cents: minPrice,
    price_range_low_cents: Math.max(Math.round(minPrice * 0.7), 500),
    price_range_high_cents: Math.round(minPrice * 1.5),
    description:
      "AI pricing unavailable. Price set from comparable sales average. Review and adjust as needed.",
    sell_velocity: "moderate",
    sell_velocity_estimate: null,
    bundle_suggestion:
      minPrice <= 500
        ? "This item is under $5 — consider bundling with similar items."
        : null,
    pricing_rationale:
      comps.count > 0
        ? `Based on ${comps.count} comparable sold items averaging $${(comps.avg_price_cents / 100).toFixed(2)} on eBay, discounted for local garage sale pricing.`
        : "No comparable sales data available. Default pricing applied.",
  };
}
