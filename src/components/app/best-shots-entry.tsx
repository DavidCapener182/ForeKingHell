import Link from "next/link";
import { ArrowUpRight, Trophy } from "lucide-react";

export function BestShotsEntry() {
  return (
    <Link
      href="/bag/longest"
      prefetch={false}
      className="group flex min-h-24 items-center gap-4 rounded-2xl border border-primary/25 bg-card px-5 py-4 outline-none focus-visible:ring-2 focus-visible:ring-ring"
      data-best-shots-entry
    >
      <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <Trophy className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-lg font-semibold tracking-tight">Best shots by club</span>
        <span className="mt-1 block text-sm text-muted-foreground">
          Your longest carry. Your longest total. The shot behind each record.
        </span>
      </span>
      <ArrowUpRight className="size-5 shrink-0 text-primary" aria-hidden />
    </Link>
  );
}
