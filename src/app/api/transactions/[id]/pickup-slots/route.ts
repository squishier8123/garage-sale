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
 * GET — Fetch pickup slots for a transaction.
 * Accessible by both authenticated sellers and guest buyers.
 */
export async function GET(
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

  const admin = createAdminClient();

  // Verify the user is a participant in this transaction
  const { data: tx } = await admin
    .from("transactions")
    .select("id, seller_id, buyer_id, buyer_email")
    .eq("id", transactionId)
    .single();

  if (!tx) {
    return NextResponse.json(
      { success: false, error: "Transaction not found" },
      { status: 404 },
    );
  }

  const isParticipant =
    (identity.role === "seller" && tx.seller_id === identity.userId) ||
    (identity.role === "buyer" && tx.buyer_email === identity.email);

  if (!isParticipant) {
    return NextResponse.json(
      { success: false, error: "Not authorized" },
      { status: 403 },
    );
  }

  const { data: slots, error } = await admin
    .from("pickup_time_slots")
    .select("id, start_time, end_time, selected, created_at")
    .eq("transaction_id", transactionId)
    .order("start_time", { ascending: true });

  if (error) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch slots" },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, data: slots });
}
