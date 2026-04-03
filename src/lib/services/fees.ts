/**
 * Fee calculation for Garage Sale transactions.
 * All amounts in cents (integers).
 */

const PLATFORM_FEE_RATE = 0.035; // 3.5%

// Stripe fee estimate (US domestic cards): 2.9% + 30¢
const STRIPE_PERCENT_RATE = 0.029;
const STRIPE_FIXED_FEE = 30; // cents

export interface FeeBreakdown {
  /** Item sale price in cents */
  item_price: number;
  /** 3.5% platform fee in cents */
  platform_fee: number;
  /** Platform fee rate (0.035) */
  platform_fee_rate: number;
  /** Estimated Stripe processing fee in cents */
  stripe_fee_estimate: number;
  /** Total charged to buyer: item_price + platform_fee */
  total_charged: number;
  /** Estimated net to seller: item_price - stripe_fee_estimate */
  seller_net_estimate: number;
}

export function calculateFees(itemPriceCents: number): FeeBreakdown {
  const platformFee = Math.round(itemPriceCents * PLATFORM_FEE_RATE);
  const totalCharged = itemPriceCents + platformFee;

  // Stripe charges their fee on the total amount processed
  const stripeFeeEstimate =
    Math.round(totalCharged * STRIPE_PERCENT_RATE) + STRIPE_FIXED_FEE;

  // Seller gets item price minus Stripe's processing fee
  // (platform fee is added on top, paid by buyer)
  const sellerNetEstimate = itemPriceCents - stripeFeeEstimate;

  return {
    item_price: itemPriceCents,
    platform_fee: platformFee,
    platform_fee_rate: PLATFORM_FEE_RATE,
    stripe_fee_estimate: stripeFeeEstimate,
    total_charged: totalCharged,
    seller_net_estimate: Math.max(sellerNetEstimate, 0),
  };
}

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
