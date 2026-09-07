"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export function AdminCheckHistoryPages({ page, pages }: { page: number; pages: number }) {
  const search = useSearchParams();
  if (pages <= 1) return null;
  const href = (destination: number) => {
    const params = new URLSearchParams(search.toString());
    if (destination === 1) params.delete("checkPage");
    else params.set("checkPage", String(destination));
    return `/admin/system-checks${params.size ? `?${params}` : ""}#check-history`;
  };
  return (
    <nav aria-label="Check history pages" className="flex flex-wrap items-center gap-4">
      {page > 1 ? (
        <Link
          prefetch={false}
          className="inline-flex min-h-11 items-center underline"
          href={href(page - 1)}
        >
          Newer checks
        </Link>
      ) : null}
      <span>
        Page {page} of {pages}
      </span>
      {page < pages ? (
        <Link
          prefetch={false}
          className="inline-flex min-h-11 items-center underline"
          href={href(page + 1)}
        >
          Older checks
        </Link>
      ) : null}
    </nav>
  );
}
