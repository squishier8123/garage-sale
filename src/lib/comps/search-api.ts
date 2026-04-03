import { checkCache, writeCache } from "./cache";
import type { CompItem, CompResult } from "./types";

const SEARCHAPI_BASE = "https://www.searchapi.io/api/v1/search";

interface SearchApiResult {
  organic_results?: Array<{
    title?: string;
    link?: string;
    price?: { raw?: string; extracted?: number };
    thumbnail?: string;
    extensions?: string[];
    result_id?: string;
  }>;
}

/**
 * Fetch comparable sold items for a search query.
 * Uses cache → SearchAPI.io → fallback chain.
 *
 * @param searchQuery - The eBay search query (from AI vision)
 * @returns CompResult with items, avg price, and source
 */
export async function fetchComps(searchQuery: string): Promise<CompResult> {
  // 1. Check cache first
  const cached = await checkCache(searchQuery);

  if (cached.status === "fresh") {
    return cached.result;
  }

  // 2. Try SearchAPI.io (background refresh for stale cache)
  try {
    const freshResult = await querySearchApi(searchQuery);

    // Cache the fresh results
    await writeCache(searchQuery, freshResult.items);

    return freshResult;
  } catch (error) {
    // 3. Fallback: serve stale cache if available
    if (cached.status === "stale") {
      return cached.result;
    }

    // 4. No cache, no API — return empty with fallback marker
    console.error("SearchAPI.io failed and no cache available:", error);
    return {
      items: [],
      avg_price_cents: 0,
      count: 0,
      source: "fallback",
      fetched_at: new Date().toISOString(),
    };
  }
}

/**
 * Query SearchAPI.io for eBay sold/completed listings.
 */
async function querySearchApi(searchQuery: string): Promise<CompResult> {
  const apiKey = process.env.SEARCHAPI_API_KEY;
  if (!apiKey) {
    throw new Error("SEARCHAPI_API_KEY not configured");
  }

  const params = new URLSearchParams({
    engine: "ebay",
    _nkw: searchQuery,
    LH_Complete: "1", // Completed listings
    LH_Sold: "1", // Sold only
    _sop: "13", // Sort by end date (most recent)
    api_key: apiKey,
  });

  const response = await fetch(`${SEARCHAPI_BASE}?${params.toString()}`);

  if (!response.ok) {
    throw new Error(`SearchAPI.io error: ${response.status}`);
  }

  const data = (await response.json()) as SearchApiResult;
  const results = data.organic_results ?? [];

  const items: CompItem[] = results
    .filter((r) => r.price?.extracted != null)
    .slice(0, 10) // Top 10 comps
    .map((r) => ({
      ebay_item_id: r.result_id ?? r.link?.match(/\/(\d+)\??/)?.[1] ?? "",
      title: r.title ?? "",
      sold_price_cents: Math.round((r.price!.extracted!) * 100),
      sold_date: null, // SearchAPI doesn't reliably return sold date
      condition: r.extensions?.find((e) =>
        ["New", "Used", "Refurbished", "Open Box", "For Parts"].some((c) =>
          e.includes(c),
        ),
      ) ?? null,
      image_url: r.thumbnail ?? null,
      listing_url: r.link ?? null,
    }));

  const avgPriceCents =
    items.length > 0
      ? Math.round(
          items.reduce((sum, i) => sum + i.sold_price_cents, 0) / items.length,
        )
      : 0;

  return {
    items,
    avg_price_cents: avgPriceCents,
    count: items.length,
    source: "searchapi",
    fetched_at: new Date().toISOString(),
  };
}
