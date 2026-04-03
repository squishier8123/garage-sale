"use client";

import { useCallback, useState } from "react";

interface TimeSlot {
  id: string;
  start_time: string;
  end_time: string;
  selected: boolean;
  created_at: string;
}

interface TimeSlotPickerProps {
  transactionId: string;
  slots: TimeSlot[];
  role: "seller" | "buyer";
  guestToken: string | null;
  onSlotsUpdated: () => void;
}

function formatSlotTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Seller creates pickup time windows; buyer selects one.
 */
export function TimeSlotPicker({
  transactionId,
  slots,
  role,
  guestToken,
  onSlotsUpdated,
}: TimeSlotPickerProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Seller: new slot form state
  const [newSlots, setNewSlots] = useState<
    Array<{ date: string; startTime: string; endTime: string }>
  >([{ date: "", startTime: "", endTime: "" }]);

  const selectedSlot = slots.find((s) => s.selected);

  const addSlotRow = useCallback(() => {
    if (newSlots.length >= 10) return;
    setNewSlots((prev) => [...prev, { date: "", startTime: "", endTime: "" }]);
  }, [newSlots.length]);

  const removeSlotRow = useCallback((index: number) => {
    setNewSlots((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateSlotRow = useCallback(
    (index: number, field: "date" | "startTime" | "endTime", value: string) => {
      setNewSlots((prev) =>
        prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
      );
    },
    [],
  );

  // Seller: submit new time slots
  const handleCreateSlots = useCallback(async () => {
    setError(null);
    const parsedSlots = newSlots
      .filter((s) => s.date && s.startTime && s.endTime)
      .map((s) => ({
        start_time: new Date(`${s.date}T${s.startTime}`).toISOString(),
        end_time: new Date(`${s.date}T${s.endTime}`).toISOString(),
      }));

    if (parsedSlots.length === 0) {
      setError("Add at least one complete time slot");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(
        `/api/seller/transactions/${transactionId}/pickup-slots`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slots: parsedSlots }),
          credentials: "include",
        },
      );

      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Failed to create slots");
        return;
      }

      setNewSlots([{ date: "", startTime: "", endTime: "" }]);
      onSlotsUpdated();
    } catch {
      setError("Network error");
    } finally {
      setIsSubmitting(false);
    }
  }, [transactionId, newSlots, onSlotsUpdated]);

  // Buyer: select a time slot
  const handleSelectSlot = useCallback(
    async (slotId: string) => {
      setError(null);
      setIsSubmitting(true);

      try {
        const params = new URLSearchParams();
        if (guestToken) params.set("token", guestToken);

        const res = await fetch(
          `/api/transactions/${transactionId}/pickup-slots/select?${params}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ slot_id: slotId }),
            ...(guestToken ? {} : { credentials: "include" as const }),
          },
        );

        const json = await res.json();
        if (!res.ok) {
          setError(json.error || "Failed to select slot");
          return;
        }

        onSlotsUpdated();
      } catch {
        setError("Network error");
      } finally {
        setIsSubmitting(false);
      }
    },
    [transactionId, guestToken, onSlotsUpdated],
  );

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h3 className="mb-3 text-lg font-semibold text-gray-900">
        Pickup Time
      </h3>

      {error && (
        <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Show confirmed slot */}
      {selectedSlot && (
        <div className="mb-4 rounded-md bg-green-50 px-4 py-3">
          <p className="text-sm font-medium text-green-800">
            Pickup confirmed
          </p>
          <p className="text-sm text-green-700">
            {formatSlotTime(selectedSlot.start_time)} –{" "}
            {formatSlotTime(selectedSlot.end_time).split(", ").pop()}
          </p>
        </div>
      )}

      {/* Buyer: select from available slots */}
      {role === "buyer" && !selectedSlot && slots.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-gray-600">
            Choose a pickup time:
          </p>
          {slots.map((slot) => (
            <button
              key={slot.id}
              onClick={() => handleSelectSlot(slot.id)}
              disabled={isSubmitting}
              className="flex w-full items-center justify-between rounded-md border border-gray-200 px-4 py-3 text-left transition-colors hover:border-blue-400 hover:bg-blue-50 disabled:opacity-50"
            >
              <span className="text-sm text-gray-900">
                {formatSlotTime(slot.start_time)} –{" "}
                {formatSlotTime(slot.end_time).split(", ").pop()}
              </span>
              <span className="text-xs font-medium text-blue-600">
                Select
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Buyer: waiting for seller to add slots */}
      {role === "buyer" && !selectedSlot && slots.length === 0 && (
        <p className="text-sm text-gray-500">
          Waiting for seller to offer pickup times...
        </p>
      )}

      {/* Seller: existing slots list */}
      {role === "seller" && slots.length > 0 && !selectedSlot && (
        <div className="mb-4 space-y-1">
          <p className="text-sm text-gray-600">
            Offered times (waiting for buyer):
          </p>
          {slots.map((slot) => (
            <div
              key={slot.id}
              className="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700"
            >
              {formatSlotTime(slot.start_time)} –{" "}
              {formatSlotTime(slot.end_time).split(", ").pop()}
            </div>
          ))}
        </div>
      )}

      {/* Seller: create new slots form */}
      {role === "seller" && !selectedSlot && (
        <div className="space-y-3">
          {slots.length === 0 && (
            <p className="text-sm text-gray-600">
              Offer pickup time windows for the buyer:
            </p>
          )}

          {newSlots.map((slot, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input
                type="date"
                value={slot.date}
                onChange={(e) => updateSlotRow(idx, "date", e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                min={new Date().toISOString().split("T")[0]}
              />
              <input
                type="time"
                value={slot.startTime}
                onChange={(e) => updateSlotRow(idx, "startTime", e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
              <span className="text-gray-400">–</span>
              <input
                type="time"
                value={slot.endTime}
                onChange={(e) => updateSlotRow(idx, "endTime", e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
              {newSlots.length > 1 && (
                <button
                  onClick={() => removeSlotRow(idx)}
                  className="text-sm text-red-500 hover:text-red-700"
                >
                  ✕
                </button>
              )}
            </div>
          ))}

          <div className="flex gap-2">
            <button
              onClick={addSlotRow}
              disabled={newSlots.length >= 10}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              + Add time
            </button>
            <button
              onClick={handleCreateSlots}
              disabled={isSubmitting}
              className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? "Saving..." : "Offer times"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
