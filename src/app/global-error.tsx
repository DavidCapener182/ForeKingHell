"use client";

import "./globals.css";

import { AppErrorState } from "@/components/app/app-error-state";
import { Button } from "@/components/ui/button";
import { BRAND_NAME } from "@/lib/brand";

export default function GlobalError({
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <html lang="en">
      <body className="bg-background text-foreground">
        <main id="main-content" className="grid min-h-dvh place-items-center px-4 py-10">
          <AppErrorState
            className="w-full max-w-xl shadow-lg"
            title={`${BRAND_NAME} hit a fatal error`}
            description="The app shell could not recover automatically."
            action={
              <Button type="button" variant="destructive" onClick={unstable_retry}>
                Try again
              </Button>
            }
          />
        </main>
      </body>
    </html>
  );
}
