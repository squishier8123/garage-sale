export default function DashboardLoading() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="h-8 w-32 bg-gray-200 rounded animate-pulse" />
        <div className="h-10 w-28 bg-gray-200 rounded-lg animate-pulse" />
      </div>

      {/* Stats skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-lg border border-gray-200 p-4"
          >
            <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
            <div className="h-7 w-16 bg-gray-200 rounded animate-pulse mt-2" />
          </div>
        ))}
      </div>

      {/* Recent listings skeleton */}
      <div>
        <div className="h-6 w-36 bg-gray-200 rounded animate-pulse mb-3" />
        <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between p-4">
              <div className="space-y-1.5">
                <div className="h-4 w-48 bg-gray-200 rounded animate-pulse" />
                <div className="h-3 w-24 bg-gray-200 rounded animate-pulse" />
              </div>
              <div className="h-5 w-14 bg-gray-200 rounded-full animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
