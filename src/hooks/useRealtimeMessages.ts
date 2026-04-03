"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export interface Message {
  id: string;
  sender_role: "buyer" | "seller" | "system";
  body: string;
  created_at: string;
  read_at: string | null;
}

interface MessageState {
  messages: Message[];
  isConnected: boolean;
  isLoading: boolean;
}

const POLL_INTERVAL_MS = 10_000;

/**
 * Realtime messages subscription for a transaction thread.
 * Uses guest token for API fetch (since guest buyers can't use RLS),
 * and Supabase Realtime for live updates.
 */
export function useRealtimeMessages(
  transactionId: string,
  guestToken: string | null,
) {
  const [state, setState] = useState<MessageState>({
    messages: [],
    isConnected: false,
    isLoading: true,
  });

  const channelRef = useRef<RealtimeChannel | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchMessages = useCallback(async () => {
    const params = new URLSearchParams();
    if (guestToken) params.set("token", guestToken);

    const res = await fetch(
      `/api/transactions/${transactionId}/messages?${params}`,
      guestToken
        ? {}
        : { credentials: "include" },
    );

    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data) {
        setState((prev) => ({
          ...prev,
          messages: json.data as Message[],
          isLoading: false,
        }));
      }
    } else {
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, [transactionId, guestToken]);

  useEffect(() => {
    fetchMessages();

    const supabase = createClient();

    // Subscribe to realtime inserts on messages for this transaction
    const channel = supabase
      .channel(`messages:${transactionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `transaction_id=eq.${transactionId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          setState((prev) => ({
            ...prev,
            messages: [...prev.messages, newMsg],
          }));
        },
      )
      .subscribe((status) => {
        const connected = status === "SUBSCRIBED";
        setState((prev) => ({ ...prev, isConnected: connected }));

        if (!connected) {
          if (!pollTimerRef.current) {
            pollTimerRef.current = setInterval(fetchMessages, POLL_INTERVAL_MS);
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
  }, [transactionId, fetchMessages]);

  const sendMessage = useCallback(
    async (body: string) => {
      const params = new URLSearchParams();
      if (guestToken) params.set("token", guestToken);

      const res = await fetch(
        `/api/transactions/${transactionId}/messages?${params}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body }),
          ...(guestToken ? {} : { credentials: "include" as const }),
        },
      );

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed to send message");
      }

      // Realtime will pick up the new message, but also add optimistically
      const json = await res.json();
      if (json.success && json.data) {
        setState((prev) => ({
          ...prev,
          messages: [...prev.messages, json.data as Message],
        }));
      }
    },
    [transactionId, guestToken],
  );

  return { ...state, sendMessage, refetch: fetchMessages };
}
