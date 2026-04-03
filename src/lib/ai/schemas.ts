/**
 * JSON schemas for Claude structured outputs.
 * Used with messages.parse() + jsonSchemaOutputFormat().
 */

export const VISION_ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    category: {
      type: "string",
      description:
        "Primary category (e.g., Electronics, Furniture, Clothing, Kitchen, Tools, Sports, Toys, Books, Home Decor, Automotive)",
    },
    subcategory: {
      type: ["string", "null"],
      description: "More specific subcategory if identifiable",
    },
    brand: {
      type: ["string", "null"],
      description: "Brand name if visible or identifiable",
    },
    model: {
      type: ["string", "null"],
      description: "Model name/number if visible",
    },
    condition: {
      type: "string",
      enum: ["new", "like_new", "good", "fair", "poor"],
      description: "Estimated physical condition from the image",
    },
    confidence: {
      type: "number",
      description:
        "Overall confidence in the analysis from 0.0 to 1.0. Below 0.7 means fields should be flagged for seller review.",
    },
    search_query: {
      type: "string",
      description:
        "Optimized search query for finding comparable sold items on eBay. Include brand, model, key descriptors. No condition words.",
    },
    title_suggestion: {
      type: "string",
      description:
        "Suggested listing title, concise and descriptive (max 80 chars)",
    },
    flags: {
      type: "array",
      items: { type: "string" },
      description:
        "Fields where confidence is low and seller should review. Empty array if all fields are confident.",
    },
  },
  required: [
    "category",
    "condition",
    "confidence",
    "search_query",
    "title_suggestion",
    "flags",
  ],
} as const;

export const PRICING_SCHEMA = {
  type: "object",
  properties: {
    suggested_price_cents: {
      type: "integer",
      description:
        "Recommended listing price in cents. Minimum 500 ($5.00). Based on comp data and condition.",
    },
    price_range_low_cents: {
      type: "integer",
      description: "Low end of reasonable price range in cents",
    },
    price_range_high_cents: {
      type: "integer",
      description: "High end of reasonable price range in cents",
    },
    description: {
      type: "string",
      description:
        "Generated listing description (2-4 sentences). Highlight key features, condition notes, and value proposition.",
    },
    sell_velocity: {
      type: "string",
      enum: ["fast", "moderate", "slow"],
      description:
        "Estimated how quickly this will sell based on comp volume and demand signals",
    },
    sell_velocity_estimate: {
      type: ["string", "null"],
      description:
        'Human-readable estimate like "sells in ~3 days at $20" or null if insufficient data',
    },
    bundle_suggestion: {
      type: ["string", "null"],
      description:
        "If price is under $5, suggest bundling with similar items. Null otherwise.",
    },
    pricing_rationale: {
      type: "string",
      description:
        "Brief explanation of how the price was determined from comps",
    },
  },
  required: [
    "suggested_price_cents",
    "price_range_low_cents",
    "price_range_high_cents",
    "description",
    "sell_velocity",
    "pricing_rationale",
  ],
} as const;

/** TypeScript types matching the schemas */

export interface VisionAnalysis {
  category: string;
  subcategory: string | null;
  brand: string | null;
  model: string | null;
  condition: "new" | "like_new" | "good" | "fair" | "poor";
  confidence: number;
  search_query: string;
  title_suggestion: string;
  flags: string[];
}

export interface PricingResult {
  suggested_price_cents: number;
  price_range_low_cents: number;
  price_range_high_cents: number;
  description: string;
  sell_velocity: "fast" | "moderate" | "slow";
  sell_velocity_estimate: string | null;
  bundle_suggestion: string | null;
  pricing_rationale: string;
}
