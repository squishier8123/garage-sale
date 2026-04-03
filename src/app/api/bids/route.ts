import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

const bidSchema = z.object({
  listing_id: z.string().uuid(),
  bidder_email: z.string().email(),
  bidder_name: z.string().min(1).max(100).optional(),
  amount: z.number().int().min(500), // $5 min in cents
});

export async function POST(
  request: Request,
): Promise<NextResponse<ApiResponse<unknown>>> {
  const body: unknown = await request.json();
  const parsed = bidSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  const { listing_id, bidder_email, bidder_name, amount } = parsed.data;

  const supabase = await createClient();

  // Check if user is authenticated (optional — guest bidding allowed)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Call the place_bid RPC which handles:
  // - Row locking (SELECT FOR UPDATE)
  // - Auction expiry check
  // - Bid amount validation (> current_bid, >= floor_price)
  // - Anti-sniping extension (2 min)
  // - buy_now_available = false after first bid
  const { data, error } = await supabase.rpc("place_bid", {
    p_listing_id: listing_id,
    p_bidder_email: bidder_email,
    p_bidder_name: bidder_name ?? null,
    p_amount: amount,
    p_bidder_id: user?.id ?? null,
  });

  if (error) {
    return NextResponse.json(
      { success: false, error: "Failed to place bid" },
      { status: 500 },
    );
  }

  // The RPC returns a JSONB object with either {error: string} or {success: true, bid_id, amount, bid_count}
  const result = data as Record<string, unknown>;

  if (result.error) {
    return NextResponse.json(
      { success: false, error: result.error as string },
      { status: 400 },
    );
  }

  return NextResponse.json({ success: true, data: result });
}
