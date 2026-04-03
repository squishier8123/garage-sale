import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Cron: Expire listings older than 30 days (runs daily at midnight via Vercel Cron)
 *
 * Skips listings with active auctions that have bids.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const thirtyDaysAgo = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000,
  ).toISOString();

  // Find active listings published more than 30 days ago
  const { data: expirable, error: fetchError } = await supabase
    .from("listings")
    .select("id, bid_count, auction_ends_at, price_strategy")
    .eq("status", "active")
    .lt("published_at", thirtyDaysAgo);

  if (fetchError) {
    return NextResponse.json(
      { error: "Failed to fetch expirable listings" },
      { status: 500 },
    );
  }

  if (!expirable || expirable.length === 0) {
    return NextResponse.json({ expired: 0, skipped: 0 });
  }

  let expired = 0;
  let skipped = 0;

  for (const listing of expirable) {
    // Skip active auctions with bids — let auction-close handle them
    const hasActiveAuction =
      listing.price_strategy !== "buy_now" &&
      listing.auction_ends_at &&
      new Date(listing.auction_ends_at) > new Date() &&
      listing.bid_count > 0;

    if (hasActiveAuction) {
      skipped++;
      continue;
    }

    const { error: updateError } = await supabase
      .from("listings")
      .update({
        status: "expired",
        expires_at: new Date().toISOString(),
      })
      .eq("id", listing.id);

    if (!updateError) {
      expired++;
    }
  }

  return NextResponse.json({ expired, skipped });
}
