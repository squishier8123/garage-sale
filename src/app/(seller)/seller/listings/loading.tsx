export default function ListingsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="h-8 w-32 bg-gray-200 rounded animate-pulse" />
        <div className="h-10 w-28 bg-gray-200 rounded-lg animate-pulse" />
      </div>

      {/* Filter tabs skeleton */}
      <div className="flex items-center gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-8 w-16 bg-gray-200 rounded-full animate-pulse"
          />
        ))}
      </div>

      {/* Listing rows skeleton */}
      <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4">
            <div className="w-14 h-14 rounded-md bg-gray-200 animate-pulse shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-48 bg-gray-200 rounded animate-pulse" />
              <div className="h-3 w-32 bg-gray-200 rounded animate-pulse" />
            </div>
            <div className="h-7 w-16 bg-gray-200 rounded-md animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
