export default function AnalyticsLoading() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-24 bg-gray-200 rounded animate-pulse" />

      {/* Summary cards skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-lg border border-gray-200 p-4"
          >
            <div className="h-4 w-16 bg-gray-200 rounded animate-pulse" />
            <div className="h-7 w-12 bg-gray-200 rounded animate-pulse mt-2" />
          </div>
        ))}
      </div>

      {/* Chart skeleton */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <div className="h-4 w-32 bg-gray-200 rounded animate-pulse mb-4" />
        <div className="h-32 bg-gray-100 rounded animate-pulse" />
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <div className="h-4 w-24 bg-gray-200 rounded animate-pulse mb-4" />
        <div className="h-32 bg-gray-100 rounded animate-pulse" />
      </div>
    </div>
  );
}
