"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { Menu } from "lucide-react";
import { useEffect, useState } from "react";

import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
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

const MarketingMobileMenu = dynamic(
  () =>
    import("@/components/marketing/marketing-mobile-menu").then(
      (module) => module.MarketingMobileMenu,
    ),
  {
    ssr: false,
    loading: () => (
      <Button
        className={styles.menuTrigger}
        variant="outline"
        size="icon"
        aria-label="Open navigation"
        disabled
      >
        <Menu className="size-5" aria-hidden />
      </Button>
    ),
  },
);

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
          <MarketingMobileMenu navigation={navigation} />
        </div>
      </div>
    </header>
  );
}
