"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

export type MarketingAnimation = "zoom-in" | "zoom-out" | "fade-up" | "scale-focus";

type AnimatedSectionProps = {
  children: ReactNode;
  type?: MarketingAnimation;
  delay?: number;
  className?: string;
};

/**
 * Progressive-enhancement wrapper for public-page scroll reveals.
 *
 * Server-rendered content starts in its natural, fully visible state. Only after
 * hydration do off-screen sections receive an entrance state, so neither a
 * JavaScript failure nor reduced-motion setting can hide product information.
 */
export function AnimatedSection({
  children,
  type = "zoom-in",
  delay = 0,
  className,
}: AnimatedSectionProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"ready" | "pending" | "visible">("ready");

  useEffect(() => {
    const element = ref.current;
    if (!element || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setState("visible");
      return;
    }

    const isAlreadyInView = element.getBoundingClientRect().top < window.innerHeight * 0.84;
    if (isAlreadyInView) {
      setState("visible");
      return;
    }

    setState("pending");
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setState("visible");
        observer.disconnect();
      },
      { rootMargin: "0px 0px -10%", threshold: 0.08 },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      data-marketing-motion={state}
      data-marketing-motion-type={type}
      style={{ "--marketing-motion-delay": `${delay}s` } as CSSProperties}
    >
      {children}
    </div>
  );
}
