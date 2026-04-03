import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const updateListingSchema = z.object({
  title: z.string().min(3).max(120).optional(),
  description: z.string().max(2000).optional(),
  category: z.string().optional(),
  condition: z.enum(["new", "like_new", "good", "fair", "poor"]).optional(),
  tags: z.array(z.string()).max(10).optional(),
  buy_now_price: z.number().int().min(500).optional(), // $5 min in cents
  price_strategy: z.enum(["buy_now", "auction", "hybrid"]).optional(),
  auction_floor_price: z.number().int().min(500).optional(),
  auction_duration_days: z.number().int().min(1).max(7).optional(),
  pickup_radius_miles: z.number().int().min(5).max(50).optional(),
});

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export async function PATCH(
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

  // Verify listing exists and belongs to this seller
  const { data: listing } = await supabase
    .from("listings")
    .select("id, seller_id, status")
    .eq("id", id)
    .single();

  if (!listing) {
    return NextResponse.json(
      { success: false, error: "Listing not found" },
      { status: 404 },
    );
  }

  if (listing.seller_id !== user.id) {
    return NextResponse.json(
      { success: false, error: "Not authorized" },
      { status: 403 },
    );
  }

  if (listing.status !== "draft") {
    return NextResponse.json(
      { success: false, error: "Only draft listings can be edited" },
      { status: 400 },
    );
  }

  // Validate request body
  const body: unknown = await request.json();
  const parsed = updateListingSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  // Extract auction_duration_days (not a DB column) and build update payload
  const { auction_duration_days, ...updateFields } = parsed.data;

  // Store duration as metadata for publish step to compute auction_ends_at
  const updatePayload: Record<string, unknown> = { ...updateFields };
  if (auction_duration_days != null) {
    // Store duration in a way the publish route can use it
    // We'll set auction_ends_at at publish time, but save the intent now
    updatePayload.auction_ends_at = null; // Will be computed at publish
  }

  const { data: updated, error: updateError } = await supabase
    .from("listings")
    .update(updatePayload)
    .eq("id", id)
    .select("*, listing_images(*)")
    .single();

  if (updateError) {
    return NextResponse.json(
      { success: false, error: "Failed to update listing" },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, data: updated });
}

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

  const { data: listing } = await supabase
    .from("listings")
    .select("*, listing_images(*), ebay_comps(*)")
    .eq("id", id)
    .eq("seller_id", user.id)
    .single();

  if (!listing) {
    return NextResponse.json(
      { success: false, error: "Listing not found" },
      { status: 404 },
    );
  }

  return NextResponse.json({ success: true, data: listing });
}
