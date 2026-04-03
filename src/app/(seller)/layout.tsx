import Link from "next/link";

export default function SellerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <header className="border-b bg-white sticky top-0 z-50">
        <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between">
          <Link href="/" className="text-lg sm:text-xl font-bold">
            Garage Sale
          </Link>
          <div className="flex items-center gap-3 sm:gap-6">
            <Link
              href="/seller/dashboard"
              className="text-xs sm:text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              Dashboard
            </Link>
            <Link
              href="/seller/listings"
              className="text-xs sm:text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              Listings
            </Link>
            <Link
              href="/seller/analytics"
              className="hidden sm:inline text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              Analytics
            </Link>
            <Link
              href="/seller/bulk-upload"
              className="hidden sm:inline text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              Bulk Upload
            </Link>
            <Link
              href="/seller/listings/new"
              className="text-xs sm:text-sm font-medium text-white bg-gray-900 px-3 py-1.5 rounded-lg hover:bg-gray-700 sm:hidden"
            >
              + New
            </Link>
          </div>
        </nav>
      </header>
      <main className="flex-1 bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
          {children}
        </div>
      </main>
    </>
  );
}
