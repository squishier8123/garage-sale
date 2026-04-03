export default function HomePage() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
          Your Neighborhood Garage Sale
        </h1>
        <p className="mt-6 text-lg leading-8 text-gray-600">
          Snap a photo, AI prices it, buyers find it. Sell your stuff locally
          with zero hassle.
        </p>
        <div className="mt-10 flex items-center justify-center gap-x-6">
          <a
            href="/seller/dashboard"
            className="rounded-md bg-gray-900 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-gray-700"
          >
            Start Selling
          </a>
          <a
            href="#listings"
            className="text-sm font-semibold leading-6 text-gray-900"
          >
            Browse Listings &rarr;
          </a>
        </div>
      </div>

      <section id="listings" className="mt-16">
        <h2 className="text-2xl font-bold text-gray-900">Nearby Listings</h2>
        <p className="mt-2 text-gray-500">
          Listings will appear here once items are posted.
        </p>
      </section>
    </div>
  );
}
