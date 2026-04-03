import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ListingTable } from "@/components/seller/ListingTable";

export const metadata = {
  title: "My Listings",
};

export default async function ListingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: listings } = await supabase
    .from("listings")
    .select("id, title, status, buy_now_price, current_bid, bid_count, ai_needs_review, created_at, published_at, listing_images(url)")
    .eq("seller_id", user.id)
    .order("created_at", { ascending: false });

  const listingRows = (listings ?? []).map((l: Record<string, unknown>) => {
    const images = l.listing_images as Array<{ url: string }> | null;
    return {
      id: l.id as string,
      title: l.title as string,
      status: l.status as string,
      buy_now_price: l.buy_now_price as number | null,
      current_bid: l.current_bid as number | null,
      bid_count: (l.bid_count as number) ?? 0,
      ai_needs_review: (l.ai_needs_review as boolean) ?? false,
      created_at: l.created_at as string,
      published_at: l.published_at as string | null,
      hero_image_url: images?.[0]?.url ?? null,
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">My Listings</h1>
        <Link
          href="/seller/listings/new"
          className="px-4 py-2 bg-gray-900 text-white text-sm font-semibold rounded-lg hover:bg-gray-700 transition-colors"
        >
          + New Listing
        </Link>
      </div>

      <ListingTable listings={listingRows} />
    </div>
  );
}
