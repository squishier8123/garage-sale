export default function StorefrontLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      {/* Search skeleton */}
      <div className="space-y-4 mb-8">
        <div className="h-10 w-full max-w-lg bg-gray-200 rounded-lg animate-pulse" />
        <div className="h-8 w-48 bg-gray-200 rounded-lg animate-pulse" />
        <div className="flex gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-8 w-20 bg-gray-200 rounded-full animate-pulse"
            />
          ))}
        </div>
      </div>

      {/* Grid skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-gray-200 bg-white overflow-hidden">
            <div className="aspect-square bg-gray-200 animate-pulse" />
            <div className="p-3 space-y-2">
              <div className="h-4 w-3/4 bg-gray-200 rounded animate-pulse" />
              <div className="h-5 w-1/3 bg-gray-200 rounded animate-pulse" />
              <div className="h-3 w-1/2 bg-gray-200 rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
