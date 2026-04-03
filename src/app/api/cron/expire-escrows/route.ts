import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Cron: Expire escrows past 30-day window (runs hourly via Vercel Cron)
 *
 * For each expired escrow:
 * 1. Issue Stripe refund
 * 2. Update transaction status to refunded/expired
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Find captured escrows past their expiry date
  const { data: expired, error: fetchError } = await supabase
    .from("transactions")
    .select("id, stripe_payment_intent_id, total_charged, escrow_status")
    .eq("escrow_status", "captured")
    .lt("escrow_expires_at", new Date().toISOString());

  if (fetchError) {
    return NextResponse.json(
      { error: "Failed to fetch expired escrows" },
      { status: 500 },
    );
  }

  if (!expired || expired.length === 0) {
    return NextResponse.json({ refunded: 0 });
  }

  let refunded = 0;

  for (const tx of expired) {
    try {
      // Issue Stripe refund
      if (tx.stripe_payment_intent_id) {
        await stripe.refunds.create({
          payment_intent: tx.stripe_payment_intent_id,
          reason: "requested_by_customer",
        });
      }

      // Update transaction
      await supabase
        .from("transactions")
        .update({
          escrow_status: "expired",
          refunded_at: new Date().toISOString(),
          status: "expired",
        })
        .eq("id", tx.id);

      refunded++;
    } catch {
      // Log but don't fail the whole batch — retry next run
      await supabase
        .from("transactions")
        .update({
          status: "expired",
          escrow_status: "expired",
        })
        .eq("id", tx.id);
    }
  }

  return NextResponse.json({ refunded });
}
