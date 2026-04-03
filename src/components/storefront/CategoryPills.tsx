"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

const CATEGORIES = [
  "Electronics",
  "Furniture",
  "Clothing",
  "Kitchen",
  "Tools",
  "Sports",
  "Toys",
  "Books",
  "Home Decor",
  "Automotive",
] as const;

export function CategoryPills() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const activeCategory = searchParams.get("category");

  function handleCategoryClick(category: string | null) {
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (category) {
        params.set("category", category);
      } else {
        params.delete("category");
      }
      params.delete("offset");
      router.push(`/?${params.toString()}`);
    });
  }

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
      <button
        onClick={() => handleCategoryClick(null)}
        className={`shrink-0 px-3 py-1.5 text-sm rounded-full border transition-colors ${
          !activeCategory
            ? "bg-gray-900 text-white border-gray-900"
            : "border-gray-300 text-gray-600 hover:bg-gray-50"
        }`}
      >
        All
      </button>
      {CATEGORIES.map((category) => (
        <button
          key={category}
          onClick={() => handleCategoryClick(category)}
          disabled={isPending}
          className={`shrink-0 px-3 py-1.5 text-sm rounded-full border transition-colors ${
            activeCategory === category
              ? "bg-gray-900 text-white border-gray-900"
              : "border-gray-300 text-gray-600 hover:bg-gray-50"
          }`}
        >
          {category}
        </button>
      ))}
    </div>
  );
}
