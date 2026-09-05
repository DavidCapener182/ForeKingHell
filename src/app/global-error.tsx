"use client";

import "./globals.css";

import { AppErrorState } from "@/components/app/app-error-state";
import { Button } from "@/components/ui/button";
import { BRAND_NAME } from "@/lib/brand";

export default function GlobalError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="en">
      <body className="bg-background text-foreground">
        <main id="main-content" className="grid min-h-dvh place-items-center px-4 py-10">
          <AppErrorState
            className="w-full"
            title={<h1>{BRAND_NAME} could not open</h1>}
            description="Try again to reopen the app."
            action={
              <Button type="button" variant="destructive" className="min-h-11" onClick={retry}>
                Try again
              </Button>
            }
          />
        </main>
      </body>
    </html>
  );
}
