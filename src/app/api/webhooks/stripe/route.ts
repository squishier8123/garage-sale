import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { signGuestToken } from "@/lib/auth/guest-token";
import type Stripe from "stripe";

const ESCROW_WINDOW_DAYS = 30;

/**
 * Stripe Webhook Handler
 *
 * Events handled:
 * - checkout.session.completed → capture payment, set escrow, update transaction
 * - charge.refunded → update escrow_status to 'refunded'
 * - charge.dispute.created → update transaction status to 'disputed'
 */
export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json(
      { error: "Missing signature or webhook secret" },
      { status: 400 },
    );
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch {
    return NextResponse.json(
      { error: "Invalid webhook signature" },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const transactionId = session.metadata?.transaction_id;
      const listingId = session.metadata?.listing_id;

      if (!transactionId) break;

      // Idempotency: check if already processed
      const { data: existing } = await supabase
        .from("transactions")
        .select("id, status, escrow_status, seller_id")
        .eq("id", transactionId)
        .single();

      if (
        existing?.escrow_status === "captured" ||
        existing?.status === "payment_captured"
      ) {
        break; // Already processed
      }

      // ADR-001: Capture immediately (no delayed auth — 30-day window is app-layer)
      const paymentIntentId = session.payment_intent as string;
      let chargeId: string | undefined;

      if (paymentIntentId) {
        try {
          // For standard checkout (not manual capture), payment is already captured
          const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
          const charge = pi.latest_charge;
          chargeId =
            typeof charge === "string" ? charge : (charge as Stripe.Charge)?.id;
        } catch {
          // Non-fatal — we still have the payment intent ID
        }
      }

      const now = new Date();
      const escrowExpiresAt = new Date(
        now.getTime() + ESCROW_WINDOW_DAYS * 24 * 60 * 60 * 1000,
      );

      const buyerEmail = session.customer_details?.email ?? "unknown";

      // Generate guest buyer JWT for pickup/messaging access
      let guestToken: string | null = null;
      if (buyerEmail !== "unknown") {
        guestToken = await signGuestToken({
          transaction_id: transactionId,
          buyer_email: buyerEmail,
        });
      }

      // Fetch listing location for pickup address
      let pickupAddress: string | null = null;
      if (listingId) {
        const { data: listing } = await supabase
          .from("listings")
          .select("location_city, location_state, location_zip")
          .eq("id", listingId)
          .single();

        if (listing) {
          pickupAddress = [listing.location_city, listing.location_state, listing.location_zip]
            .filter(Boolean)
            .join(", ");
        }
      }

      // Update transaction with payment details + pickup info
      await supabase
        .from("transactions")
        .update({
          stripe_payment_intent_id: paymentIntentId,
          stripe_charge_id: chargeId ?? null,
          buyer_email: buyerEmail,
          buyer_name: session.customer_details?.name ?? null,
          status: "payment_captured",
          escrow_status: "captured",
          captured_at: now.toISOString(),
          escrow_expires_at: escrowExpiresAt.toISOString(),
          pickup_address: pickupAddress,
          pickup_status: "pending",
        })
        .eq("id", transactionId);

      // Mark listing as sold
      if (listingId) {
        await supabase
          .from("listings")
          .update({ status: "sold" })
          .eq("id", listingId);
      }

      // Insert system message with pickup link
      if (guestToken) {
        const appUrl = (process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "https://garage-sale-theta.vercel.app").trim();
        const pickupUrl = `${appUrl}/transaction/${transactionId}?token=${guestToken}`;
        await supabase.from("messages").insert({
          transaction_id: transactionId,
          sender_role: "system",
          body: `Payment confirmed! Coordinate pickup details here. Your pickup link: ${pickupUrl}`,
        });
      }

      break;
    }

    case "charge.refunded": {
      const charge = event.data.object as Stripe.Charge;
      const paymentIntentId =
        typeof charge.payment_intent === "string"
          ? charge.payment_intent
          : (charge.payment_intent as Stripe.PaymentIntent)?.id;

      if (!paymentIntentId) break;

      // Find transaction by payment intent
      const { data: tx } = await supabase
        .from("transactions")
        .select("id, escrow_status")
        .eq("stripe_payment_intent_id", paymentIntentId)
        .single();

      if (!tx || tx.escrow_status === "refunded") break;

      await supabase
        .from("transactions")
        .update({
          escrow_status: "refunded",
          refunded_at: new Date().toISOString(),
          status: "refunded",
        })
        .eq("id", tx.id);

      break;
    }

    case "charge.dispute.created": {
      const dispute = event.data.object as Stripe.Dispute;
      const chargeId =
        typeof dispute.charge === "string"
          ? dispute.charge
          : (dispute.charge as Stripe.Charge)?.id;

      if (!chargeId) break;

      const { data: tx } = await supabase
        .from("transactions")
        .select("id")
        .eq("stripe_charge_id", chargeId)
        .single();

      if (!tx) break;

      await supabase
        .from("transactions")
        .update({ status: "disputed" })
        .eq("id", tx.id);

      break;
    }
  }

  return NextResponse.json({ received: true });
}
