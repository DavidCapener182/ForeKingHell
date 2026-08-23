"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { trackPlausibleEvent } from "@/lib/analytics";
import { BRAND_NAME } from "@/lib/brand";
import { marketingJoinBetaHref } from "@/lib/marketing-links";

import styles from "./cinematic.module.css";

export function MarketingMobileMenu({
  navigation,
}: {
  navigation: ReadonlyArray<readonly [label: string, href: string]>;
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          className={styles.menuTrigger}
          variant="outline"
          size="icon"
          aria-label="Open navigation"
        >
          <span className={styles.menuGlyph} aria-hidden>
            <i />
            <i />
            <i />
          </span>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className={styles.mobileSheet} showCloseButton={false}>
        <SheetDescription className="sr-only">
          Navigate the LM World Tour product pages, sign in or join the beta.
        </SheetDescription>
        <div className={styles.mobileSheetTop}>
          <SheetTitle className={styles.mobileSheetTitle}>{BRAND_NAME}</SheetTitle>
          <SheetClose asChild>
            <Button variant="ghost" size="icon" aria-label="Close navigation">
              <span className={styles.closeGlyph} aria-hidden>
                ×
              </span>
            </Button>
          </SheetClose>
        </div>
        <nav className={styles.mobileLinks} aria-label="Public product navigation">
          {navigation.map(([label, href]) => (
            <SheetClose asChild key={href}>
              <a href={href}>{label}</a>
            </SheetClose>
          ))}
        </nav>
        <div className={styles.mobileMenuActions}>
          <Button asChild variant="outline" className="min-h-12 w-full">
            <Link href="/login" onClick={() => trackPlausibleEvent("Public Sign In Clicked")}>
              Sign in
            </Link>
          </Button>
          <Button asChild className="min-h-12 w-full">
            <Link
              href={marketingJoinBetaHref}
              onClick={() => trackPlausibleEvent("Public Join Beta Clicked")}
            >
              Join the beta
            </Link>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
