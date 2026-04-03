import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateRequest } from "@/lib/auth/guest-token";
import { createClient } from "@/lib/supabase/server";

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * POST — Buyer selects a pickup time slot.
 * Supports both authenticated users and guest buyers (JWT token).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<ApiResponse<unknown>>> {
  const { id: transactionId } = await params;
  const supabase = await createClient();
  const identity = await authenticateRequest(request, supabase);

  if (!identity) {
    return NextResponse.json(
      { success: false, error: "Not authenticated" },
      { status: 401 },
    );
  }

  // Guest buyers can only access their own transaction
  if (identity.role === "buyer" && identity.transactionId !== transactionId) {
    return NextResponse.json(
      { success: false, error: "Not authorized for this transaction" },
      { status: 403 },
    );
  }

  const body = await request.json();
  const { slot_id } = body;

  if (!slot_id) {
    return NextResponse.json(
      { success: false, error: "slot_id is required" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  // Verify the slot belongs to this transaction and isn't already selected
  const { data: slot } = await admin
    .from("pickup_time_slots")
    .select("id, transaction_id, selected")
    .eq("id", slot_id)
    .eq("transaction_id", transactionId)
    .single();

  if (!slot) {
    return NextResponse.json(
      { success: false, error: "Slot not found" },
      { status: 404 },
    );
  }

  // Verify buyer is associated with this transaction
  const { data: tx } = await admin
    .from("transactions")
    .select("id, buyer_id, buyer_email, pickup_status")
    .eq("id", transactionId)
    .single();

  if (!tx) {
    return NextResponse.json(
      { success: false, error: "Transaction not found" },
      { status: 404 },
    );
  }

  const isBuyer =
    (identity.role === "seller" && tx.buyer_id === identity.userId) ||
    (identity.role === "buyer" && tx.buyer_email === identity.email);

  if (!isBuyer) {
    return NextResponse.json(
      { success: false, error: "Only the buyer can select a pickup slot" },
      { status: 403 },
    );
  }

  if (tx.pickup_status === "completed" || tx.pickup_status === "cancelled") {
    return NextResponse.json(
      { success: false, error: `Pickup is already ${tx.pickup_status}` },
      { status: 400 },
    );
  }

  // Deselect all other slots, select this one (atomic via admin)
  await admin
    .from("pickup_time_slots")
    .update({ selected: false })
    .eq("transaction_id", transactionId);

  const { error: selectError } = await admin
    .from("pickup_time_slots")
    .update({ selected: true })
    .eq("id", slot_id);

  if (selectError) {
    return NextResponse.json(
      { success: false, error: "Failed to select slot" },
      { status: 500 },
    );
  }

  // Update transaction pickup status
  const selectedSlot = await admin
    .from("pickup_time_slots")
    .select("start_time")
    .eq("id", slot_id)
    .single();

  await admin
    .from("transactions")
    .update({
      pickup_status: "scheduled",
      status: "pickup_scheduled",
      pickup_scheduled_at: selectedSlot.data?.start_time,
    })
    .eq("id", transactionId);

  // Insert system message
  await admin.from("messages").insert({
    transaction_id: transactionId,
    sender_role: "system",
    body: `Pickup time confirmed: ${new Date(selectedSlot.data?.start_time).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}`,
  });

  return NextResponse.json({
    success: true,
    data: { slot_id, scheduled_at: selectedSlot.data?.start_time },
  });
}
