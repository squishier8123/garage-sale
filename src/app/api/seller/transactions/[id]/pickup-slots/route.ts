import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface TimeSlotInput {
  start_time: string;
  end_time: string;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * GET — Seller fetches pickup slots for a transaction.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<ApiResponse<unknown>>> {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { success: false, error: "Not authenticated" },
      { status: 401 },
    );
  }

  // Verify seller owns this transaction
  const { data: tx } = await supabase
    .from("transactions")
    .select("id, seller_id")
    .eq("id", id)
    .single();

  if (!tx || tx.seller_id !== user.id) {
    return NextResponse.json(
      { success: false, error: "Transaction not found" },
      { status: 404 },
    );
  }

  const { data: slots, error } = await supabase
    .from("pickup_time_slots")
    .select("*")
    .eq("transaction_id", id)
    .order("start_time", { ascending: true });

  if (error) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch slots" },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, data: slots });
}

/**
 * POST — Seller creates pickup time slots for a transaction.
 * Accepts an array of { start_time, end_time } objects.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<ApiResponse<unknown>>> {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { success: false, error: "Not authenticated" },
      { status: 401 },
    );
  }

  // Verify seller owns this transaction and it's in the right state
  const { data: tx } = await supabase
    .from("transactions")
    .select("id, seller_id, status, pickup_status")
    .eq("id", id)
    .single();

  if (!tx || tx.seller_id !== user.id) {
    return NextResponse.json(
      { success: false, error: "Transaction not found" },
      { status: 404 },
    );
  }

  if (tx.status !== "payment_captured" && tx.status !== "pickup_pending") {
    return NextResponse.json(
      { success: false, error: `Cannot add slots for transaction in "${tx.status}" state` },
      { status: 400 },
    );
  }

  const body = await request.json();
  const slots: TimeSlotInput[] = body.slots;

  if (!Array.isArray(slots) || slots.length === 0 || slots.length > 10) {
    return NextResponse.json(
      { success: false, error: "Provide 1-10 time slots" },
      { status: 400 },
    );
  }

  // Validate each slot
  for (const slot of slots) {
    if (!slot.start_time || !slot.end_time) {
      return NextResponse.json(
        { success: false, error: "Each slot needs start_time and end_time" },
        { status: 400 },
      );
    }
    const start = new Date(slot.start_time);
    const end = new Date(slot.end_time);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
      return NextResponse.json(
        { success: false, error: "Invalid time range — end must be after start" },
        { status: 400 },
      );
    }
    if (start < new Date()) {
      return NextResponse.json(
        { success: false, error: "Slots must be in the future" },
        { status: 400 },
      );
    }
  }

  const rows = slots.map((slot) => ({
    transaction_id: id,
    seller_id: user.id,
    start_time: slot.start_time,
    end_time: slot.end_time,
    selected: false,
  }));

  const { data: created, error } = await supabase
    .from("pickup_time_slots")
    .insert(rows)
    .select();

  if (error) {
    return NextResponse.json(
      { success: false, error: "Failed to create slots" },
      { status: 500 },
    );
  }

  // Update transaction status to pickup_pending
  await supabase
    .from("transactions")
    .update({
      status: "pickup_pending",
      pickup_status: "pending",
    })
    .eq("id", id);

  return NextResponse.json({ success: true, data: created }, { status: 201 });
}
