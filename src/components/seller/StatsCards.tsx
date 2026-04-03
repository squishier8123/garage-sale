interface StatsData {
  activeListings: number;
  totalSold: number;
  revenueCents: number;
  pendingPickups: number;
  viewsLast7Days: number;
}

function formatCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

const STAT_CONFIGS = [
  { key: "activeListings" as const, label: "Active Listings", format: (v: number) => String(v) },
  { key: "totalSold" as const, label: "Total Sold", format: (v: number) => String(v) },
  { key: "revenueCents" as const, label: "Revenue", format: formatCurrency },
  { key: "pendingPickups" as const, label: "Pending Pickups", format: (v: number) => String(v) },
  { key: "viewsLast7Days" as const, label: "Views (7d)", format: (v: number) => String(v) },
];

export function StatsCards({ stats }: { stats: StatsData }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      {STAT_CONFIGS.map(({ key, label, format }) => (
        <div
          key={key}
          className="bg-white rounded-lg border border-gray-200 p-4"
        >
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {format(stats[key])}
          </p>
        </div>
      ))}
    </div>
  );
}
