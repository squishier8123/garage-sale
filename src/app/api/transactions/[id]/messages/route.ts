import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateRequest, type AuthIdentity } from "@/lib/auth/guest-token";
import { createClient } from "@/lib/supabase/server";

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Verify the caller is a participant in the transaction.
 * Returns the transaction data or null.
 */
async function verifyParticipant(
  transactionId: string,
  identity: AuthIdentity,
) {
  const admin = createAdminClient();
  const { data: tx } = await admin
    .from("transactions")
    .select("id, seller_id, buyer_id, buyer_email")
    .eq("id", transactionId)
    .single();

  if (!tx) return null;

  const isParticipant =
    (identity.role === "seller" && tx.seller_id === identity.userId) ||
    (identity.role === "buyer" && tx.buyer_email === identity.email);

  return isParticipant ? tx : null;
}

/**
 * GET — List messages for a transaction.
 * Supports both authenticated sellers and guest buyers.
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

  if (identity.role === "buyer" && identity.transactionId !== transactionId) {
    return NextResponse.json(
      { success: false, error: "Not authorized for this transaction" },
      { status: 403 },
    );
  }

  const tx = await verifyParticipant(transactionId, identity);
  if (!tx) {
    return NextResponse.json(
      { success: false, error: "Transaction not found or not authorized" },
      { status: 404 },
    );
  }

  const admin = createAdminClient();
  const { data: messages, error } = await admin
    .from("messages")
    .select("id, sender_role, body, created_at, read_at")
    .eq("transaction_id", transactionId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch messages" },
      { status: 500 },
    );
  }

  // Mark unread messages as read for the current user's role
  const unreadIds = (messages ?? [])
    .filter((m) => !m.read_at && m.sender_role !== identity.role)
    .map((m) => m.id);

  if (unreadIds.length > 0) {
    await admin
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .in("id", unreadIds);
  }

  return NextResponse.json({ success: true, data: messages });
}

/**
 * POST — Send a message in a transaction thread.
 * Supports both authenticated sellers and guest buyers.
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

  if (identity.role === "buyer" && identity.transactionId !== transactionId) {
    return NextResponse.json(
      { success: false, error: "Not authorized for this transaction" },
      { status: 403 },
    );
  }

  const tx = await verifyParticipant(transactionId, identity);
  if (!tx) {
    return NextResponse.json(
      { success: false, error: "Transaction not found or not authorized" },
      { status: 404 },
    );
  }

  const body = await request.json();
  const messageBody = typeof body.body === "string" ? body.body.trim() : "";

  if (!messageBody) {
    return NextResponse.json(
      { success: false, error: "Message body is required" },
      { status: 400 },
    );
  }

  if (messageBody.length > 2000) {
    return NextResponse.json(
      { success: false, error: "Message must be 2000 characters or less" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const senderRole = identity.role === "seller" ? "seller" : "buyer";

  const { data: message, error } = await admin
    .from("messages")
    .insert({
      transaction_id: transactionId,
      sender_role: senderRole,
      sender_id: identity.userId ?? null,
      sender_email: identity.email ?? null,
      body: messageBody,
    })
    .select("id, sender_role, body, created_at")
    .single();

  if (error) {
    return NextResponse.json(
      { success: false, error: "Failed to send message" },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, data: message }, { status: 201 });
}
