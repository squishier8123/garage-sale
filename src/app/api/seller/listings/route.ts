import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runListingPipeline } from "@/lib/services/listing-pipeline";
import { z } from "zod";

const createListingSchema = z.object({
  image_urls: z
    .array(z.string().url())
    .min(1, "At least one image is required")
    .max(8, "Maximum 8 images allowed"),
});

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export async function POST(request: Request): Promise<NextResponse<ApiResponse<unknown>>> {
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

  // Verify seller role
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, location, location_city, location_state, location_zip")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "seller") {
    return NextResponse.json(
      { success: false, error: "Only sellers can create listings" },
      { status: 403 },
    );
  }

  // Validate request body
  const body: unknown = await request.json();
  const parsed = createListingSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  const { image_urls } = parsed.data;
  const primaryImageUrl = image_urls[0];
  const additionalImageUrls = image_urls.slice(1);

  // Create draft listing to get an ID
  const { data: listing, error: insertError } = await supabase
    .from("listings")
    .insert({
      seller_id: user.id,
      title: "Processing...",
      status: "draft",
      location: profile.location,
      location_city: profile.location_city,
      location_state: profile.location_state,
      location_zip: profile.location_zip,
    })
    .select("id")
    .single();

  if (insertError || !listing) {
    return NextResponse.json(
      { success: false, error: "Failed to create listing" },
      { status: 500 },
    );
  }

  // Insert image records
  const imageRecords = image_urls.map((url, index) => ({
    listing_id: listing.id,
    storage_path: new URL(url).pathname,
    url,
    position: index,
  }));

  const { error: imagesError } = await supabase
    .from("listing_images")
    .insert(imageRecords);

  if (imagesError) {
    // Clean up the listing if images fail
    await supabase.from("listings").delete().eq("id", listing.id);
    return NextResponse.json(
      { success: false, error: "Failed to save image records" },
      { status: 500 },
    );
  }

  // Run AI pipeline
  try {
    const { result, errors } = await runListingPipeline({
      imageUrl: primaryImageUrl,
      listingId: listing.id,
      additionalImageUrls,
    });

    // Update listing with pipeline results
    const { error: updateError } = await supabase
      .from("listings")
      .update({
        title: result.analysis.title_suggestion,
        description: result.pricing.description,
        category: result.analysis.category,
        condition: result.analysis.condition,
        buy_now_price: result.pricing.suggested_price_cents,
        ai_confidence: result.analysis.confidence,
        ai_suggested_price: result.pricing.suggested_price_cents,
        ai_category_suggestion: result.analysis.category,
        ai_description_draft: result.pricing.description,
        ai_needs_review: result.needsReview,
        ai_review_fields: result.reviewFields,
        ebay_comp_avg_price: result.comps.avg_price_cents || null,
        ebay_comp_count: result.comps.count || null,
        ebay_comps_fetched_at: result.comps.fetched_at,
      })
      .eq("id", listing.id);

    if (updateError) {
      return NextResponse.json(
        { success: false, error: "Failed to update listing with AI results" },
        { status: 500 },
      );
    }

    // Update hero image if bg removal succeeded
    if (result.heroUrl) {
      await supabase
        .from("listing_images")
        .update({ hero_url: result.heroUrl })
        .eq("listing_id", listing.id)
        .eq("position", 0);
    }

    // Store individual comp items
    if (result.comps.items.length > 0) {
      const compRecords = result.comps.items.map((item) => ({
        listing_id: listing.id,
        ebay_item_id: item.ebay_item_id,
        title: item.title,
        sold_price: item.sold_price_cents,
        sold_date: item.sold_date ?? null,
        condition: item.condition ?? null,
        image_url: item.image_url ?? null,
        listing_url: item.listing_url ?? null,
      }));

      await supabase.from("ebay_comps").insert(compRecords);
    }

    // Fetch the complete listing with images
    const { data: completeListing } = await supabase
      .from("listings")
      .select("*, listing_images(*)")
      .eq("id", listing.id)
      .single();

    return NextResponse.json({
      success: true,
      data: {
        listing: completeListing,
        pipeline: {
          processing_time_ms: result.processingTimeMs,
          needs_review: result.needsReview,
          review_fields: result.reviewFields,
          pricing: {
            suggested_price_cents: result.pricing.suggested_price_cents,
            price_range_low_cents: result.pricing.price_range_low_cents,
            price_range_high_cents: result.pricing.price_range_high_cents,
            sell_velocity: result.pricing.sell_velocity,
            sell_velocity_estimate: result.pricing.sell_velocity_estimate,
            bundle_suggestion: result.pricing.bundle_suggestion,
            pricing_rationale: result.pricing.pricing_rationale,
          },
          errors: errors.length > 0 ? errors : undefined,
        },
      },
    });
  } catch (error) {
    // Pipeline hard-failed (vision analysis down) — listing stays as draft
    // with "Processing..." title so seller knows it needs manual entry
    await supabase
      .from("listings")
      .update({
        title: "Manual Entry Required",
        ai_needs_review: true,
        ai_review_fields: [
          "title",
          "description",
          "category",
          "condition",
          "price",
        ],
      })
      .eq("id", listing.id);

    return NextResponse.json({
      success: true,
      data: {
        listing: { id: listing.id, status: "draft" },
        pipeline: {
          failed: true,
          error: (error as Error).message,
          message:
            "AI analysis unavailable. Please fill in listing details manually.",
        },
      },
    });
  }
}
