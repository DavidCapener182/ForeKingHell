"use client";

import Link from "next/link";
import { Menu, Search, X } from "lucide-react";
import { useEffect, useState } from "react";

import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { trackPlausibleEvent } from "@/lib/analytics";
import { BRAND_NAME } from "@/lib/brand";
import { marketingJoinBetaHref } from "@/lib/marketing-links";

import styles from "./marketing.module.css";

const navigation = [
  ["Product", "#product"],
  ["How it works", "#how-it-works"],
  ["Features", "#features"],
  ["Course Twin", "#course-twin"],
  ["Community", "#community"],
  ["Privacy", "#privacy"],
  ["FAQ", "#faq"],
] as const;

export function MarketingHeader() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 12);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  return (
    <header className={styles.header} data-scrolled={scrolled ? "true" : "false"}>
      <div className={styles.headerInner}>
        <Link href="/" className={styles.brand} aria-label={`${BRAND_NAME} home`}>
          <BrandMark className={styles.brandMark} sizes="36px" priority />
          <span>{BRAND_NAME}</span>
        </Link>
        <nav className={styles.desktopNav} aria-label="Public product navigation">
          {navigation.map(([label, href]) => (
            <a key={href} href={href}>
              {label}
            </a>
          ))}
        </nav>
        <div className={styles.headerActions}>
          <Link
            href="/login"
            onClick={() => trackPlausibleEvent("Public Sign In Clicked")}
            className={styles.signInLink}
          >
            Sign in
          </Link>
          <Button asChild className={styles.headerBeta}>
            <Link
              href={marketingJoinBetaHref}
              onClick={() => trackPlausibleEvent("Public Join Beta Clicked")}
            >
              Join the beta
            </Link>
          </Button>
          <MarketingMobileMenu />
        </div>
      </div>
    </header>
  );
}

export function MarketingMobileMenu() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          className={styles.menuTrigger}
          variant="outline"
          size="icon"
          aria-label="Open navigation"
        >
          <Menu className="size-5" aria-hidden />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className={styles.mobileSheet} showCloseButton={false}>
        <div className={styles.mobileSheetTop}>
          <SheetTitle className={styles.mobileSheetTitle}>{BRAND_NAME}</SheetTitle>
          <SheetClose asChild>
            <Button variant="ghost" size="icon" aria-label="Close navigation">
              <X className="size-5" aria-hidden />
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
          <p className={styles.menuSearchHint}>
            <Search className="size-4" aria-hidden /> Explore the product before you create an
            account.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
