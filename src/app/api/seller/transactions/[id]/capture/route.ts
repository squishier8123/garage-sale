import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Seller confirms pickup → release escrow funds.
 * In v1 (personal Stripe), "release" just means marking it complete.
 * In v2 (Connect Express), this would trigger a transfer to the seller's account.
 */
export async function POST(
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

  // Fetch transaction with seller ownership check
  const { data: tx } = await supabase
    .from("transactions")
    .select("id, seller_id, status, escrow_status")
    .eq("id", id)
    .single();

  if (!tx) {
    return NextResponse.json(
      { success: false, error: "Transaction not found" },
      { status: 404 },
    );
  }

  if (tx.seller_id !== user.id) {
    return NextResponse.json(
      { success: false, error: "Not authorized" },
      { status: 403 },
    );
  }

  if (tx.escrow_status !== "captured") {
    return NextResponse.json(
      {
        success: false,
        error: `Cannot release escrow with status "${tx.escrow_status}"`,
      },
      { status: 400 },
    );
  }

  const now = new Date();

  const { data: updated, error: updateError } = await supabase
    .from("transactions")
    .update({
      escrow_status: "released",
      released_at: now.toISOString(),
      pickup_status: "completed",
      pickup_completed_at: now.toISOString(),
      status: "completed",
    })
    .eq("id", id)
    .select("id, status, escrow_status, released_at")
    .single();

  if (updateError) {
    return NextResponse.json(
      { success: false, error: "Failed to release escrow" },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, data: updated });
}
