"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

import { trackPlausibleEvent } from "@/lib/analytics";
import { BRAND_NAME } from "@/lib/brand";
import { marketingJoinBetaHref } from "@/lib/marketing-links";

import styles from "./cinematic.module.css";

const navigation = [
  ["Course Twin", "#course-twin"],
  ["Practice", "#practice"],
  ["Product screens", "#product-screens"],
  ["Trust", "#privacy"],
  ["Pricing", "#pricing"],
] as const;

const MarketingMobileMenu = dynamic(
  () =>
    import("@/components/marketing/marketing-mobile-menu").then(
      (module) => module.MarketingMobileMenu,
    ),
  {
    ssr: false,
    loading: () => (
      <button type="button" className={styles.menuTrigger} aria-label="Open navigation" disabled>
        <span className={styles.menuGlyph} aria-hidden>
          <i />
          <i />
          <i />
        </span>
      </button>
    ),
  },
);

export function MarketingHeader() {
  const [headerState, setHeaderState] = useState<"hero" | "compact" | "hidden">("hero");
  const lastScrollY = useRef(0);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const nextY = Math.max(0, window.scrollY);
      const delta = nextY - lastScrollY.current;
      lastScrollY.current = nextY;

      if (nextY < 100) {
        setHeaderState("hero");
      } else if (delta > 7 && nextY > 180) {
        setHeaderState("hidden");
      } else if (delta < -2) {
        setHeaderState("compact");
      }
    };
    const requestUpdate = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };

    lastScrollY.current = window.scrollY;
    update();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", requestUpdate);
    };
  }, []);

  return (
    <header className={styles.header} data-state={headerState}>
      <div className={styles.headerInner}>
        <Link href="/" className={styles.brand} aria-label={`${BRAND_NAME} home`}>
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
          <Link
            className={styles.headerBeta}
            href={marketingJoinBetaHref}
            onClick={() => trackPlausibleEvent("Public Join Beta Clicked")}
          >
            Join the beta
          </Link>
          <MarketingMobileMenu navigation={navigation} />
        </div>
      </div>
    </header>
  );
}
