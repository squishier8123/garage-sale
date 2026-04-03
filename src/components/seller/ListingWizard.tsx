"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { upload } from "@vercel/blob/client";

type WizardStep = "upload" | "processing" | "review" | "publish";

interface PipelineResult {
  listing: {
    id: string;
    title: string;
    description: string | null;
    category: string | null;
    condition: string | null;
    buy_now_price: number | null;
    ai_needs_review: boolean;
    ai_review_fields: string[];
    status: string;
  };
  pipeline: {
    processing_time_ms?: number;
    needs_review?: boolean;
    review_fields?: string[];
    pricing?: {
      suggested_price_cents: number;
      price_range_low_cents: number;
      price_range_high_cents: number;
      sell_velocity: string;
      sell_velocity_estimate: string | null;
      bundle_suggestion: string | null;
      pricing_rationale: string;
    };
    errors?: Array<{ stage: string; error: string; recoverable: boolean }>;
    failed?: boolean;
    error?: string;
    message?: string;
  };
}

interface DraftFields {
  title: string;
  description: string;
  category: string;
  condition: string;
  buy_now_price: number;
  price_strategy: string;
  pickup_radius_miles: number;
}

const CONDITION_OPTIONS = [
  { value: "new", label: "New" },
  { value: "like_new", label: "Like New" },
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
  { value: "poor", label: "Poor" },
];

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function ListingWizard() {
  const router = useRouter();
  const [step, setStep] = useState<WizardStep>("upload");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [uploadProgress, setUploadProgress] = useState<string>("");
  const [pipelineResult, setPipelineResult] = useState<PipelineResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [draft, setDraft] = useState<DraftFields>({
    title: "",
    description: "",
    category: "",
    condition: "good",
    buy_now_price: 0,
    price_strategy: "buy_now",
    pickup_radius_miles: 25,
  });

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = Array.from(e.target.files ?? []);
      if (selected.length === 0) return;

      const total = files.length + selected.length;
      if (total > 8) {
        setError("Maximum 8 images allowed");
        return;
      }

      setError(null);
      const newFiles = [...files, ...selected];
      setFiles(newFiles);

      // Generate previews
      const newPreviews = selected.map((f) => URL.createObjectURL(f));
      setPreviews((prev) => [...prev, ...newPreviews]);
    },
    [files],
  );

  const removeFile = useCallback(
    (index: number) => {
      URL.revokeObjectURL(previews[index]);
      setFiles((prev) => prev.filter((_, i) => i !== index));
      setPreviews((prev) => prev.filter((_, i) => i !== index));
    },
    [previews],
  );

  async function handleUploadAndProcess() {
    if (files.length === 0) {
      setError("Please select at least one image");
      return;
    }

    setStep("processing");
    setError(null);

    try {
      // Upload files to Vercel Blob
      setUploadProgress("Uploading images...");
      const uploadedUrls: string[] = [];

      for (let i = 0; i < files.length; i++) {
        setUploadProgress(`Uploading image ${i + 1} of ${files.length}...`);
        const blob = await upload(files[i].name, files[i], {
          access: "public",
          handleUploadUrl: "/api/listings/upload",
        });
        uploadedUrls.push(blob.url);
      }

      // Trigger AI pipeline
      setUploadProgress("AI is analyzing your item...");
      const res = await fetch("/api/seller/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_urls: uploadedUrls }),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error ?? "Failed to create listing");
      }

      setPipelineResult(data.data);

      // Pre-fill draft from pipeline results
      const listing = data.data.listing;
      setDraft({
        title: listing.title ?? "",
        description: listing.description ?? "",
        category: listing.category ?? "",
        condition: listing.condition ?? "good",
        buy_now_price: listing.buy_now_price ?? 0,
        price_strategy: "buy_now",
        pickup_radius_miles: listing.pickup_radius_miles ?? 25,
      });

      setStep("review");
    } catch (err) {
      setError((err as Error).message);
      setStep("upload");
    }
  }

  async function handleSaveDraft() {
    if (!pipelineResult) return;

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/seller/listings/${pipelineResult.listing.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: draft.title,
            description: draft.description,
            category: draft.category,
            condition: draft.condition,
            buy_now_price: draft.buy_now_price,
            price_strategy: draft.price_strategy,
            pickup_radius_miles: draft.pickup_radius_miles,
          }),
        },
      );

      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      setStep("publish");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    if (!pipelineResult) return;

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/seller/listings/${pipelineResult.listing.id}/publish`,
        { method: "POST" },
      );

      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      router.push("/seller/listings");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress bar */}
      <div className="flex items-center gap-2 mb-8">
        {(["upload", "processing", "review", "publish"] as const).map(
          (s, i) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step === s
                    ? "bg-gray-900 text-white"
                    : i <
                        ["upload", "processing", "review", "publish"].indexOf(step)
                      ? "bg-green-500 text-white"
                      : "bg-gray-200 text-gray-500"
                }`}
              >
                {i + 1}
              </div>
              {i < 3 && (
                <div className="flex-1 h-0.5 bg-gray-200">
                  <div
                    className={`h-full bg-gray-900 transition-all ${
                      i <
                      ["upload", "processing", "review", "publish"].indexOf(step)
                        ? "w-full"
                        : "w-0"
                    }`}
                  />
                </div>
              )}
            </div>
          ),
        )}
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 mb-6">
          {error}
        </div>
      )}

      {/* Step 1: Upload */}
      {step === "upload" && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Upload Photos</h2>
            <p className="text-sm text-gray-500 mt-1">
              Add 1-8 photos. The first image will be used for AI analysis.
            </p>
          </div>

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
              Drop photos here or click to browse
            </p>
            <p className="text-xs text-gray-400 mt-1">
              JPEG, PNG, WebP, HEIC — max 10MB each
            </p>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
          </label>

          {previews.length > 0 && (
            <div className="grid grid-cols-4 gap-3">
              {previews.map((src, i) => (
                <div key={i} className="relative aspect-square rounded-md overflow-hidden bg-gray-100">
                  <Image
                    src={src}
                    alt={`Preview ${i + 1}`}
                    fill
                    className="object-cover"
                    sizes="150px"
                  />
                  {i === 0 && (
                    <span className="absolute top-1 left-1 text-[10px] font-medium bg-gray-900 text-white px-1.5 py-0.5 rounded">
                      Primary
                    </span>
                  )}
                  <button
                    onClick={() => removeFile(i)}
                    className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={handleUploadAndProcess}
            disabled={files.length === 0}
            className="w-full py-3 bg-gray-900 text-white font-semibold rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            Upload &amp; Analyze ({files.length} photo{files.length !== 1 ? "s" : ""})
          </button>
        </div>
      )}

      {/* Step 2: Processing */}
      {step === "processing" && (
        <div className="text-center py-16 space-y-4">
          <div className="w-12 h-12 border-4 border-gray-200 border-t-gray-900 rounded-full animate-spin mx-auto" />
          <p className="text-lg font-medium text-gray-900">{uploadProgress}</p>
          <p className="text-sm text-gray-500">
            This usually takes 5-15 seconds.
          </p>
        </div>
      )}

      {/* Step 3: Review AI Results */}
      {step === "review" && pipelineResult && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              Review AI Results
            </h2>
            {pipelineResult.pipeline.needs_review && (
              <p className="text-sm text-amber-600 mt-1">
                AI flagged some fields for review. Please verify the highlighted
                fields.
              </p>
            )}
            {pipelineResult.pipeline.processing_time_ms && (
              <p className="text-xs text-gray-400 mt-1">
                Analyzed in {(pipelineResult.pipeline.processing_time_ms / 1000).toFixed(1)}s
              </p>
            )}
          </div>

          <div className="space-y-4">
            <Field
              label="Title"
              flagged={pipelineResult.pipeline.review_fields?.includes("title")}
            >
              <input
                type="text"
                value={draft.title}
                onChange={(e) =>
                  setDraft({ ...draft, title: e.target.value })
                }
                maxLength={120}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </Field>

            <Field
              label="Description"
              flagged={pipelineResult.pipeline.review_fields?.includes("description")}
            >
              <textarea
                value={draft.description}
                onChange={(e) =>
                  setDraft({ ...draft, description: e.target.value })
                }
                rows={4}
                maxLength={2000}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field
                label="Category"
                flagged={pipelineResult.pipeline.review_fields?.includes("category")}
              >
                <input
                  type="text"
                  value={draft.category}
                  onChange={(e) =>
                    setDraft({ ...draft, category: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </Field>

              <Field
                label="Condition"
                flagged={pipelineResult.pipeline.review_fields?.includes("condition")}
              >
                <select
                  value={draft.condition}
                  onChange={(e) =>
                    setDraft({ ...draft, condition: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                >
                  {CONDITION_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            {/* Pricing */}
            <div className="border border-gray-200 rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-semibold text-gray-900">Pricing</h3>

              {pipelineResult.pipeline.pricing && (
                <div className="bg-gray-50 rounded-md p-3 text-sm space-y-1">
                  <p>
                    <span className="font-medium">AI Suggested:</span>{" "}
                    {formatPrice(pipelineResult.pipeline.pricing.suggested_price_cents)}
                  </p>
                  <p>
                    <span className="font-medium">Range:</span>{" "}
                    {formatPrice(pipelineResult.pipeline.pricing.price_range_low_cents)} –{" "}
                    {formatPrice(pipelineResult.pipeline.pricing.price_range_high_cents)}
                  </p>
                  <p>
                    <span className="font-medium">Velocity:</span>{" "}
                    {pipelineResult.pipeline.pricing.sell_velocity}
                    {pipelineResult.pipeline.pricing.sell_velocity_estimate &&
                      ` — ${pipelineResult.pipeline.pricing.sell_velocity_estimate}`}
                  </p>
                  <p className="text-xs text-gray-500">
                    {pipelineResult.pipeline.pricing.pricing_rationale}
                  </p>
                  {pipelineResult.pipeline.pricing.bundle_suggestion && (
                    <p className="text-xs text-amber-600">
                      {pipelineResult.pipeline.pricing.bundle_suggestion}
                    </p>
                  )}
                </div>
              )}

              <Field label="Your Price (cents)">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">$</span>
                  <input
                    type="number"
                    value={draft.buy_now_price / 100}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        buy_now_price: Math.round(parseFloat(e.target.value || "0") * 100),
                      })
                    }
                    min={5}
                    step={0.5}
                    className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                  {draft.buy_now_price > 0 && draft.buy_now_price < 500 && (
                    <span className="text-xs text-red-600">
                      Minimum $5.00
                    </span>
                  )}
                </div>
              </Field>

              {/* Fee preview */}
              {draft.buy_now_price >= 500 && (
                <p className="text-xs text-gray-500">
                  Platform fee: {formatPrice(Math.round(draft.buy_now_price * 0.035))} (3.5%)
                  — You receive: {formatPrice(draft.buy_now_price - Math.round(draft.buy_now_price * 0.035))}
                </p>
              )}
            </div>

            <Field label="Pickup Radius">
              <select
                value={draft.pickup_radius_miles}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    pickup_radius_miles: parseInt(e.target.value, 10),
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              >
                {[5, 10, 15, 25, 50].map((r) => (
                  <option key={r} value={r}>
                    {r} miles
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {/* Pipeline warnings */}
          {pipelineResult.pipeline.errors &&
            pipelineResult.pipeline.errors.length > 0 && (
              <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-700">
                <p className="font-medium mb-1">Pipeline warnings:</p>
                <ul className="list-disc list-inside">
                  {pipelineResult.pipeline.errors.map((err, i) => (
                    <li key={i}>
                      {err.stage}: {err.error}
                    </li>
                  ))}
                </ul>
              </div>
            )}

          <div className="flex gap-3">
            <button
              onClick={handleSaveDraft}
              disabled={saving || draft.buy_now_price < 500}
              className="flex-1 py-3 bg-gray-900 text-white font-semibold rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save & Continue"}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Publish */}
      {step === "publish" && (
        <div className="text-center space-y-6 py-8">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <svg
              className="w-8 h-8 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Ready to Publish</h2>
            <p className="text-sm text-gray-500 mt-1">
              Your listing is saved as a draft. Publish it to make it visible to buyers.
            </p>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4 text-left max-w-sm mx-auto">
            <p className="font-medium text-gray-900">{draft.title}</p>
            <p className="text-lg font-bold mt-1">
              {formatPrice(draft.buy_now_price)}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {draft.category} — {draft.condition} — {draft.pickup_radius_miles} mile radius
            </p>
          </div>

          <div className="flex gap-3 max-w-sm mx-auto">
            <button
              onClick={() => setStep("review")}
              className="flex-1 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
            >
              Edit
            </button>
            <button
              onClick={handlePublish}
              disabled={saving}
              className="flex-1 py-3 bg-gray-900 text-white font-semibold rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              {saving ? "Publishing..." : "Publish Listing"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  flagged,
  children,
}: {
  label: string;
  flagged?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {flagged && (
          <span className="ml-2 text-xs text-amber-600 font-normal">
            AI flagged — please verify
          </span>
        )}
      </label>
      {children}
    </div>
  );
}
