"use client";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="text-center py-16">
      <h2 className="text-lg font-semibold text-gray-900">
        Failed to load dashboard
      </h2>
      <p className="mt-2 text-sm text-gray-500">
        Something went wrong loading your stats. Please try again.
      </p>
      <button
        onClick={reset}
        className="mt-4 px-4 py-2 bg-gray-900 text-white text-sm font-semibold rounded-lg hover:bg-gray-700 transition-colors"
      >
        Try again
      </button>
    </div>
  );
}
