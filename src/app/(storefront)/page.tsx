import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ListingGrid } from "@/components/storefront/ListingGrid";
import { SearchBar } from "@/components/storefront/SearchBar";
import { LocationBar } from "@/components/storefront/LocationBar";
import { CategoryPills } from "@/components/storefront/CategoryPills";
import { SortSelect } from "@/components/storefront/SortSelect";
import { Pagination } from "@/components/storefront/Pagination";
import type { ListingCardData } from "@/components/storefront/ListingCard";

interface HomePageProps {
  searchParams: Promise<{
    q?: string;
    lat?: string;
    lng?: string;
    radius?: string;
    category?: string;
    sort?: string;
    offset?: string;
  }>;
}

async function fetchListings(params: {
  q?: string;
  lat?: string;
  lng?: string;
  radius?: string;
  category?: string;
  sort?: string;
  offset?: string;
}): Promise<{ listings: ListingCardData[]; total: number }> {
  const supabase = await createClient();

  const lat = params.lat ? parseFloat(params.lat) : null;
  const lng = params.lng ? parseFloat(params.lng) : null;
  const radius = params.radius ? parseInt(params.radius, 10) : 25;
  const offset = params.offset ? parseInt(params.offset, 10) : 0;

  // If user has shared location, use PostGIS nearby search
  if (lat != null && lng != null && !isNaN(lat) && !isNaN(lng)) {
    const { data, error } = await supabase.rpc("nearby_listings", {
      lat,
      lng,
      radius_miles: radius,
      search_query: params.q || null,
      category_filter: params.category || null,
      sort_by: params.sort || "distance",
      page_limit: 20,
      page_offset: offset,
    });

    if (error) {
      return { listings: [], total: 0 };
    }

    const { data: countResult } = await supabase.rpc("count_nearby_listings", {
      lat,
      lng,
      radius_miles: radius,
      search_query: params.q || null,
      category_filter: params.category || null,
    });

    const listings: ListingCardData[] = (data ?? []).map(
      (row: Record<string, unknown>) => ({
        id: row.id as string,
        title: row.title as string,
        buy_now_price: row.buy_now_price as number | null,
        current_bid: row.current_bid as number | null,
        bid_count: (row.bid_count as number) ?? 0,
        price_strategy: row.price_strategy as ListingCardData["price_strategy"],
        condition: row.condition as ListingCardData["condition"],
        category: row.category as string | null,
        hero_image_url: row.hero_image_url as string | null,
        location_city: row.location_city as string | null,
        location_state: row.location_state as string | null,
        distance_miles: row.distance_miles as number | null,
        auction_ends_at: row.auction_ends_at as string | null,
      }),
    );

    return { listings, total: (countResult as number) ?? 0 };
  }

  // No location — fallback to latest active listings
  let query = supabase
    .from("listings")
    .select(
      "id, title, buy_now_price, current_bid, bid_count, price_strategy, condition, category, location_city, location_state, auction_ends_at, listing_images!inner(url)",
      { count: "exact" },
    )
    .eq("status", "active")
    .order("published_at", { ascending: false })
    .range(offset, offset + 19);

  if (params.category) {
    query = query.eq("category", params.category);
  }

  if (params.q) {
    query = query.or(`title.ilike.%${params.q}%,description.ilike.%${params.q}%`);
  }

  const { data, count, error } = await query;

  if (error) {
    return { listings: [], total: 0 };
  }

  const listings: ListingCardData[] = (data ?? []).map(
    (row: Record<string, unknown>) => {
      const images = row.listing_images as Array<{ url: string }> | null;
      return {
        id: row.id as string,
        title: row.title as string,
        buy_now_price: row.buy_now_price as number | null,
        current_bid: row.current_bid as number | null,
        bid_count: (row.bid_count as number) ?? 0,
        price_strategy: row.price_strategy as ListingCardData["price_strategy"],
        condition: row.condition as ListingCardData["condition"],
        category: row.category as string | null,
        hero_image_url: images?.[0]?.url ?? null,
        location_city: row.location_city as string | null,
        location_state: row.location_state as string | null,
        distance_miles: null,
        auction_ends_at: row.auction_ends_at as string | null,
      };
    },
  );

  return { listings, total: count ?? 0 };
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const { listings, total } = await fetchListings(params);
  const hasLocation = params.lat && params.lng;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      {/* Hero — only show when no search active */}
      {!params.q && !params.category && !hasLocation && (
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
            Your Neighborhood Garage Sale
          </h1>
          <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
            Snap a photo, AI prices it, buyers find it. Sell your stuff locally
            with zero hassle.
          </p>
          <div className="mt-6 flex items-center justify-center gap-4">
            <Link
              href="/seller/dashboard"
              className="rounded-lg bg-gray-900 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-gray-700 transition-colors"
            >
              Start Selling
            </Link>
          </div>
        </div>
      )}

      {/* Search + Filters */}
      <div className="space-y-4 mb-8">
        <div className="max-w-lg">
          <Suspense>
            <SearchBar />
          </Suspense>
        </div>

        <Suspense>
          <LocationBar />
        </Suspense>

        <Suspense>
          <CategoryPills />
        </Suspense>
      </div>

      {/* Results header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">
          {hasLocation ? "Nearby Listings" : "Latest Listings"}
          {total > 0 && (
            <span className="text-sm font-normal text-gray-500 ml-2">
              ({total} {total === 1 ? "item" : "items"})
            </span>
          )}
        </h2>

        {hasLocation && (
          <Suspense>
            <SortSelect />
          </Suspense>
        )}
      </div>

      {/* Listing grid */}
      <ListingGrid listings={listings} />

      {/* Pagination */}
      {total > 20 && (
        <Suspense>
          <Pagination total={total} />
        </Suspense>
      )}
    </div>
  );
}
