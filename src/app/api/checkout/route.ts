import { NextResponse } from "next/server";
import { z } from "zod";
import { stripe } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { calculateFees } from "@/lib/services/fees";

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

const checkoutSchema = z.object({
  listing_id: z.string().uuid(),
  type: z.enum(["buy_now", "auction_won"]),
  // For auction_won, the transaction already exists (created by cron)
  transaction_id: z.string().uuid().optional(),
});

export async function POST(
  request: Request,
): Promise<NextResponse<ApiResponse<{ checkout_url: string }>>> {
  const body: unknown = await request.json();
  const parsed = checkoutSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  const { listing_id, type, transaction_id } = parsed.data;
  const supabase = createAdminClient();

  // Fetch the listing
  const { data: listing, error: listingError } = await supabase
    .from("listings")
    .select(
      "id, title, seller_id, buy_now_price, current_bid, price_strategy, buy_now_available, status, listing_images(url)",
    )
    .eq("id", listing_id)
    .single();

  if (listingError || !listing) {
    return NextResponse.json(
      { success: false, error: "Listing not found" },
      { status: 404 },
    );
  }

  if (listing.status !== "active" && type === "buy_now") {
    return NextResponse.json(
      { success: false, error: "Listing is no longer available" },
      { status: 400 },
    );
  }

  // Determine the sale price
  let itemPrice: number;

  if (type === "buy_now") {
    if (!listing.buy_now_available || !listing.buy_now_price) {
      return NextResponse.json(
        { success: false, error: "Buy Now is not available for this listing" },
        { status: 400 },
      );
    }
    itemPrice = listing.buy_now_price;
  } else {
    // Auction won — price is the winning bid
    if (!listing.current_bid) {
      return NextResponse.json(
        { success: false, error: "No winning bid found" },
        { status: 400 },
      );
    }
    itemPrice = listing.current_bid;
  }

  const fees = calculateFees(itemPrice);

  // For buy_now, create a pending transaction
  let txId = transaction_id;

  if (type === "buy_now") {
    const { data: tx, error: txError } = await supabase
      .from("transactions")
      .insert({
        listing_id,
        seller_id: listing.seller_id,
        buyer_email: "pending@checkout", // Updated by webhook with actual email
        item_price: fees.item_price,
        platform_fee: fees.platform_fee,
        platform_fee_rate: fees.platform_fee_rate,
        total_charged: fees.total_charged,
        status: "payment_pending",
        escrow_status: "pending",
        pickup_status: "pending",
      })
      .select("id")
      .single();

    if (txError || !tx) {
      return NextResponse.json(
        { success: false, error: "Failed to create transaction" },
        { status: 500 },
      );
    }

    txId = tx.id;

    // Mark listing as no longer available for buy now during checkout
    // (will be fully marked as sold by webhook on successful payment)
  }

  if (!txId) {
    return NextResponse.json(
      { success: false, error: "Transaction ID required for auction checkout" },
      { status: 400 },
    );
  }

  // Get the first image for the checkout display
  const images = listing.listing_images as Array<{ url: string }> | null;
  const imageUrl = images?.[0]?.url;

  // Create Stripe Checkout Session
  const origin =
    request.headers.get("origin") ?? process.env.NEXT_PUBLIC_APP_URL ?? "";

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: listing.title,
              ...(imageUrl ? { images: [imageUrl] } : {}),
            },
            unit_amount: fees.item_price,
          },
          quantity: 1,
        },
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Platform fee (3.5%)",
            },
            unit_amount: fees.platform_fee,
          },
          quantity: 1,
        },
      ],
      metadata: {
        transaction_id: txId,
        listing_id,
        type,
      },
      success_url: `${origin}/checkout/success?transaction_id=${txId}`,
      cancel_url: `${origin}/listing/${listing_id}`,
      // Guest checkout — no Stripe account required
      customer_creation: "if_required",
    });

    // Store checkout session ID on the transaction
    await supabase
      .from("transactions")
      .update({
        stripe_checkout_session_id: session.id,
        status: "payment_pending",
      })
      .eq("id", txId);

    return NextResponse.json({
      success: true,
      data: { checkout_url: session.url! },
    });
  } catch (err) {
    // Clean up the pending transaction on Stripe failure
    if (type === "buy_now" && txId) {
      await supabase
        .from("transactions")
        .update({ status: "cancelled" })
        .eq("id", txId);
    }

    const message =
      err instanceof Error ? err.message : "Failed to create checkout session";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
