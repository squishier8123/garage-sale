import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Cron: Aggregate daily analytics per seller (runs daily at 1am via Vercel Cron)
 *
 * Rolls up listing_views, bids, and transactions into seller_analytics_daily.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const dateStr = yesterday.toISOString().split("T")[0];

  // Get all sellers with active or sold listings
  const { data: sellers, error: sellerError } = await supabase
    .from("profiles")
    .select("id")
    .eq("role", "seller");

  if (sellerError || !sellers) {
    return NextResponse.json(
      { error: "Failed to fetch sellers" },
      { status: 500 },
    );
  }

  let aggregated = 0;

  for (const seller of sellers) {
    // Count views for yesterday
    const { count: viewCount } = await supabase
      .from("listing_views")
      .select("id", { count: "exact", head: true })
      .eq("seller_id", seller.id)
      .gte("viewed_at", `${dateStr}T00:00:00Z`)
      .lt("viewed_at", `${dateStr}T23:59:59Z`);

    // Count bids for yesterday — join through listings to get seller's bids
    const { data: sellerListings } = await supabase
      .from("listings")
      .select("id")
      .eq("seller_id", seller.id);

    const sellerListingIds = (sellerListings ?? []).map((l) => l.id);

    let bidCount = 0;
    if (sellerListingIds.length > 0) {
      const { count } = await supabase
        .from("bids")
        .select("id", { count: "exact", head: true })
        .in("listing_id", sellerListingIds)
        .gte("created_at", `${dateStr}T00:00:00Z`)
        .lt("created_at", `${dateStr}T23:59:59Z`);
      bidCount = count ?? 0;
    }

    // Revenue for yesterday
    const { data: txData } = await supabase
      .from("transactions")
      .select("item_price, platform_fee")
      .eq("seller_id", seller.id)
      .gte("created_at", `${dateStr}T00:00:00Z`)
      .lt("created_at", `${dateStr}T23:59:59Z`);

    const revenue = (txData ?? []).reduce(
      (sum, t) => sum + (t.item_price ?? 0),
      0,
    );
    const fees = (txData ?? []).reduce(
      (sum, t) => sum + (t.platform_fee ?? 0),
      0,
    );
    const sales = txData?.length ?? 0;

    // Upsert into seller_analytics_daily
    await supabase.from("seller_analytics_daily").upsert(
      {
        seller_id: seller.id,
        date: dateStr,
        total_views: viewCount ?? 0,
        total_bids: bidCount ?? 0,
        total_sales: sales,
        revenue: revenue,
        fees_paid: fees,
      },
      { onConflict: "seller_id,date" },
    );

    aggregated++;
  }

  return NextResponse.json({ aggregated, date: dateStr });
}
