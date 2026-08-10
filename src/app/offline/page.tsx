import Link from "next/link";

import { Button } from "@/components/ui/button";
import { BRAND_NAME } from "@/lib/brand";

export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <main className="ios-public-auth grid min-h-dvh place-items-center bg-background px-[max(1rem,env(safe-area-inset-left))] py-[max(2.5rem,env(safe-area-inset-top))] pb-[max(2.5rem,env(safe-area-inset-bottom))] text-foreground">
      <section className="w-full max-w-lg overflow-hidden rounded-[var(--ios-radius,0.875rem)] bg-card">
        <div className="px-5 py-5">
          <p className="text-[13px] font-semibold text-primary">Connection unavailable</p>
          <h1 className="mt-2 text-[2rem] font-bold leading-tight tracking-[-0.025em]">
            {BRAND_NAME} is offline
          </h1>
          <p className="mt-2 text-[15px] leading-6 text-muted-foreground">
            Private golf data is not cached for offline page viewing. Reconnect to load your
            dashboard, shots, rounds and account pages.
          </p>
        </div>
        <div className="grid border-t border-border sm:grid-cols-2">
          <Button asChild className="min-h-12 rounded-none border-0 shadow-none">
            <Link href="/today" prefetch={false}>
              Try again
            </Link>
          </Button>
          <Button asChild variant="ghost" className="min-h-12 rounded-none border-0 shadow-none">
            <Link href="/privacy" prefetch={false}>
              Privacy
            </Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
