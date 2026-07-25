"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export function useInViewOnce<T extends Element>(rootMargin = "0px 0px -12%") {
  const ref = useRef<T>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setIsVisible(true);
        observer.disconnect();
      },
      { rootMargin, threshold: 0.12 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [rootMargin]);

  return { ref, isVisible };
}

export function Reveal({ children, className }: { children: ReactNode; className?: string }) {
  const { ref, isVisible } = useInViewOnce<HTMLDivElement>();

  return (
    <div ref={ref} className={className} data-marketing-reveal={isVisible ? "visible" : "pending"}>
      {children}
    </div>
  );
}
