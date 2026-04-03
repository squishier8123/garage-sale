import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyGuestToken } from "@/lib/auth/guest-token";
import { formatCents } from "@/lib/services/fees";
import { TransactionClientView } from "./TransactionClientView";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
}

export default async function TransactionPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const { token } = await searchParams;

  // Determine auth identity
  let role: "seller" | "buyer" = "buyer";
  let isAuthorized = false;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const admin = createAdminClient();

  // Fetch transaction with listing details
  const { data: tx } = await admin
    .from("transactions")
    .select(
      `*,
      listings!listing_id(
        title, description, condition, category,
        listing_images(url, is_primary, hero_url)
      ),
      pickup_time_slots(id, start_time, end_time, selected, created_at)`,
    )
    .eq("id", id)
    .single();

  if (!tx) notFound();

  // Check authorization
  if (user && tx.seller_id === user.id) {
    role = "seller";
    isAuthorized = true;
  } else if (token) {
    const payload = await verifyGuestToken(token);
    if (payload && payload.transaction_id === id && payload.buyer_email === tx.buyer_email) {
      role = "buyer";
      isAuthorized = true;
    }
  } else if (user && tx.buyer_id === user.id) {
    role = "buyer";
    isAuthorized = true;
  }

  if (!isAuthorized) notFound();

  const listing = tx.listings as {
    title: string;
    description: string | null;
    condition: string;
    category: string;
    listing_images: Array<{ url: string; is_primary: boolean; hero_url: string | null }>;
  } | null;

  const primaryImage =
    listing?.listing_images?.find((img) => img.is_primary) ??
    listing?.listing_images?.[0];

  const slots = (tx.pickup_time_slots ?? []) as Array<{
    id: string;
    start_time: string;
    end_time: string;
    selected: boolean;
    created_at: string;
  }>;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      {/* Item summary */}
      <div className="mb-6 flex items-start gap-4 rounded-lg border border-gray-200 bg-white p-4">
        {primaryImage && (
          <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-md bg-gray-100">
            <img
              src={primaryImage.hero_url ?? primaryImage.url}
              alt={listing?.title ?? "Item"}
              className="h-full w-full object-cover"
            />
          </div>
        )}
        <div className="flex-1">
          <h1 className="text-lg font-bold text-gray-900">
            {listing?.title ?? "Item"}
          </h1>
          {listing?.condition && (
            <span className="mt-1 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
              {listing.condition}
            </span>
          )}
          <div className="mt-2 flex items-baseline gap-3">
            <span className="text-lg font-bold text-gray-900">
              {formatCents(tx.item_price)}
            </span>
            <span className="text-sm text-gray-500">
              Total: {formatCents(tx.total_charged)}
            </span>
          </div>
        </div>
      </div>

      {/* Status banner */}
      <StatusBanner
        status={tx.status}
        pickupStatus={tx.pickup_status}
        role={role}
      />

      {/* Pickup address (revealed after payment) */}
      {tx.pickup_address && role === "buyer" && (
        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-gray-900">
            Pickup Location
          </h3>
          <p className="mt-1 text-sm text-gray-700">{tx.pickup_address}</p>
          {tx.pickup_notes && (
            <p className="mt-1 text-xs text-gray-500">{tx.pickup_notes}</p>
          )}
        </div>
      )}

      {/* Client-side interactive section */}
      <TransactionClientView
        transactionId={id}
        role={role}
        guestToken={token ?? null}
        initialSlots={slots}
        canConfirmPickup={
          role === "seller" &&
          tx.pickup_status === "scheduled" &&
          tx.escrow_status === "captured"
        }
        escrowStatus={tx.escrow_status}
      />
    </div>
  );
}

function StatusBanner({
  status,
  pickupStatus,
  role,
}: {
  status: string;
  pickupStatus: string;
  role: "seller" | "buyer";
}) {
  const statusConfig: Record<string, { color: string; text: string }> = {
    payment_captured: {
      color: "bg-yellow-50 text-yellow-800 border-yellow-200",
      text:
        role === "seller"
          ? "Payment received — offer pickup times below"
          : "Payment confirmed — waiting for pickup times",
    },
    pickup_pending: {
      color: "bg-yellow-50 text-yellow-800 border-yellow-200",
      text:
        role === "seller"
          ? "Waiting for buyer to choose a pickup time"
          : "Choose a pickup time below",
    },
    pickup_scheduled: {
      color: "bg-blue-50 text-blue-800 border-blue-200",
      text:
        role === "seller"
          ? "Pickup scheduled — confirm when buyer picks up the item"
          : "Pickup scheduled — see you there!",
    },
    completed: {
      color: "bg-green-50 text-green-800 border-green-200",
      text: "Transaction complete — pickup confirmed",
    },
    refunded: {
      color: "bg-red-50 text-red-800 border-red-200",
      text: "This transaction was refunded",
    },
  };

  const config = statusConfig[status] ?? {
    color: "bg-gray-50 text-gray-800 border-gray-200",
    text: `Status: ${status.replace(/_/g, " ")}`,
  };

  return (
    <div
      className={`mb-6 rounded-lg border px-4 py-3 text-sm font-medium ${config.color}`}
    >
      {config.text}
    </div>
  );
}
