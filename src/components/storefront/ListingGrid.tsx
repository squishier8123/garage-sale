import { ListingCard, type ListingCardData } from "./ListingCard";

interface ListingGridProps {
  listings: ListingCardData[];
  emptyMessage?: string;
}

export function ListingGrid({
  listings,
  emptyMessage = "No listings found nearby. Check back soon!",
}: ListingGridProps) {
  if (listings.length === 0) {
    return (
      <div className="text-center py-16">
        <svg className="mx-auto w-16 h-16 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
        <p className="mt-4 text-gray-500">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {listings.map((listing) => (
        <ListingCard key={listing.id} listing={listing} />
      ))}
    </div>
  );
}
