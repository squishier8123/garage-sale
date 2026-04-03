import Anthropic from "@anthropic-ai/sdk";
import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";
import { PRICING_SCHEMA, type PricingResult } from "./schemas";
import type { VisionAnalysis } from "./schemas";
import type { CompResult } from "@/lib/comps/types";

const client = new Anthropic();

const MIN_PRICE_CENTS = 500; // $5.00

const PRICING_SYSTEM_PROMPT = `You are a garage sale pricing expert. Given an item's details and comparable sold prices from eBay, determine a fair listing price.

Rules:
- Price in CENTS (integer). $20.00 = 2000.
- Minimum price is 500 cents ($5.00). If the item is worth less than $5, set suggested_price_cents to 500 and provide a bundle_suggestion.
- Garage sale items typically sell for 30-60% of eBay sold prices (local, no shipping, immediate pickup).
- Factor in condition: "new" = closer to eBay price, "poor" = steep discount.
- If no comps available, estimate conservatively based on item type and condition.
- The description should be 2-4 sentences highlighting features, condition, and value. Write in a casual but informative tone.
- sell_velocity: "fast" = common item with strong demand, "moderate" = niche or seasonal, "slow" = specialized or low demand.
- pricing_rationale must reference actual comp data when available. Never make up comp prices.`;

/**
 * Generate pricing recommendation using Claude Haiku 4.5.
 *
 * @param analysis - Vision analysis result (category, brand, condition, etc.)
 * @param comps - Comparable sold items from SearchAPI.io
 * @returns Pricing recommendation with description and rationale
 */
export async function generatePricing(
  analysis: VisionAnalysis,
  comps: CompResult,
): Promise<PricingResult> {
  const compSummary = buildCompSummary(comps);

  const message = await client.messages.parse({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system: PRICING_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Price this item for a local garage sale listing:

**Item Details:**
- Category: ${analysis.category}${analysis.subcategory ? ` > ${analysis.subcategory}` : ""}
- Brand: ${analysis.brand ?? "Unknown"}
- Model: ${analysis.model ?? "Unknown"}
- Condition: ${analysis.condition}
- Title: ${analysis.title_suggestion}

**Comparable Sold Items (eBay):**
${compSummary}

Provide a pricing recommendation. Remember: prices are in CENTS (integer). Minimum is 500 ($5.00).`,
      },
    ],
    output_config: {
      format: jsonSchemaOutputFormat(PRICING_SCHEMA),
    },
  });

  const result = message.parsed_output as PricingResult | null;
  if (!result) {
    throw new Error("Failed to parse pricing response");
  }

  // Enforce $5 minimum
  return enforceMinimumPrice(result);
}

function buildCompSummary(comps: CompResult): string {
  if (comps.count === 0) {
    return "No comparable sold items found. Estimate based on item type and condition.";
  }

  const lines = comps.items.slice(0, 5).map((item) => {
    const price = (item.sold_price_cents / 100).toFixed(2);
    const cond = item.condition ? ` (${item.condition})` : "";
    return `- "${item.title}"${cond} — sold for $${price}`;
  });

  const avgPrice = (comps.avg_price_cents / 100).toFixed(2);
  lines.push(`\nAverage sold price: $${avgPrice} across ${comps.count} comps`);
  lines.push(`Source: ${comps.source}`);

  return lines.join("\n");
}

function enforceMinimumPrice(result: PricingResult): PricingResult {
  if (result.suggested_price_cents < MIN_PRICE_CENTS) {
    return {
      ...result,
      suggested_price_cents: MIN_PRICE_CENTS,
      price_range_low_cents: Math.max(
        result.price_range_low_cents,
        MIN_PRICE_CENTS,
      ),
      bundle_suggestion:
        result.bundle_suggestion ??
        "This item is under $5 — consider bundling with similar items for a better listing.",
    };
  }
  return result;
}
