"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

const PAGE_SIZE = 20;

export function Pagination({ total }: { total: number }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentOffset = parseInt(searchParams.get("offset") ?? "0", 10);
  const currentPage = Math.floor(currentOffset / PAGE_SIZE) + 1;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  function goToPage(page: number) {
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      const offset = (page - 1) * PAGE_SIZE;
      if (offset > 0) {
        params.set("offset", String(offset));
      } else {
        params.delete("offset");
      }
      router.push(`/?${params.toString()}`);
    });
  }

  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-2 mt-8">
      <button
        onClick={() => goToPage(currentPage - 1)}
        disabled={currentPage <= 1 || isPending}
        className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
      >
        Previous
      </button>

      <span className="text-sm text-gray-600">
        Page {currentPage} of {totalPages}
      </span>

      <button
        onClick={() => goToPage(currentPage + 1)}
        disabled={currentPage >= totalPages || isPending}
        className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
      >
        Next
      </button>
    </div>
  );
}
