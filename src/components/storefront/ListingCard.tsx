import Image from "next/image";
import Link from "next/link";

export interface ListingCardData {
  id: string;
  title: string;
  buy_now_price: number | null;
  current_bid: number | null;
  bid_count: number;
  price_strategy: "buy_now" | "auction" | "hybrid";
  condition: "new" | "like_new" | "good" | "fair" | "poor" | null;
  category: string | null;
  hero_image_url: string | null;
  location_city: string | null;
  location_state: string | null;
  distance_miles: number | null;
  auction_ends_at: string | null;
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

function getTimeRemaining(endsAt: string): string | null {
  const diff = new Date(endsAt).getTime() - Date.now();
  if (diff <= 0) return "Ended";
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours >= 24) return `${Math.floor(hours / 24)}d ${hours % 24}h left`;
  if (hours > 0) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
}

export function ListingCard({ listing }: { listing: ListingCardData }) {
  const displayPrice =
    listing.current_bid ?? listing.buy_now_price;
  const priceLabel =
    listing.current_bid != null ? "Current Bid" : "Buy Now";

  return (
    <Link
      href={`/listing/${listing.id}`}
      className="group block rounded-lg border border-gray-200 bg-white overflow-hidden hover:shadow-md transition-shadow"
    >
      <div className="relative aspect-square bg-gray-100">
        {listing.hero_image_url ? (
          <Image
            src={listing.hero_image_url}
            alt={listing.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.41a2.25 2.25 0 013.182 0l2.909 2.91m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
          </div>
        )}

        {listing.condition && (
          <span
            className={`absolute top-2 left-2 text-xs font-medium px-2 py-0.5 rounded-full ${CONDITION_COLORS[listing.condition] ?? "bg-gray-100 text-gray-800"}`}
          >
            {CONDITION_LABELS[listing.condition] ?? listing.condition}
          </span>
        )}

        {listing.auction_ends_at && (
          <span className="absolute top-2 right-2 text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-800">
            {getTimeRemaining(listing.auction_ends_at)}
          </span>
        )}
      </div>

      <div className="p-3">
        <h3 className="text-sm font-medium text-gray-900 line-clamp-2 leading-tight">
          {listing.title}
        </h3>

        <div className="mt-1.5 flex items-baseline gap-1.5">
          {displayPrice != null && (
            <span className="text-lg font-bold text-gray-900">
              {formatPrice(displayPrice)}
            </span>
          )}
          <span className="text-xs text-gray-500">{priceLabel}</span>
        </div>

        {listing.bid_count > 0 && (
          <p className="text-xs text-gray-500 mt-0.5">
            {listing.bid_count} bid{listing.bid_count !== 1 ? "s" : ""}
          </p>
        )}

        <div className="mt-2 flex items-center gap-1 text-xs text-gray-500">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
          </svg>
          {listing.location_city && listing.location_state
            ? `${listing.location_city}, ${listing.location_state}`
            : "Location not set"}
          {listing.distance_miles != null && (
            <span className="ml-auto">{listing.distance_miles} mi</span>
          )}
        </div>
      </div>
    </Link>
  );
}
