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
  const [activeSection, setActiveSection] = useState("");
  const progressRef = useRef<HTMLSpanElement>(null);
  const lastScrollY = useRef(0);

  useEffect(() => {
    let frame = 0;
    let disposed = false;
    let initialAnchor = window.location.hash.slice(1);
    const releaseInitialAnchor = () => {
      initialAnchor = "";
    };
    const restoreInitialAnchor = () => {
      // Lazy sections above a deep link can change height during hydration.
      // Keep the requested chapter aligned until the visitor starts interacting.
      if (initialAnchor)
        document
          .getElementById(initialAnchor)
          ?.scrollIntoView({ behavior: "instant", block: "start" });
    };
    let pageHeight = document.documentElement.scrollHeight;
    let chapters: { href: string; top: number; bottom: number }[] = [];
    const measure = () => {
      pageHeight = document.documentElement.scrollHeight;
      chapters = navigation.flatMap(([, href]) => {
        const section = document.getElementById(href.slice(1));
        if (!section) return [];
        const bounds = section.getBoundingClientRect();
        return [{ href, top: bounds.top + window.scrollY, bottom: bounds.bottom + window.scrollY }];
      });
    };
    const update = () => {
      frame = 0;
      const nextY = Math.max(0, window.scrollY);
      const delta = nextY - lastScrollY.current;
      lastScrollY.current = nextY;
      const progress = Math.min(1, nextY / Math.max(1, pageHeight - window.innerHeight));
      if (progressRef.current)
        progressRef.current.style.transform = `scaleX(${progress.toFixed(4)})`;
      const readingLine = nextY + window.innerHeight * 0.35;
      setActiveSection(
        chapters.find(({ top, bottom }) => readingLine >= top && readingLine < bottom)?.href ?? "",
      );

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

    const initialScrollY = Math.max(0, window.scrollY);
    lastScrollY.current = initialScrollY;
    frame = window.requestAnimationFrame(() => {
      frame = 0;
      measure();
      restoreInitialAnchor();
      update();
      setHeaderState(initialScrollY < 100 ? "hero" : "compact");
    });
    const refresh = () => {
      if (disposed) return;
      measure();
      restoreInitialAnchor();
      requestUpdate();
    };
    const page = progressRef.current?.closest("main");
    const resizeObserver = new ResizeObserver(refresh);
    if (page) resizeObserver.observe(page);
    document.fonts.ready.then(refresh).catch(() => undefined);
    window.addEventListener("resize", refresh, { passive: true });
    window.addEventListener("wheel", releaseInitialAnchor, { passive: true });
    window.addEventListener("touchstart", releaseInitialAnchor, { passive: true });
    window.addEventListener("pointerdown", releaseInitialAnchor, { passive: true });
    window.addEventListener("keydown", releaseInitialAnchor);
    window.addEventListener("hashchange", releaseInitialAnchor);
    window.addEventListener("scroll", requestUpdate, { passive: true });
    return () => {
      disposed = true;
      resizeObserver.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", refresh);
      window.removeEventListener("wheel", releaseInitialAnchor);
      window.removeEventListener("touchstart", releaseInitialAnchor);
      window.removeEventListener("pointerdown", releaseInitialAnchor);
      window.removeEventListener("keydown", releaseInitialAnchor);
      window.removeEventListener("hashchange", releaseInitialAnchor);
      window.removeEventListener("scroll", requestUpdate);
    };
  }, []);

  return (
    <>
      <span className={styles.readingProgress} aria-hidden ref={progressRef} />
      <header className={styles.header} data-state={headerState}>
        <a href="#hero-title" className={styles.skipLink}>
          Skip to product introduction
        </a>
        <div className={styles.headerInner}>
          <Link href="/" className={styles.brand} aria-label={`${BRAND_NAME} home`}>
            <span>{BRAND_NAME}</span>
          </Link>
          <nav className={styles.desktopNav} aria-label="Public product navigation">
            {navigation.map(([label, href]) => (
              <a
                key={href}
                href={href}
                aria-current={activeSection === href ? "location" : undefined}
              >
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
    </>
  );
}
