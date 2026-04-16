"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

interface PaginationProps {
  totalItems: number;
  pageSize: number;
  currentPage: number;
  className?: string;
}

function buildHref(searchParams: URLSearchParams, page: number): string {
  const params = new URLSearchParams(searchParams);
  if (page <= 1) {
    params.delete("page");
  } else {
    params.set("page", String(page));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "?";
}

export function Pagination({
  totalItems,
  pageSize,
  currentPage,
  className,
}: PaginationProps) {
  const searchParams = useSearchParams();
  const totalPages = Math.ceil(totalItems / pageSize);

  if (totalPages <= 1) return null;

  const pages: (number | "...")[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (
      i === 1 ||
      i === totalPages ||
      (i >= currentPage - 1 && i <= currentPage + 1)
    ) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== "...") {
      pages.push("...");
    }
  }

  return (
    <nav
      className={cn("flex items-center justify-center gap-1", className)}
      aria-label="Pagination"
    >
      <Link
        href={buildHref(searchParams, currentPage - 1)}
        className={cn(
          "inline-flex items-center justify-center h-8 w-8 rounded-lg text-sm transition-colors",
          currentPage <= 1
            ? "pointer-events-none text-on-surface/20"
            : "text-on-surface/60 hover:bg-surface-container-high",
        )}
        aria-disabled={currentPage <= 1}
        tabIndex={currentPage <= 1 ? -1 : undefined}
      >
        <span className="material-symbols-outlined text-[18px]">
          chevron_left
        </span>
      </Link>

      {pages.map((page, i) =>
        page === "..." ? (
          <span
            key={`ellipsis-${i}`}
            className="inline-flex items-center justify-center h-8 w-8 text-sm text-on-surface/40"
          >
            ...
          </span>
        ) : (
          <Link
            key={page}
            href={buildHref(searchParams, page)}
            className={cn(
              "inline-flex items-center justify-center h-8 w-8 rounded-lg text-sm font-medium transition-colors",
              page === currentPage
                ? "bg-primary text-on-primary"
                : "text-on-surface/60 hover:bg-surface-container-high",
            )}
            aria-current={page === currentPage ? "page" : undefined}
          >
            {page}
          </Link>
        ),
      )}

      <Link
        href={buildHref(searchParams, currentPage + 1)}
        className={cn(
          "inline-flex items-center justify-center h-8 w-8 rounded-lg text-sm transition-colors",
          currentPage >= totalPages
            ? "pointer-events-none text-on-surface/20"
            : "text-on-surface/60 hover:bg-surface-container-high",
        )}
        aria-disabled={currentPage >= totalPages}
        tabIndex={currentPage >= totalPages ? -1 : undefined}
      >
        <span className="material-symbols-outlined text-[18px]">
          chevron_right
        </span>
      </Link>

      <span className="ml-3 text-xs text-on-surface/40">
        {totalItems} total
      </span>
    </nav>
  );
}
