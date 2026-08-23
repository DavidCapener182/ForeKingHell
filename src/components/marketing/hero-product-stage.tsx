"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";

import { trackPlausibleEvent } from "@/lib/analytics";
import { marketingJoinBetaHref } from "@/lib/marketing-links";

import cinematic from "./cinematic.module.css";

export function HeroProductStage() {
  const heroRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    const layers = Array.from(hero.querySelectorAll<HTMLElement>("[data-hero-layer]"));
    let animationFrame = 0;
    let pointerX = 0;
    let pointerY = 0;
    let targetX = 0;
    let targetY = 0;

    const update = () => {
      animationFrame = 0;
      const progress = reducedMotion.matches
        ? 0
        : Math.min(1, Math.max(0, -hero.getBoundingClientRect().top / innerHeight));

      pointerX += (targetX - pointerX) * 0.1;
      pointerY += (targetY - pointerY) * 0.1;

      layers.forEach((layer) => {
        const depth = Number(layer.dataset.heroDepth ?? 0);
        layer.style.setProperty("--hero-progress", progress.toFixed(3));
        layer.style.setProperty("--hero-x", `${(pointerX * depth).toFixed(2)}px`);
        layer.style.setProperty("--hero-y", `${(pointerY * depth).toFixed(2)}px`);
      });

      if (Math.abs(targetX - pointerX) > 0.002 || Math.abs(targetY - pointerY) > 0.002) {
        animationFrame = requestAnimationFrame(update);
      }
    };
    const requestUpdate = () => {
      if (!animationFrame) animationFrame = requestAnimationFrame(update);
    };
    const trackPointer = (event: globalThis.PointerEvent) => {
      if (!finePointer.matches || reducedMotion.matches) return;
      const bounds = hero.getBoundingClientRect();
      targetX = (event.clientX - bounds.left) / bounds.width - 0.5;
      targetY = (event.clientY - bounds.top) / bounds.height - 0.5;
      requestUpdate();
    };
    const resetPointer = () => {
      targetX = 0;
      targetY = 0;
      requestUpdate();
    };

    update();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate, { passive: true });
    hero.addEventListener("pointermove", trackPointer, { passive: true });
    hero.addEventListener("pointerleave", resetPointer);
    reducedMotion.addEventListener("change", requestUpdate);
    finePointer.addEventListener("change", resetPointer);

    return () => {
      if (animationFrame) cancelAnimationFrame(animationFrame);
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
      hero.removeEventListener("pointermove", trackPointer);
      hero.removeEventListener("pointerleave", resetPointer);
      reducedMotion.removeEventListener("change", requestUpdate);
      finePointer.removeEventListener("change", resetPointer);
      layers.forEach((layer) => {
        layer.style.removeProperty("--hero-progress");
        layer.style.removeProperty("--hero-x");
        layer.style.removeProperty("--hero-y");
      });
    };
  }, []);

  return (
    <section ref={heroRef} className={cinematic.hero} aria-labelledby="hero-title">
      <picture className={cinematic.heroCourse}>
        <source media="(max-width: 767px)" srcSet="/assets/landing/hero-course-mobile.avif" />
        <img
          src="/assets/landing/hero-course-desktop.avif"
          alt="A misty British parkland golf course at first light"
          width="1828"
          height="860"
          fetchPriority="high"
          decoding="async"
          data-hero-layer
          data-hero-depth="-4"
        />
      </picture>
      <span className={cinematic.heroAtmosphere} aria-hidden data-hero-layer data-hero-depth="-2" />
      <span className={cinematic.heroContour} aria-hidden data-hero-layer data-hero-depth="3" />

      <div className={cinematic.heroUtility} aria-hidden data-hero-layer data-hero-depth="1">
        <span>
          <i className={cinematic.heroCrosshair} /> Measured to playable
        </span>
        <span>Course Twin · Pilot</span>
      </div>

      <h1 id="hero-title" className={cinematic.heroTitle} data-hero-layer data-hero-depth="5">
        <span>Stop guessing.</span>
        <span>Start knowing.</span>
      </h1>

      <div className={cinematic.heroGolfer} aria-hidden data-hero-layer data-hero-depth="8">
        <Image
          src="/assets/landing/hero-golfer.webp"
          alt=""
          width={1122}
          height={1402}
          preload
          sizes="(max-width: 767px) 74vw, 47vw"
        />
      </div>
      <div className={cinematic.heroCopy} data-hero-layer data-hero-depth="2">
        <p>
          Turn measured shots into a trusted bag, a focused practice job and a smarter plan for the
          course.
        </p>
        <div className={cinematic.heroActions}>
          <Link
            href={marketingJoinBetaHref}
            className={cinematic.primaryAction}
            onClick={() => trackPlausibleEvent("Public Join Beta Clicked")}
          >
            Join the beta <span className={cinematic.inlineArrow}>→</span>
          </Link>
          <a className={cinematic.secondaryAction} href="#how-it-works">
            See the system <span className={cinematic.inlineArrow}>↓</span>
          </a>
        </div>
      </div>

      <article
        className={cinematic.heroSignal}
        aria-label="LM World Tour evidence principle"
        data-hero-layer
        data-hero-depth="4"
      >
        <header>
          <span>Product principle</span>
          <span className={cinematic.heroProofMark} aria-hidden>
            ✓
          </span>
        </header>
        <strong>Evidence before advice</strong>
        <div>
          <span>Original rows stay traceable</span>
          <b>Read only</b>
        </div>
      </article>

      <div className={cinematic.heroForeground} aria-hidden data-hero-layer data-hero-depth="10" />
      <Image
        className={cinematic.storyBall}
        src="/assets/landing/golf-ball.png"
        alt=""
        width={256}
        height={256}
        sizes="32px"
        aria-hidden
        data-hero-layer
        data-hero-depth="4"
      />
      <a
        href="#how-it-works"
        className={cinematic.scrollCue}
        aria-label="Scroll to how it works"
        data-hero-layer
        data-hero-depth="1"
      >
        <span>Scroll to enter the system</span>
        <span className={cinematic.scrollCueArrow} aria-hidden>
          ↓
        </span>
      </a>
    </section>
  );
}
