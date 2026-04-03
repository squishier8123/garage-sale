export default function ListingDetailLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb skeleton */}
      <div className="h-4 w-48 bg-gray-200 rounded animate-pulse mb-6" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Image skeleton */}
        <div className="aspect-square bg-gray-200 rounded-lg animate-pulse" />

        {/* Details skeleton */}
        <div className="space-y-6">
          <div>
            <div className="h-7 w-3/4 bg-gray-200 rounded animate-pulse" />
            <div className="flex gap-2 mt-3">
              <div className="h-6 w-16 bg-gray-200 rounded-full animate-pulse" />
              <div className="h-6 w-20 bg-gray-200 rounded-full animate-pulse" />
            </div>
          </div>

          {/* Price skeleton */}
          <div className="border border-gray-200 rounded-lg p-5 space-y-4">
            <div className="h-9 w-24 bg-gray-200 rounded animate-pulse" />
            <div className="h-10 w-full bg-gray-200 rounded-lg animate-pulse" />
          </div>

          {/* Seller skeleton */}
          <div className="flex items-center gap-3 py-3 border-t">
            <div className="w-10 h-10 rounded-full bg-gray-200 animate-pulse" />
            <div className="space-y-1">
              <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
              <div className="h-3 w-32 bg-gray-200 rounded animate-pulse" />
            </div>
          </div>

          {/* Description skeleton */}
          <div className="space-y-2">
            <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
            <div className="h-3 w-full bg-gray-200 rounded animate-pulse" />
            <div className="h-3 w-5/6 bg-gray-200 rounded animate-pulse" />
            <div className="h-3 w-2/3 bg-gray-200 rounded animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}
