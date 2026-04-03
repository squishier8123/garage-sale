import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { ImageGallery } from "@/components/storefront/ImageGallery";

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getListing(id: string) {
  const supabase = await createClient();

  const { data: listing, error } = await supabase
    .from("listings")
    .select("*, listing_images(*), ebay_comps(*), profiles!seller_id(display_name, location_city, location_state)")
    .eq("id", id)
    .eq("status", "active")
    .single();

  if (error || !listing) return null;
  return listing;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const listing = await getListing(id);

  if (!listing) {
    return { title: "Listing Not Found" };
  }

  const price = listing.buy_now_price
    ? `$${(listing.buy_now_price / 100).toFixed(2)}`
    : "Make an offer";

  return {
    title: listing.title,
    description: listing.description ?? `${listing.title} - ${price} on Garage Sale`,
    openGraph: {
      title: `${listing.title} - ${price}`,
      description: listing.description ?? `Available on Garage Sale`,
      images: listing.listing_images?.[0]?.url
        ? [{ url: listing.listing_images[0].url, width: 800, height: 800 }]
        : undefined,
    },
  };
}

const CONDITION_LABELS: Record<string, string> = {
  new: "New",
  like_new: "Like New",
  good: "Good",
  fair: "Fair",
  poor: "Poor",
};

const CONDITION_COLORS: Record<string, string> = {
  new: "bg-green-100 text-green-800",
  like_new: "bg-emerald-100 text-emerald-800",
  good: "bg-blue-100 text-blue-800",
  fair: "bg-yellow-100 text-yellow-800",
  poor: "bg-red-100 text-red-800",
};

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

export default async function ListingDetailPage({ params }: PageProps) {
  const { id } = await params;
  const listing = await getListing(id);

  if (!listing) notFound();

  const images = (listing.listing_images ?? []) as Array<{
    id: string;
    url: string;
    hero_url: string | null;
    position: number;
  }>;

  const comps = (listing.ebay_comps ?? []) as Array<{
    id: string;
    title: string;
    sold_price: number;
    sold_date: string | null;
    condition: string | null;
    image_url: string | null;
    listing_url: string | null;
  }>;

  const seller = listing.profiles as {
    display_name: string;
    location_city: string | null;
    location_state: string | null;
  } | null;

  const displayPrice = listing.current_bid ?? listing.buy_now_price;

  // Platform fee calculation
  const platformFeeRate = 0.035;
  const platformFee = displayPrice
    ? Math.round(displayPrice * platformFeeRate)
    : 0;

  // JSON-LD Product schema
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: listing.title,
    description: listing.description,
    image: images[0]?.url,
    offers: {
      "@type": "Offer",
      price: displayPrice ? (displayPrice / 100).toFixed(2) : undefined,
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
      itemCondition: listing.condition === "new"
        ? "https://schema.org/NewCondition"
        : "https://schema.org/UsedCondition",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
          <Link href="/" className="hover:text-gray-900">
            Home
          </Link>
          <span>/</span>
          {listing.category && (
            <>
              <Link
                href={`/?category=${encodeURIComponent(listing.category)}`}
                className="hover:text-gray-900"
              >
                {listing.category}
              </Link>
              <span>/</span>
            </>
          )}
          <span className="text-gray-900 truncate">{listing.title}</span>
        </nav>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Left: Image Gallery */}
          <ImageGallery images={images} />

          {/* Right: Details + Buy Panel */}
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {listing.title}
              </h1>

              <div className="flex items-center gap-3 mt-3">
                {listing.condition && (
                  <span
                    className={`text-xs font-medium px-2.5 py-1 rounded-full ${CONDITION_COLORS[listing.condition] ?? "bg-gray-100 text-gray-800"}`}
                  >
                    {CONDITION_LABELS[listing.condition] ?? listing.condition}
                  </span>
                )}
                {listing.category && (
                  <span className="text-xs text-gray-500">{listing.category}</span>
                )}
              </div>
            </div>

            {/* Price Panel */}
            <div className="border border-gray-200 rounded-lg p-5 space-y-4">
              {displayPrice != null && (
                <div>
                  <p className="text-3xl font-bold text-gray-900">
                    {formatPrice(displayPrice)}
                  </p>
                  {listing.current_bid != null && (
                    <p className="text-sm text-gray-500 mt-1">
                      Current bid ({listing.bid_count} bid{listing.bid_count !== 1 ? "s" : ""})
                    </p>
                  )}
                  {listing.ai_suggested_price && listing.ai_suggested_price !== displayPrice && (
                    <p className="text-xs text-gray-400 mt-1">
                      AI suggested: {formatPrice(listing.ai_suggested_price)}
                    </p>
                  )}
                </div>
              )}

              {/* Buy Now / Bid buttons — placeholder for Phase 4-5 */}
              {listing.buy_now_available && listing.buy_now_price && (
                <button className="w-full py-3 px-4 bg-gray-900 text-white font-semibold rounded-lg hover:bg-gray-700 transition-colors">
                  Buy Now — {formatPrice(listing.buy_now_price)}
                </button>
              )}

              {listing.price_strategy !== "buy_now" && (
                <button className="w-full py-3 px-4 border-2 border-gray-900 text-gray-900 font-semibold rounded-lg hover:bg-gray-50 transition-colors">
                  Place Bid
                </button>
              )}

              {/* Fee transparency */}
              {displayPrice != null && (
                <p className="text-xs text-gray-400 text-center">
                  3.5% platform fee ({formatPrice(platformFee)}) applied at checkout
                </p>
              )}
            </div>

            {/* Seller info */}
            {seller && (
              <div className="flex items-center gap-3 py-3 border-t border-gray-100">
                <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-sm font-medium text-gray-600">
                  {seller.display_name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {seller.display_name}
                  </p>
                  {seller.location_city && seller.location_state && (
                    <p className="text-xs text-gray-500">
                      {seller.location_city}, {seller.location_state}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Description */}
            {listing.description && (
              <div>
                <h2 className="text-sm font-semibold text-gray-900 mb-2">
                  Description
                </h2>
                <p className="text-sm text-gray-600 whitespace-pre-line">
                  {listing.description}
                </p>
              </div>
            )}

            {/* Listing details */}
            <div>
              <h2 className="text-sm font-semibold text-gray-900 mb-2">
                Details
              </h2>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                {listing.category && (
                  <>
                    <dt className="text-gray-500">Category</dt>
                    <dd className="text-gray-900">{listing.category}</dd>
                  </>
                )}
                {listing.condition && (
                  <>
                    <dt className="text-gray-500">Condition</dt>
                    <dd className="text-gray-900">
                      {CONDITION_LABELS[listing.condition]}
                    </dd>
                  </>
                )}
                <dt className="text-gray-500">Pickup radius</dt>
                <dd className="text-gray-900">{listing.pickup_radius_miles} miles</dd>
                {listing.published_at && (
                  <>
                    <dt className="text-gray-500">Listed</dt>
                    <dd className="text-gray-900">
                      {new Date(listing.published_at).toLocaleDateString()}
                    </dd>
                  </>
                )}
                {listing.expires_at && (
                  <>
                    <dt className="text-gray-500">Expires</dt>
                    <dd className="text-gray-900">
                      {new Date(listing.expires_at).toLocaleDateString()}
                    </dd>
                  </>
                )}
              </dl>
            </div>
          </div>
        </div>

        {/* Comparable Sales */}
        {comps.length > 0 && (
          <section className="mt-12 border-t pt-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Comparable Sales on eBay
            </h2>
            <p className="text-xs text-gray-500 mb-4">
              Based on {comps.length} recently sold items.
              {listing.ebay_comp_avg_price && (
                <> Average sold price: {formatPrice(listing.ebay_comp_avg_price)}</>
              )}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {comps.slice(0, 8).map((comp) => (
                <div
                  key={comp.id}
                  className="border border-gray-200 rounded-lg p-3 text-sm"
                >
                  <p className="font-medium text-gray-900 line-clamp-2 leading-tight">
                    {comp.title}
                  </p>
                  <p className="text-lg font-bold text-gray-900 mt-1">
                    {formatPrice(comp.sold_price)}
                  </p>
                  {comp.sold_date && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      Sold {new Date(comp.sold_date).toLocaleDateString()}
                    </p>
                  )}
                  {comp.condition && (
                    <p className="text-xs text-gray-500">{comp.condition}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
