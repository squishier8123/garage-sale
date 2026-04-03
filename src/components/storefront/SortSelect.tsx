"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

const SORT_OPTIONS = [
  { value: "distance", label: "Nearest" },
  { value: "newest", label: "Newest" },
  { value: "price_low", label: "Price: Low" },
  { value: "price_high", label: "Price: High" },
  { value: "ending_soon", label: "Ending Soon" },
] as const;

export function SortSelect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const currentSort = searchParams.get("sort") ?? "distance";

  function handleChange(value: string) {
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("sort", value);
      params.delete("offset");
      router.push(`/?${params.toString()}`);
    });
  }

  return (
    <select
      value={currentSort}
      onChange={(e) => handleChange(e.target.value)}
      className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-gray-900"
    >
      {SORT_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
