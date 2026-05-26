"use client";

import "./globals.css";
import { BRAND_NAME } from "@/lib/brand";

export default function GlobalError({
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <main className="grid min-h-screen place-items-center px-4 py-10">
          <section className="premium-card max-w-xl p-6 text-center">
            <h1 className="text-3xl font-semibold tracking-normal">
              {BRAND_NAME} hit a fatal error
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              The app shell could not recover automatically.
            </p>
            <button
              type="button"
              onClick={() => unstable_retry()}
              className="mt-5 inline-flex h-10 items-center justify-center rounded-lg bg-[#111827] px-4 text-sm font-medium text-white"
            >
              Try again
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
