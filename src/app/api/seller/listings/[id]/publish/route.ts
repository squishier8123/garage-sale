import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

const LISTING_DURATION_DAYS = 30;

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

  // Fetch listing with ownership check
  const { data: listing } = await supabase
    .from("listings")
    .select("id, seller_id, status, title, buy_now_price, category, condition")
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
      { success: false, error: `Cannot publish a listing with status "${listing.status}"` },
      { status: 400 },
    );
  }

  // Validate required fields before publish
  const missingFields: string[] = [];
  if (!listing.title || listing.title === "Processing..." || listing.title === "Manual Entry Required") {
    missingFields.push("title");
  }
  if (!listing.buy_now_price) {
    missingFields.push("buy_now_price");
  }
  if (!listing.category) {
    missingFields.push("category");
  }
  if (!listing.condition) {
    missingFields.push("condition");
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

  // Publish: set status, timestamps
  const now = new Date();
  const expiresAt = new Date(now.getTime() + LISTING_DURATION_DAYS * 24 * 60 * 60 * 1000);

  const { data: published, error: updateError } = await supabase
    .from("listings")
    .update({
      status: "active",
      published_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
    })
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
