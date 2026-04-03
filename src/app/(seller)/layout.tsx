import Link from "next/link";

export default function SellerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <header className="border-b bg-white sticky top-0 z-50">
        <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold">
            Garage Sale
          </Link>
          <div className="flex items-center gap-6">
            <Link
              href="/seller/dashboard"
              className="text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              Dashboard
            </Link>
            <Link
              href="/seller/listings"
              className="text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              Listings
            </Link>
            <Link
              href="/seller/bulk-upload"
              className="text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              Bulk Upload
            </Link>
          </div>
        </nav>
      </header>
      <main className="flex-1 bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </div>
      </main>
    </>
  );
}
