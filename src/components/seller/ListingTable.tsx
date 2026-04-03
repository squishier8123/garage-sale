"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";

interface ListingRow {
  id: string;
  title: string;
  status: string;
  buy_now_price: number | null;
  current_bid: number | null;
  bid_count: number;
  ai_needs_review: boolean;
  created_at: string;
  published_at: string | null;
  hero_image_url: string | null;
}

const STATUS_BADGES: Record<string, string> = {
  draft: "bg-yellow-100 text-yellow-800",
  active: "bg-green-100 text-green-800",
  sold: "bg-blue-100 text-blue-800",
  expired: "bg-gray-100 text-gray-800",
  cancelled: "bg-red-100 text-red-800",
};

const STATUS_FILTERS = ["all", "draft", "active", "sold", "expired", "cancelled"] as const;

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

export function ListingTable({ listings }: { listings: ListingRow[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<string>("all");
  const [isPending, startTransition] = useTransition();

  const filtered =
    filter === "all" ? listings : listings.filter((l) => l.status === filter);

  async function handleAction(id: string, action: "publish" | "cancel") {
    const supabase = createClient();

    if (action === "publish") {
      const res = await fetch(`/api/seller/listings/${id}/publish`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error ?? "Failed to publish");
        return;
      }
    } else if (action === "cancel") {
      const { error } = await supabase
        .from("listings")
        .update({ status: "cancelled" })
        .eq("id", id);
      if (error) {
        alert("Failed to cancel listing");
        return;
      }
    }

    startTransition(() => {
      router.refresh();
    });
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this draft? This cannot be undone.")) return;

    const supabase = createClient();
    const { error } = await supabase
      .from("listings")
      .delete()
      .eq("id", id)
      .eq("status", "draft");

    if (error) {
      alert("Failed to delete. Only drafts can be deleted.");
      return;
    }

    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div>
      {/* Status filter tabs */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto">
        {STATUS_FILTERS.map((s) => {
          const count =
            s === "all" ? listings.length : listings.filter((l) => l.status === s).length;
          return (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`shrink-0 px-3 py-1.5 text-sm rounded-full border transition-colors ${
                filter === s
                  ? "bg-gray-900 text-white border-gray-900"
                  : "border-gray-300 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
              <span className="ml-1 text-xs opacity-75">({count})</span>
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No {filter === "all" ? "" : filter} listings yet.
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
          {filtered.map((listing) => (
            <div
              key={listing.id}
              className="flex items-center gap-4 p-4 hover:bg-gray-50"
            >
              {/* Thumbnail */}
              <div className="w-14 h-14 rounded-md bg-gray-100 overflow-hidden shrink-0 relative">
                {listing.hero_image_url ? (
                  <Image
                    src={listing.hero_image_url}
                    alt={listing.title}
                    fill
                    className="object-cover"
                    sizes="56px"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">
                    No img
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/seller/listings/${listing.id}`}
                    className="text-sm font-medium text-gray-900 truncate hover:underline"
                  >
                    {listing.title}
                  </Link>
                  <span
                    className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_BADGES[listing.status] ?? "bg-gray-100 text-gray-800"}`}
                  >
                    {listing.status}
                  </span>
                  {listing.ai_needs_review && (
                    <span className="shrink-0 text-xs text-amber-600 font-medium">
                      Needs Review
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {listing.buy_now_price
                    ? formatPrice(listing.buy_now_price)
                    : "No price set"}
                  {listing.bid_count > 0 &&
                    ` | ${listing.bid_count} bid${listing.bid_count !== 1 ? "s" : ""}`}
                  {" | "}
                  {listing.published_at
                    ? `Published ${new Date(listing.published_at).toLocaleDateString()}`
                    : `Created ${new Date(listing.created_at).toLocaleDateString()}`}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                {listing.status === "draft" && (
                  <>
                    <button
                      onClick={() => handleAction(listing.id, "publish")}
                      disabled={isPending}
                      className="px-3 py-1 text-xs font-medium bg-gray-900 text-white rounded-md hover:bg-gray-700 disabled:opacity-50"
                    >
                      Publish
                    </button>
                    <button
                      onClick={() => handleDelete(listing.id)}
                      disabled={isPending}
                      className="px-3 py-1 text-xs font-medium text-red-600 hover:text-red-800 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </>
                )}
                {listing.status === "active" && (
                  <button
                    onClick={() => handleAction(listing.id, "cancel")}
                    disabled={isPending}
                    className="px-3 py-1 text-xs font-medium text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
