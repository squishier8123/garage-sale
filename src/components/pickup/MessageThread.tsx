"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRealtimeMessages, type Message } from "@/hooks/useRealtimeMessages";

interface MessageThreadProps {
  transactionId: string;
  currentRole: "buyer" | "seller";
  guestToken: string | null;
}

function formatMessageTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  if (isToday) {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getRoleBadge(role: Message["sender_role"]) {
  switch (role) {
    case "seller":
      return { label: "Seller", className: "bg-purple-100 text-purple-700" };
    case "buyer":
      return { label: "Buyer", className: "bg-blue-100 text-blue-700" };
    case "system":
      return { label: "System", className: "bg-gray-100 text-gray-600" };
  }
}

export function MessageThread({
  transactionId,
  currentRole,
  guestToken,
}: MessageThreadProps) {
  const { messages, isConnected, isLoading, sendMessage } =
    useRealtimeMessages(transactionId, guestToken);

  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  const handleSend = useCallback(async () => {
    const body = draft.trim();
    if (!body || isSending) return;

    setSendError(null);
    setIsSending(true);
    try {
      await sendMessage(body);
      setDraft("");
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setIsSending(false);
    }
  }, [draft, isSending, sendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  return (
    <div className="flex flex-col rounded-lg border border-gray-200 bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <h3 className="text-lg font-semibold text-gray-900">Messages</h3>
        <div className="flex items-center gap-1.5">
          <div
            className={`h-2 w-2 rounded-full ${
              isConnected ? "bg-green-500" : "bg-gray-300"
            }`}
          />
          <span className="text-xs text-gray-500">
            {isConnected ? "Live" : "Polling"}
          </span>
        </div>
      </div>

      {/* Messages list */}
      <div
        ref={scrollRef}
        className="flex-1 space-y-3 overflow-y-auto px-4 py-3"
        style={{ maxHeight: "400px", minHeight: "200px" }}
      >
        {isLoading && (
          <p className="text-center text-sm text-gray-400">
            Loading messages...
          </p>
        )}

        {!isLoading && messages.length === 0 && (
          <p className="text-center text-sm text-gray-400">
            No messages yet. Start the conversation about pickup details.
          </p>
        )}

        {messages.map((msg) => {
          const isOwn = msg.sender_role === currentRole;
          const badge = getRoleBadge(msg.sender_role);

          if (msg.sender_role === "system") {
            return (
              <div
                key={msg.id}
                className="mx-auto max-w-[80%] rounded-md bg-gray-50 px-3 py-2 text-center text-sm text-gray-600"
              >
                {msg.body}
              </div>
            );
          }

          return (
            <div
              key={msg.id}
              className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[75%] rounded-lg px-3 py-2 ${
                  isOwn
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-900"
                }`}
              >
                {!isOwn && (
                  <span
                    className={`mb-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
                  >
                    {badge.label}
                  </span>
                )}
                <p className="whitespace-pre-wrap text-sm">{msg.body}</p>
                <p
                  className={`mt-1 text-xs ${
                    isOwn ? "text-blue-200" : "text-gray-400"
                  }`}
                >
                  {formatMessageTime(msg.created_at)}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 px-4 py-3">
        {sendError && (
          <p className="mb-2 text-xs text-red-600">{sendError}</p>
        )}
        <div className="flex gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message... (Enter to send)"
            maxLength={2000}
            rows={1}
            className="flex-1 resize-none rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
          <button
            onClick={handleSend}
            disabled={!draft.trim() || isSending}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isSending ? "..." : "Send"}
          </button>
        </div>
        <p className="mt-1 text-right text-xs text-gray-400">
          {draft.length}/2000
        </p>
      </div>
    </div>
  );
}
