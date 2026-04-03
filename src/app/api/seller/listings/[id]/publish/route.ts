import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

const LISTING_DURATION_DAYS = 30;

const publishBodySchema = z
  .object({
    auction_duration_days: z.number().int().min(1).max(7).optional(),
  })
  .optional();

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

  // Parse optional body (for auction duration)
  let auctionDurationDays: number | undefined;
  try {
    const body: unknown = await request.json();
    const parsed = publishBodySchema.safeParse(body);
    if (parsed.success && parsed.data) {
      auctionDurationDays = parsed.data.auction_duration_days;
    }
  } catch {
    // No body is fine — fixed-price listings don't need one
  }

  // Fetch listing with ownership check
  const { data: listing } = await supabase
    .from("listings")
    .select(
      "id, seller_id, status, title, buy_now_price, auction_floor_price, price_strategy, category, condition",
    )
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
      {
        success: false,
        error: `Cannot publish a listing with status "${listing.status}"`,
      },
      { status: 400 },
    );
  }

  // Validate required fields before publish
  const missingFields: string[] = [];
  if (
    !listing.title ||
    listing.title === "Processing..." ||
    listing.title === "Manual Entry Required"
  ) {
    missingFields.push("title");
  }
  if (!listing.category) {
    missingFields.push("category");
  }
  if (!listing.condition) {
    missingFields.push("condition");
  }

  // Price validation depends on strategy
  const strategy = listing.price_strategy ?? "buy_now";
  if (strategy !== "auction" && !listing.buy_now_price) {
    missingFields.push("buy_now_price");
  }
  if (strategy !== "buy_now" && !listing.auction_floor_price) {
    missingFields.push("auction_floor_price");
  }

  if (missingFields.length > 0) {
    return NextResponse.json(
      {
        success: false,
        error: `Missing required fields: ${missingFields.join(", ")}`,
      },
      { status: 400 },
    );
  }

  // Verify at least one image exists
  const { count: imageCount } = await supabase
    .from("listing_images")
    .select("id", { count: "exact", head: true })
    .eq("listing_id", id);

  if (!imageCount || imageCount === 0) {
    return NextResponse.json(
      { success: false, error: "At least one image is required to publish" },
      { status: 400 },
    );
  }

  // Publish: set status, timestamps, auction end time
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + LISTING_DURATION_DAYS * 24 * 60 * 60 * 1000,
  );

  const updateData: Record<string, unknown> = {
    status: "active",
    published_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
  };

  // Set auction_ends_at for auction/hybrid listings
  if (strategy !== "buy_now") {
    const durationDays = auctionDurationDays ?? 3;
    const auctionEndsAt = new Date(
      now.getTime() + durationDays * 24 * 60 * 60 * 1000,
    );
    updateData.auction_ends_at = auctionEndsAt.toISOString();
  }

  const { data: published, error: updateError } = await supabase
    .from("listings")
    .update(updateData)
    .eq("id", id)
    .select("*, listing_images(*)")
    .single();

  if (updateError) {
    return NextResponse.json(
      { success: false, error: "Failed to publish listing" },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, data: published });
}
