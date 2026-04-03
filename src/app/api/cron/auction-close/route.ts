import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const PLATFORM_FEE_RATE = 0.035;

/**
 * Cron: Close expired auctions (runs every 5 minutes via Vercel Cron)
 *
 * For each expired auction:
 * 1. Find the winning bid (highest amount, is_winning = true)
 * 2. Create a transaction record for the winner
 * 3. Mark the listing as sold (or expired if no bids)
 */
export async function GET(request: Request) {
  // Verify cron secret (Vercel sends this header for cron jobs)
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Find auctions that have ended but are still active
  const { data: expiredAuctions, error: fetchError } = await supabase
    .from("listings")
    .select("id, seller_id, title, current_bid, bid_count, auction_ends_at, price_strategy")
    .eq("status", "active")
    .not("auction_ends_at", "is", null)
    .lt("auction_ends_at", new Date().toISOString())
    .in("price_strategy", ["auction", "hybrid"]);

  if (fetchError) {
    return NextResponse.json(
      { error: "Failed to fetch expired auctions" },
      { status: 500 },
    );
  }

  if (!expiredAuctions || expiredAuctions.length === 0) {
    return NextResponse.json({ closed: 0, expired: 0 });
  }

  let closed = 0;
  let expired = 0;

  for (const auction of expiredAuctions) {
    if (auction.bid_count > 0 && auction.current_bid != null) {
      // Auction has a winner — find the winning bid
      const { data: winningBid } = await supabase
        .from("bids")
        .select("*")
        .eq("listing_id", auction.id)
        .eq("is_winning", true)
        .single();

      if (winningBid) {
        const itemPrice = winningBid.amount;
        const platformFee = Math.round(itemPrice * PLATFORM_FEE_RATE);
        const totalCharged = itemPrice + platformFee;

        // Create transaction for the winner
        const { error: txError } = await supabase
          .from("transactions")
          .insert({
            listing_id: auction.id,
            seller_id: auction.seller_id,
            buyer_email: winningBid.bidder_email,
            buyer_name: winningBid.bidder_name,
            buyer_id: winningBid.bidder_id,
            item_price: itemPrice,
            platform_fee: platformFee,
            platform_fee_rate: PLATFORM_FEE_RATE,
            total_charged: totalCharged,
            escrow_status: "pending",
            pickup_status: "pending",
          });

        if (!txError) {
          // Mark listing as sold
          await supabase
            .from("listings")
            .update({ status: "sold" })
            .eq("id", auction.id);
          closed++;
        }
      }
    } else {
      // No bids — mark as expired
      await supabase
        .from("listings")
        .update({ status: "expired" })
        .eq("id", auction.id);
      expired++;
    }
  }

  return NextResponse.json({ closed, expired });
}
