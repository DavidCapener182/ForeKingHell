import Link from "next/link";

import { Button } from "@/components/ui/button";
import { BRAND_NAME } from "@/lib/brand";

export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#F5F8F3] px-4 py-10 text-[#050505]">
      <section className="w-full max-w-lg rounded-lg border border-[#DCE6DA] bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[#0B7A3B]">Offline</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-normal">{BRAND_NAME} is offline</h1>
        <p className="mt-3 text-sm leading-6 text-[#5F6672]">
          Private golf data is not cached for offline page viewing. Reconnect to load your
          dashboard, shots, rounds and account pages.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button asChild className="rounded-lg bg-[#0B7A3B] text-white hover:bg-[#064E3B]">
            <Link href="/login" prefetch={false}>
              Login
            </Link>
          </Button>
          <Button asChild variant="outline" className="rounded-lg">
            <Link href="/privacy" prefetch={false}>
              Privacy
            </Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
