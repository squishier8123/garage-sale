"use client";

import { useState } from "react";

interface DailyStat {
  date: string;
  views: number;
  bids: number;
  sales: number;
  revenue: number;
}

type TimeRange = "7d" | "14d" | "30d";

export function AnalyticsCharts({ dailyStats }: { dailyStats: DailyStat[] }) {
  const [range, setRange] = useState<TimeRange>("30d");

  const daysMap: Record<TimeRange, number> = { "7d": 7, "14d": 14, "30d": 30 };
  const filtered = dailyStats.slice(-daysMap[range]);

  const maxViews = Math.max(...filtered.map((d) => d.views), 1);
  const maxRevenue = Math.max(...filtered.map((d) => d.revenue), 1);

  const totalViews = filtered.reduce((s, d) => s + d.views, 0);
  const totalBids = filtered.reduce((s, d) => s + d.bids, 0);
  const totalSales = filtered.reduce((s, d) => s + d.sales, 0);
  const totalRevenue = filtered.reduce((s, d) => s + d.revenue, 0);

  return (
    <div className="space-y-6">
      {/* Time range selector */}
      <div className="flex items-center gap-2">
        {(["7d", "14d", "30d"] as const).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
              range === r
                ? "bg-gray-900 text-white border-gray-900"
                : "border-gray-300 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      {/* Funnel summary */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">
          Conversion Funnel ({range})
        </h3>
        <div className="flex items-end gap-4 sm:gap-8">
          <FunnelStep
            label="Views"
            value={totalViews}
            percentage={100}
            color="bg-blue-500"
          />
          <FunnelArrow />
          <FunnelStep
            label="Bids"
            value={totalBids}
            percentage={totalViews > 0 ? (totalBids / totalViews) * 100 : 0}
            color="bg-amber-500"
          />
          <FunnelArrow />
          <FunnelStep
            label="Sales"
            value={totalSales}
            percentage={totalViews > 0 ? (totalSales / totalViews) * 100 : 0}
            color="bg-green-500"
          />
          <FunnelArrow />
          <FunnelStep
            label="Revenue"
            value={`$${(totalRevenue / 100).toFixed(0)}`}
            percentage={null}
            color="bg-gray-900"
          />
        </div>
      </div>

      {/* Views chart */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">
          Daily Views
        </h3>
        {filtered.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">
            No data yet. Views will appear after your listings get traffic.
          </p>
        ) : (
          <div className="flex items-end gap-px h-32">
            {filtered.map((d) => (
              <div
                key={d.date}
                className="flex-1 group relative"
                title={`${d.date}: ${d.views} views`}
              >
                <div
                  className="bg-blue-500 rounded-t-sm hover:bg-blue-600 transition-colors w-full"
                  style={{
                    height: `${Math.max((d.views / maxViews) * 100, 2)}%`,
                  }}
                />
              </div>
            ))}
          </div>
        )}
        <div className="flex justify-between mt-2 text-xs text-gray-400">
          <span>{filtered[0]?.date ?? ""}</span>
          <span>{filtered[filtered.length - 1]?.date ?? ""}</span>
        </div>
      </div>

      {/* Revenue chart */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">
          Daily Revenue
        </h3>
        {filtered.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">
            No sales data yet.
          </p>
        ) : (
          <div className="flex items-end gap-px h-32">
            {filtered.map((d) => (
              <div
                key={d.date}
                className="flex-1 group relative"
                title={`${d.date}: $${(d.revenue / 100).toFixed(2)}`}
              >
                <div
                  className="bg-green-500 rounded-t-sm hover:bg-green-600 transition-colors w-full"
                  style={{
                    height: `${Math.max((d.revenue / maxRevenue) * 100, d.revenue > 0 ? 4 : 0)}%`,
                  }}
                />
              </div>
            ))}
          </div>
        )}
        <div className="flex justify-between mt-2 text-xs text-gray-400">
          <span>{filtered[0]?.date ?? ""}</span>
          <span>{filtered[filtered.length - 1]?.date ?? ""}</span>
        </div>
      </div>
    </div>
  );
}

function FunnelStep({
  label,
  value,
  percentage,
  color,
}: {
  label: string;
  value: number | string;
  percentage: number | null;
  color: string;
}) {
  return (
    <div className="flex-1 text-center">
      <div className="flex flex-col items-center gap-1">
        <div
          className={`w-full rounded-md ${color} flex items-center justify-center`}
          style={{
            height:
              percentage !== null
                ? `${Math.max(percentage * 0.6, 8)}px`
                : "32px",
          }}
        />
        <span className="text-lg sm:text-xl font-bold text-gray-900">
          {value}
        </span>
        <span className="text-xs text-gray-500">{label}</span>
        {percentage !== null && percentage < 100 && (
          <span className="text-xs text-gray-400">
            {percentage.toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  );
}

function FunnelArrow() {
  return (
    <div className="text-gray-300 text-sm pb-8 hidden sm:block">&rarr;</div>
  );
}
