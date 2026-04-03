import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatCents } from "@/lib/services/fees";

interface PageProps {
  searchParams: Promise<{ transaction_id?: string }>;
}

export default async function CheckoutSuccessPage({
  searchParams,
}: PageProps) {
  const { transaction_id } = await searchParams;

  if (!transaction_id) notFound();

  const supabase = createAdminClient();

  const { data: tx } = await supabase
    .from("transactions")
    .select(
      "*, listings!listing_id(title, listing_images(url))",
    )
    .eq("id", transaction_id)
    .single();

  if (!tx) notFound();

  const listing = tx.listings as {
    title: string;
    listing_images: Array<{ url: string }>;
  } | null;

  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <div className="text-center space-y-4">
        {/* Success icon */}
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
          <svg
            className="w-8 h-8 text-green-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-gray-900">
          Payment Confirmed
        </h1>
        <p className="text-sm text-gray-500">
          Your order has been placed. The seller will be notified and will
          reach out to arrange pickup.
        </p>
      </div>

      {/* Order summary */}
      <div className="mt-8 border border-gray-200 rounded-lg p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">Order Summary</h2>

        {listing && (
          <div className="flex items-center gap-3">
            {listing.listing_images?.[0]?.url && (
              <div className="w-16 h-16 rounded-md overflow-hidden bg-gray-100 flex-shrink-0">
                <img
                  src={listing.listing_images[0].url}
                  alt={listing.title}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <p className="font-medium text-gray-900">{listing.title}</p>
          </div>
        )}

        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-gray-500">Item price</dt>
            <dd className="text-gray-900 font-medium">
              {formatCents(tx.item_price)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Platform fee (3.5%)</dt>
            <dd className="text-gray-900">{formatCents(tx.platform_fee)}</dd>
          </div>
          <div className="flex justify-between border-t pt-2">
            <dt className="font-medium text-gray-900">Total charged</dt>
            <dd className="font-bold text-gray-900">
              {formatCents(tx.total_charged)}
            </dd>
          </div>
        </dl>
      </div>

      {/* Escrow info */}
      <div className="mt-6 bg-blue-50 rounded-lg p-4 text-sm text-blue-800">
        <p className="font-medium">Your payment is held securely</p>
        <p className="mt-1 text-blue-600">
          Payment is held in escrow until you pick up your item. If pickup
          doesn&apos;t happen within 30 days, you&apos;ll receive a full refund
          automatically.
        </p>
      </div>

      {/* Next steps */}
      <div className="mt-6 space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">What happens next</h2>
        <ol className="space-y-2 text-sm text-gray-600">
          <li className="flex gap-2">
            <span className="font-medium text-gray-900">1.</span>
            The seller will offer pickup time windows
          </li>
          <li className="flex gap-2">
            <span className="font-medium text-gray-900">2.</span>
            You&apos;ll choose a time and coordinate via messages
          </li>
          <li className="flex gap-2">
            <span className="font-medium text-gray-900">3.</span>
            Once you pick up the item, the seller confirms and funds are
            released
          </li>
        </ol>
      </div>

      {/* Pickup coordination link */}
      {tx.pickup_address && (
        <div className="mt-6 rounded-lg border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-900">
            Pickup Location
          </h2>
          <p className="mt-1 text-sm text-gray-700">{tx.pickup_address}</p>
        </div>
      )}

      {/* Confirmation email note */}
      <p className="mt-6 text-xs text-gray-400 text-center">
        Check your email at {tx.buyer_email} for your pickup coordination
        link. Order ID: {tx.id.slice(0, 8)}
      </p>

      <div className="mt-8 text-center">
        <Link
          href="/"
          className="text-sm font-medium text-gray-900 hover:text-gray-700 underline"
        >
          Continue browsing
        </Link>
      </div>
    </div>
  );
}
