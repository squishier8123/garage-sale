"use client";

import { useCallback, useState } from "react";
import { TimeSlotPicker } from "@/components/pickup/TimeSlotPicker";
import { MessageThread } from "@/components/pickup/MessageThread";

interface TimeSlot {
  id: string;
  start_time: string;
  end_time: string;
  selected: boolean;
  created_at: string;
}

interface TransactionClientViewProps {
  transactionId: string;
  role: "seller" | "buyer";
  guestToken: string | null;
  initialSlots: TimeSlot[];
  canConfirmPickup: boolean;
  escrowStatus: string;
}

export function TransactionClientView({
  transactionId,
  role,
  guestToken,
  initialSlots,
  canConfirmPickup,
  escrowStatus,
}: TransactionClientViewProps) {
  const [slots, setSlots] = useState<TimeSlot[]>(initialSlots);
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [isCompleted, setIsCompleted] = useState(escrowStatus === "released");

  const refetchSlots = useCallback(async () => {
    const params = new URLSearchParams();
    if (guestToken) params.set("token", guestToken);

    const endpoint =
      role === "seller"
        ? `/api/seller/transactions/${transactionId}/pickup-slots`
        : `/api/transactions/${transactionId}/pickup-slots?${params}`;

    const res = await fetch(endpoint, {
      ...(role === "seller" || !guestToken
        ? { credentials: "include" as const }
        : {}),
    });

    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data) {
        setSlots(json.data);
      }
    }
  }, [transactionId, role, guestToken]);

  const handleConfirmPickup = useCallback(async () => {
    setConfirmError(null);
    setIsConfirming(true);

    try {
      const res = await fetch(
        `/api/seller/transactions/${transactionId}/capture`,
        {
          method: "POST",
          credentials: "include",
        },
      );

      const json = await res.json();
      if (!res.ok) {
        setConfirmError(json.error || "Failed to confirm pickup");
        return;
      }

      setIsCompleted(true);
    } catch {
      setConfirmError("Network error");
    } finally {
      setIsConfirming(false);
    }
  }, [transactionId]);

  return (
    <div className="space-y-6">
      {/* Pickup time slots */}
      <TimeSlotPicker
        transactionId={transactionId}
        slots={slots}
        role={role}
        guestToken={guestToken}
        onSlotsUpdated={refetchSlots}
      />

      {/* Confirm pickup button (seller only) */}
      {canConfirmPickup && !isCompleted && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="mb-2 text-lg font-semibold text-gray-900">
            Confirm Pickup
          </h3>
          <p className="mb-3 text-sm text-gray-600">
            Mark as picked up once the buyer has collected the item. This
            releases the payment to you.
          </p>
          {confirmError && (
            <p className="mb-2 text-sm text-red-600">{confirmError}</p>
          )}
          <button
            onClick={handleConfirmPickup}
            disabled={isConfirming}
            className="w-full rounded-md bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            {isConfirming
              ? "Confirming..."
              : "Confirm Pickup — Release Payment"}
          </button>
        </div>
      )}

      {/* Completion confirmation */}
      {isCompleted && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center">
          <p className="text-sm font-medium text-green-800">
            Pickup confirmed! Payment has been released.
          </p>
        </div>
      )}

      {/* Message thread */}
      <MessageThread
        transactionId={transactionId}
        currentRole={role}
        guestToken={guestToken}
      />
    </div>
  );
}
