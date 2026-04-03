/**
 * Normalize search queries for cache key consistency.
 * Lowercase, alphabetically sorted words, trimmed.
 */
export function normalizeQuery(query: string): string {
  return query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(" ");
}
