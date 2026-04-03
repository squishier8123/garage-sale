"use client";

import { useCallback, useState } from "react";

interface BuyNowButtonProps {
  listingId: string;
  buyNowPrice: number;
  disabled?: boolean;
}

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function BuyNowButton({
  listingId,
  buyNowPrice,
  disabled,
}: BuyNowButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleBuyNow = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listing_id: listingId,
          type: "buy_now",
        }),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error ?? "Failed to start checkout");
        return;
      }

      // Redirect to Stripe Checkout
      if (data.data?.checkout_url) {
        window.location.href = data.data.checkout_url;
      }
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }, [listingId]);

  return (
    <div>
      <button
        onClick={handleBuyNow}
        disabled={disabled || loading}
        className="w-full py-3 px-4 bg-gray-900 text-white font-semibold rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
      >
        {loading ? "Starting checkout..." : `Buy Now — ${formatPrice(buyNowPrice)}`}
      </button>
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </div>
  );
}
