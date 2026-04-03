import { createClient } from "@/lib/supabase/server";
import { AnalyticsCharts } from "@/components/seller/AnalyticsCharts";

export const metadata = {
  title: "Analytics",
};

export default async function AnalyticsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // Fetch last 30 days of analytics
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const { data: dailyStats } = await supabase
    .from("seller_analytics_daily")
    .select("date, total_views, total_bids, total_sales, revenue, fees_paid")
    .eq("seller_id", user.id)
    .gte("date", thirtyDaysAgo)
    .order("date", { ascending: true });

  // Fetch totals for summary cards
  const [totalSold, totalRevenue, totalListings, totalViews] =
    await Promise.all([
      supabase
        .from("transactions")
        .select("id", { count: "exact", head: true })
        .eq("seller_id", user.id)
        .eq("status", "completed"),

      supabase
        .from("transactions")
        .select("item_price")
        .eq("seller_id", user.id)
        .eq("status", "completed"),

      supabase
        .from("listings")
        .select("id", { count: "exact", head: true })
        .eq("seller_id", user.id),

      supabase
        .from("seller_analytics_daily")
        .select("total_views")
        .eq("seller_id", user.id),
    ]);

  const revenueCents = (totalRevenue.data ?? []).reduce(
    (sum: number, t: { item_price: number }) => sum + t.item_price,
    0,
  );

  const allTimeViews = (totalViews.data ?? []).reduce(
    (sum: number, d: { total_views: number }) => sum + d.total_views,
    0,
  );

  const conversionRate =
    allTimeViews > 0
      ? (((totalSold.count ?? 0) / allTimeViews) * 100).toFixed(1)
      : "0";

  // AI accuracy — listings where seller accepted AI price vs overrode
  const { count: aiAccepted } = await supabase
    .from("listings")
    .select("id", { count: "exact", head: true })
    .eq("seller_id", user.id)
    .not("ai_suggested_price", "is", null)
    .filter("buy_now_price", "eq", "ai_suggested_price");

  const { count: aiTotal } = await supabase
    .from("listings")
    .select("id", { count: "exact", head: true })
    .eq("seller_id", user.id)
    .not("ai_suggested_price", "is", null);

  const aiAcceptRate =
    (aiTotal ?? 0) > 0
      ? (((aiAccepted ?? 0) / (aiTotal ?? 1)) * 100).toFixed(0)
      : "N/A";

  const summaryStats = {
    totalSales: totalSold.count ?? 0,
    totalRevenue: revenueCents,
    totalListings: totalListings.count ?? 0,
    allTimeViews,
    conversionRate,
    aiAcceptRate,
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <SummaryCard label="Total Sales" value={String(summaryStats.totalSales)} />
        <SummaryCard
          label="Revenue"
          value={`$${(summaryStats.totalRevenue / 100).toFixed(2)}`}
        />
        <SummaryCard
          label="Listings"
          value={String(summaryStats.totalListings)}
        />
        <SummaryCard
          label="Total Views"
          value={summaryStats.allTimeViews.toLocaleString()}
        />
        <SummaryCard
          label="Conversion"
          value={`${summaryStats.conversionRate}%`}
        />
        <SummaryCard
          label="AI Accept Rate"
          value={summaryStats.aiAcceptRate === "N/A" ? "N/A" : `${summaryStats.aiAcceptRate}%`}
        />
      </div>

      {/* Charts */}
      <AnalyticsCharts
        dailyStats={
          (dailyStats ?? []).map((d) => ({
            date: d.date,
            views: d.total_views,
            bids: d.total_bids,
            sales: d.total_sales,
            revenue: d.revenue,
          }))
        }
      />
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <p className="text-xs sm:text-sm text-gray-500">{label}</p>
      <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{value}</p>
    </div>
  );
}
