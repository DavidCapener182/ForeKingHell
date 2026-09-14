"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { marketingJoinBetaHref } from "@/lib/marketing-links";
import { trackPlausibleEvent } from "@/lib/analytics";
import styles from "./public-ui.module.css";

export function StickyMobileCta() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const hero = document.querySelector("[data-mobile-cta-origin]");
    const stops = document.querySelectorAll("[data-mobile-cta-stop]");
    if (!hero) return;
    let frame = 0;
    const visibleStops = new Set<Element>();
    const update = () => {
      frame = 0;
      setVisible(hero.getBoundingClientRect().bottom <= 0 && visibleStops.size === 0);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === hero) continue;
        if (entry.isIntersecting) visibleStops.add(entry.target);
        else visibleStops.delete(entry.target);
      }
      onScroll();
    });
    observer.observe(hero);
    stops.forEach((element) => observer.observe(element));
    // A fast scroll can skip the hero action entirely between observer frames.
    // Read its position once per animation frame so the CTA still appears.
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    onScroll();
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);
  return visible ? (
    <aside className={styles.mobileCta} aria-label="Join LM World Tour" data-mobile-cta>
      <span>
        Your next session,
        <br />
        <strong>with a purpose.</strong>
      </span>
      <Link
        href={marketingJoinBetaHref}
        onClick={() => trackPlausibleEvent("Public Join Beta Clicked")}
      >
        Join the beta <span aria-hidden>↗</span>
      </Link>
    </aside>
  ) : null;
}
