export interface CompItem {
  ebay_item_id: string;
  title: string;
  sold_price_cents: number;
  sold_date: string | null;
  condition: string | null;
  image_url: string | null;
  listing_url: string | null;
}

export interface CompResult {
  items: CompItem[];
  avg_price_cents: number;
  count: number;
  source: "cache_fresh" | "cache_stale" | "searchapi" | "fallback";
  fetched_at: string;
}
