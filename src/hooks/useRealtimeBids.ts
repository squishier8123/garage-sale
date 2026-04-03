"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface Bid {
  id: string;
  listing_id: string;
  bidder_email: string;
  bidder_name: string | null;
  amount: number;
  is_winning: boolean;
  created_at: string;
}

interface BidState {
  bids: Bid[];
  currentBid: number | null;
  bidCount: number;
  isConnected: boolean;
}

const POLL_INTERVAL_MS = 15_000;

export function useRealtimeBids(listingId: string, initialBidCount: number) {
  const [state, setState] = useState<BidState>({
    bids: [],
    currentBid: null,
    bidCount: initialBidCount,
    isConnected: false,
  });

  const channelRef = useRef<RealtimeChannel | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const supabase = createClient();

    // Fetch initial bids
    async function fetchBids() {
      const { data } = await supabase
        .from("bids")
        .select("*")
        .eq("listing_id", listingId)
        .order("amount", { ascending: false })
        .limit(20);

      if (data && data.length > 0) {
        setState((prev) => ({
          ...prev,
          bids: data as Bid[],
          currentBid: (data[0] as Bid).amount,
          bidCount: data.length,
        }));
      }
    }

    fetchBids();

    // Subscribe to realtime inserts on bids table for this listing
    const channel = supabase
      .channel(`bids:${listingId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "bids",
          filter: `listing_id=eq.${listingId}`,
        },
        (payload) => {
          const newBid = payload.new as Bid;
          setState((prev) => ({
            ...prev,
            bids: [newBid, ...prev.bids].slice(0, 20),
            currentBid:
              newBid.amount > (prev.currentBid ?? 0)
                ? newBid.amount
                : prev.currentBid,
            bidCount: prev.bidCount + 1,
          }));
        },
      )
      .subscribe((status) => {
        const connected = status === "SUBSCRIBED";
        setState((prev) => ({ ...prev, isConnected: connected }));

        // Polling fallback when WebSocket drops
        if (!connected) {
          if (!pollTimerRef.current) {
            pollTimerRef.current = setInterval(fetchBids, POLL_INTERVAL_MS);
          }
        } else {
          if (pollTimerRef.current) {
            clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
          }
        }
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [listingId]);

  return state;
}
