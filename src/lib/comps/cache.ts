import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeQuery } from "./normalize";
import type { CompItem, CompResult } from "./types";

const FRESH_DAYS = 7;
const STALE_DAYS = 30;

interface CacheRow {
  id: string;
  search_query_normalized: string;
  results: CompItem[];
  result_count: number;
  fetched_at: string;
  expires_at: string;
}

/**
 * Check comp cache for a search query.
 * Returns:
 * - { status: "fresh", result } if cached within 7 days
 * - { status: "stale", result } if cached within 30 days (serve but refresh)
 * - { status: "miss" } if no cache or expired past 30 days
 */
export async function checkCache(
  searchQuery: string,
): Promise<
  | { status: "fresh"; result: CompResult }
  | { status: "stale"; result: CompResult }
  | { status: "miss" }
> {
  const normalized = normalizeQuery(searchQuery);
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("comp_cache")
    .select("*")
    .eq("search_query_normalized", normalized)
    .order("fetched_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return { status: "miss" };
  }

  const row = data as CacheRow;
  const fetchedAt = new Date(row.fetched_at);
  const now = new Date();
  const daysSinceFetch =
    (now.getTime() - fetchedAt.getTime()) / (1000 * 60 * 60 * 24);

  if (daysSinceFetch > STALE_DAYS) {
    return { status: "miss" };
  }

  const result: CompResult = {
    items: row.results,
    avg_price_cents:
      row.results.length > 0
        ? Math.round(
            row.results.reduce((sum, r) => sum + r.sold_price_cents, 0) /
              row.results.length,
          )
        : 0,
    count: row.result_count,
    source: daysSinceFetch <= FRESH_DAYS ? "cache_fresh" : "cache_stale",
    fetched_at: row.fetched_at,
  };

  return {
    status: daysSinceFetch <= FRESH_DAYS ? "fresh" : "stale",
    result,
  };
}

/**
 * Write comp results to cache.
 */
export async function writeCache(
  searchQuery: string,
  items: CompItem[],
): Promise<void> {
  const normalized = normalizeQuery(searchQuery);
  const admin = createAdminClient();
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + FRESH_DAYS * 24 * 60 * 60 * 1000,
  );

  // Upsert by normalized query
  await admin.from("comp_cache").upsert(
    {
      search_query_normalized: normalized,
      results: items,
      result_count: items.length,
      fetched_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
    },
    { onConflict: "search_query_normalized" },
  );
}
