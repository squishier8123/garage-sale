"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";

interface QueueItem {
  file: File;
  preview: string;
  status: "pending" | "uploading" | "analyzing" | "done" | "error";
  progress: string;
  result?: {
    listingId: string;
    title: string;
    price: number;
    needsReview: boolean;
  };
  error?: string;
}

const MAX_CONCURRENT = 3;

export function BulkUploadQueue() {
  const router = useRouter();
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [processing, setProcessing] = useState(false);
  const activeCount = useRef(0);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = Array.from(e.target.files ?? []);
      if (selected.length === 0) return;

      const newItems: QueueItem[] = selected.map((file) => ({
        file,
        preview: URL.createObjectURL(file),
        status: "pending",
        progress: "Waiting...",
      }));

      setQueue((prev) => [...prev, ...newItems]);
    },
    [],
  );

  const updateItem = useCallback(
    (index: number, update: Partial<QueueItem>) => {
      setQueue((prev) =>
        prev.map((item, i) => (i === index ? { ...item, ...update } : item)),
      );
    },
    [],
  );

  async function processItem(index: number) {
    const item = queue[index];
    if (!item || item.status !== "pending") return;

    activeCount.current++;

    try {
      // Upload
      updateItem(index, { status: "uploading", progress: "Uploading..." });

      const blob = await upload(item.file.name, item.file, {
        access: "public",
        handleUploadUrl: "/api/listings/upload",
      });

      // Analyze
      updateItem(index, { status: "analyzing", progress: "AI analyzing..." });

      const res = await fetch("/api/seller/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_urls: [blob.url] }),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error ?? "Pipeline failed");
      }

      updateItem(index, {
        status: "done",
        progress: "Ready for review",
        result: {
          listingId: data.data.listing.id,
          title: data.data.listing.title ?? "Untitled",
          price: data.data.listing.buy_now_price ?? 0,
          needsReview: data.data.pipeline.needs_review ?? false,
        },
      });
    } catch (err) {
      updateItem(index, {
        status: "error",
        progress: "Failed",
        error: (err as Error).message,
      });
    } finally {
      activeCount.current--;
    }
  }

  async function startProcessing() {
    setProcessing(true);

    const pending = queue
      .map((item, i) => ({ item, index: i }))
      .filter(({ item }) => item.status === "pending");

    // Process with concurrency limit
    const promises: Promise<void>[] = [];
    for (const { index } of pending) {
      // Wait if we're at max concurrency
      while (activeCount.current >= MAX_CONCURRENT) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
      promises.push(processItem(index));
    }

    await Promise.allSettled(promises);
    setProcessing(false);
  }

  async function publishAll() {
    const doneItems = queue.filter(
      (item) => item.status === "done" && item.result && !item.result.needsReview,
    );

    for (const item of doneItems) {
      if (!item.result) continue;
      await fetch(`/api/seller/listings/${item.result.listingId}/publish`, {
        method: "POST",
      });
    }

    router.push("/seller/listings");
    router.refresh();
  }

  const doneCount = queue.filter((q) => q.status === "done").length;
  const errorCount = queue.filter((q) => q.status === "error").length;
  const reviewCount = queue.filter(
    (q) => q.status === "done" && q.result?.needsReview,
  ).length;
  const cleanCount = doneCount - reviewCount;

  return (
    <div className="space-y-6">
      {/* Drop zone */}
      <label className="block border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-gray-400 transition-colors">
        <svg
          className="mx-auto w-12 h-12 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z"
          />
        </svg>
        <p className="mt-2 text-sm text-gray-600">
          Drop multiple photos — one per item
        </p>
        <p className="text-xs text-gray-400 mt-1">
          Each photo becomes a separate listing
        </p>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
      </label>

      {/* Queue */}
      {queue.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              {queue.length} item{queue.length !== 1 ? "s" : ""} queued
              {doneCount > 0 && ` — ${doneCount} done`}
              {errorCount > 0 && ` — ${errorCount} failed`}
            </p>

            {!processing && queue.some((q) => q.status === "pending") && (
              <button
                onClick={startProcessing}
                className="px-4 py-2 bg-gray-900 text-white text-sm font-semibold rounded-lg hover:bg-gray-700"
              >
                Process All
              </button>
            )}
          </div>

          <div className="space-y-2">
            {queue.map((item, index) => (
              <div
                key={index}
                className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg"
              >
                <div className="w-12 h-12 rounded-md overflow-hidden bg-gray-100 shrink-0 relative">
                  <Image
                    src={item.preview}
                    alt={`Item ${index + 1}`}
                    fill
                    className="object-cover"
                    sizes="48px"
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {item.result?.title ?? item.file.name}
                  </p>
                  <p
                    className={`text-xs mt-0.5 ${
                      item.status === "error"
                        ? "text-red-600"
                        : item.status === "done"
                          ? "text-green-600"
                          : "text-gray-500"
                    }`}
                  >
                    {item.status === "error" ? item.error : item.progress}
                  </p>
                </div>

                {item.result && (
                  <p className="text-sm font-bold text-gray-900 shrink-0">
                    ${(item.result.price / 100).toFixed(2)}
                  </p>
                )}

                {item.result?.needsReview && (
                  <span className="text-xs text-amber-600 font-medium shrink-0">
                    Review
                  </span>
                )}

                {(item.status === "uploading" || item.status === "analyzing") && (
                  <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin shrink-0" />
                )}
              </div>
            ))}
          </div>

          {/* Batch actions */}
          {doneCount > 0 && !processing && (
            <div className="flex gap-3">
              {cleanCount > 0 && (
                <button
                  onClick={publishAll}
                  className="flex-1 py-3 bg-gray-900 text-white font-semibold rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Publish {cleanCount} Clean Item{cleanCount !== 1 ? "s" : ""}
                </button>
              )}
              {reviewCount > 0 && (
                <button
                  onClick={() => {
                    router.push("/seller/listings");
                    router.refresh();
                  }}
                  className="flex-1 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Review {reviewCount} Flagged Item{reviewCount !== 1 ? "s" : ""}
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
