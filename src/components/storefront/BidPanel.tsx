"use client";

import { useCallback, useEffect, useState } from "react";
import { useRealtimeBids } from "@/hooks/useRealtimeBids";

interface BidPanelProps {
  listingId: string;
  auctionEndsAt: string;
  floorPrice: number;
  initialBidCount: number;
  initialCurrentBid: number | null;
}

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function getMinBid(currentBid: number | null, floorPrice: number): number {
  if (currentBid == null) return floorPrice;
  // Minimum increment: $1 for items under $100, $5 for items $100+
  const increment = currentBid < 10000 ? 100 : 500;
  return currentBid + increment;
}

function formatTimeLeft(endsAt: string): string {
  const diff = new Date(endsAt).getTime() - Date.now();
  if (diff <= 0) return "Ended";

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export function BidPanel({
  listingId,
  auctionEndsAt,
  floorPrice,
  initialBidCount,
  initialCurrentBid,
}: BidPanelProps) {
  const { bids, currentBid, bidCount, isConnected } = useRealtimeBids(
    listingId,
    initialBidCount,
  );

  const activeBid = currentBid ?? initialCurrentBid;
  const activeBidCount = bidCount > initialBidCount ? bidCount : initialBidCount;
  const minBid = getMinBid(activeBid, floorPrice);

  const [bidAmount, setBidAmount] = useState(minBid);
  const [bidderEmail, setBidderEmail] = useState("");
  const [bidderName, setBidderName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(formatTimeLeft(auctionEndsAt));

  // Keep minBid in sync when currentBid changes
  useEffect(() => {
    setBidAmount((prev) => Math.max(prev, minBid));
  }, [minBid]);

  // Countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(formatTimeLeft(auctionEndsAt));
    }, 1000);
    return () => clearInterval(timer);
  }, [auctionEndsAt]);

  const isEnded = new Date(auctionEndsAt).getTime() <= Date.now();

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setSuccess(null);
      setSubmitting(true);

      try {
        const res = await fetch("/api/bids", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            listing_id: listingId,
            bidder_email: bidderEmail,
            bidder_name: bidderName || undefined,
            amount: bidAmount,
          }),
        });

        const data = await res.json();

        if (!data.success) {
          setError(data.error ?? "Failed to place bid");
        } else {
          setSuccess(`Bid of ${formatPrice(bidAmount)} placed!`);
          setBidAmount(getMinBid(bidAmount, floorPrice));
        }
      } catch {
        setError("Network error — please try again");
      } finally {
        setSubmitting(false);
      }
    },
    [listingId, bidderEmail, bidderName, bidAmount, floorPrice],
  );

  return (
    <div className="border border-gray-200 rounded-lg p-5 space-y-4">
      {/* Auction header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-3xl font-bold text-gray-900">
            {activeBid != null ? formatPrice(activeBid) : formatPrice(floorPrice)}
          </p>
          <p className="text-sm text-gray-500 mt-0.5">
            {activeBid != null
              ? `Current bid (${activeBidCount} bid${activeBidCount !== 1 ? "s" : ""})`
              : "Starting price — no bids yet"}
          </p>
        </div>

        <div className="text-right">
          <p
            className={`text-lg font-semibold ${
              isEnded
                ? "text-red-600"
                : timeLeft.endsWith("s")
                  ? "text-red-600 animate-pulse"
                  : "text-gray-900"
            }`}
          >
            {timeLeft}
          </p>
          <p className="text-xs text-gray-500">
            {isEnded ? "Auction ended" : "Time left"}
          </p>
        </div>
      </div>

      {/* Connection indicator */}
      <div className="flex items-center gap-1.5">
        <span
          className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-yellow-500"}`}
        />
        <span className="text-xs text-gray-400">
          {isConnected ? "Live updates" : "Polling for updates"}
        </span>
      </div>

      {/* Bid form */}
      {!isEnded && (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Your Bid
            </label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">$</span>
              <input
                type="number"
                value={bidAmount / 100}
                onChange={(e) =>
                  setBidAmount(
                    Math.round(parseFloat(e.target.value || "0") * 100),
                  )
                }
                min={minBid / 100}
                step={1}
                className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
              <span className="text-xs text-gray-400">
                Min: {formatPrice(minBid)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Email *
              </label>
              <input
                type="email"
                value={bidderEmail}
                onChange={(e) => setBidderEmail(e.target.value)}
                required
                placeholder="you@email.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Name
              </label>
              <input
                type="text"
                value={bidderName}
                onChange={(e) => setBidderName(e.target.value)}
                placeholder="Optional"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
          {success && (
            <p className="text-sm text-green-600">{success}</p>
          )}

          <button
            type="submit"
            disabled={submitting || bidAmount < minBid || !bidderEmail}
            className="w-full py-3 border-2 border-gray-900 text-gray-900 font-semibold rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {submitting ? "Placing bid..." : `Place Bid — ${formatPrice(bidAmount)}`}
          </button>
        </form>
      )}

      {isEnded && activeBid != null && (
        <div className="bg-gray-50 rounded-md p-3 text-center">
          <p className="text-sm font-medium text-gray-900">
            Sold for {formatPrice(activeBid)}
          </p>
        </div>
      )}

      {/* Recent bid history */}
      {bids.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-500 mb-2">
            Recent Bids
          </p>
          <ul className="space-y-1">
            {bids.slice(0, 5).map((bid) => (
              <li
                key={bid.id}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-gray-600">
                  {bid.bidder_name ?? bid.bidder_email.split("@")[0]}
                </span>
                <span className="font-medium text-gray-900">
                  {formatPrice(bid.amount)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
