import Anthropic from "@anthropic-ai/sdk";
import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";
import {
  VISION_ANALYSIS_SCHEMA,
  type VisionAnalysis,
} from "./schemas";

const client = new Anthropic();

const VISION_SYSTEM_PROMPT = `You are an expert at identifying items for a garage sale marketplace. Analyze the provided image and identify:

1. What the item is (category, subcategory)
2. Brand and model if visible
3. Physical condition based on what you can see
4. A search query optimized for finding this item's sold price on eBay

Rules:
- Be specific with brands — if you can see a logo or label, name it
- For condition, look for wear, damage, stains, scratches, missing parts
- The search_query should be what someone would type on eBay to find this exact item sold. Include brand + model + key descriptors. Exclude condition words.
- Set confidence below 0.7 for any field you're uncertain about
- Add uncertain field names to the flags array
- title_suggestion should be concise, descriptive, and include brand if known (max 80 chars)
- If the image is blurry, dark, or you genuinely can't identify the item, set confidence very low and flag everything`;

/**
 * Analyze an image using Claude Haiku 4.5 vision.
 * Returns structured analysis with category, brand, condition, search query.
 *
 * @param imageUrl - Public URL of the image (Vercel Blob CDN)
 * @returns Structured analysis result
 */
export async function analyzeImage(
  imageUrl: string,
): Promise<VisionAnalysis> {
  const message = await client.messages.parse({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system: VISION_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "url",
              url: imageUrl,
            },
          },
          {
            type: "text",
            text: "Analyze this item for a garage sale listing. Identify it and provide all required fields.",
          },
        ],
      },
    ],
    output_config: {
      format: jsonSchemaOutputFormat(VISION_ANALYSIS_SCHEMA),
    },
  });

  const result = message.parsed_output as VisionAnalysis | null;
  if (!result) {
    throw new Error("Failed to parse vision analysis response");
  }

  // Auto-flag fields with low confidence
  return applyConfidenceFlags(result);
}

/**
 * Ensure fields with low confidence are properly flagged.
 */
function applyConfidenceFlags(analysis: VisionAnalysis): VisionAnalysis {
  const flags = new Set(analysis.flags);

  if (analysis.confidence < 0.7) {
    // Low overall confidence — flag everything nullable
    if (analysis.brand === null) flags.add("brand");
    if (analysis.model === null) flags.add("model");
    flags.add("category");
    flags.add("condition");
  }

  return {
    ...analysis,
    flags: Array.from(flags),
  };
}
