import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { StatsCards } from "@/components/seller/StatsCards";

export const metadata = {
  title: "Dashboard",
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null; // Middleware handles redirect

  // Fetch stats in parallel
  const [activeResult, soldResult, revenueResult, pickupResult, viewsResult] =
    await Promise.all([
      supabase
        .from("listings")
        .select("id", { count: "exact", head: true })
        .eq("seller_id", user.id)
        .eq("status", "active"),

      supabase
        .from("listings")
        .select("id", { count: "exact", head: true })
        .eq("seller_id", user.id)
        .eq("status", "sold"),

      supabase
        .from("transactions")
        .select("item_price")
        .eq("seller_id", user.id)
        .eq("status", "completed"),

      supabase
        .from("transactions")
        .select("id", { count: "exact", head: true })
        .eq("seller_id", user.id)
        .eq("pickup_status", "pending"),

      supabase
        .from("seller_analytics_daily")
        .select("total_views")
        .eq("seller_id", user.id)
        .gte("date", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]),
    ]);

  const revenueCents = (revenueResult.data ?? []).reduce(
    (sum: number, t: { item_price: number }) => sum + t.item_price,
    0,
  );

  const viewsLast7Days = (viewsResult.data ?? []).reduce(
    (sum: number, d: { total_views: number }) => sum + d.total_views,
    0,
  );

  const stats = {
    activeListings: activeResult.count ?? 0,
    totalSold: soldResult.count ?? 0,
    revenueCents,
    pendingPickups: pickupResult.count ?? 0,
    viewsLast7Days,
  };

  // Fetch recent listings for quick glance
  const { data: recentListings } = await supabase
    .from("listings")
    .select("id, title, status, created_at, buy_now_price, ai_needs_review")
    .eq("seller_id", user.id)
    .order("created_at", { ascending: false })
    .limit(5);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <Link
          href="/seller/listings/new"
          className="px-4 py-2 bg-gray-900 text-white text-sm font-semibold rounded-lg hover:bg-gray-700 transition-colors"
        >
          + New Listing
        </Link>
      </div>

      <StatsCards stats={stats} />

      {/* Recent listings */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900">
            Recent Listings
          </h2>
          <Link
            href="/seller/listings"
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            View all &rarr;
          </Link>
        </div>

        {(!recentListings || recentListings.length === 0) ? (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
            <p className="text-gray-500">No listings yet.</p>
            <Link
              href="/seller/listings/new"
              className="inline-block mt-3 text-sm font-medium text-gray-900 hover:underline"
            >
              Create your first listing &rarr;
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
            {recentListings.map((listing) => (
              <Link
                key={listing.id}
                href={`/seller/listings/${listing.id}`}
                className="flex items-center justify-between p-4 hover:bg-gray-50"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {listing.title}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {new Date(listing.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {listing.ai_needs_review && (
                    <span className="text-xs text-amber-600 font-medium">
                      Review
                    </span>
                  )}
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      listing.status === "active"
                        ? "bg-green-100 text-green-800"
                        : listing.status === "draft"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {listing.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
