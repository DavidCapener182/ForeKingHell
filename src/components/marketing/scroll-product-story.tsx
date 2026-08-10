"use client";

import { useEffect, useState, type CSSProperties } from "react";

import { marketingTourSteps } from "@/lib/marketing-demo-data";

import { Reveal, useInViewOnce } from "./reveal";
import styles from "./marketing.module.css";

export function ScrollProductStory() {
  const [activeIndex, setActiveIndex] = useState(0);
  const { ref, isVisible } = useInViewOnce<HTMLDivElement>("0px 0px -35%");

  useEffect(() => {
    const root = ref.current;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const usesCompactLayout = window.matchMedia("(max-width: 767px)").matches;
    if (!root || !isVisible || prefersReducedMotion || usesCompactLayout) return;
    const steps = Array.from(root.querySelectorAll<HTMLElement>("[data-story-step]"));
    const observer = new IntersectionObserver(
      (entries) => {
        const best = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!best) return;
        const index = Number((best.target as HTMLElement).dataset.storyStep ?? 0);
        setActiveIndex(index);
      },
      { rootMargin: "-28% 0px -42%", threshold: [0.2, 0.5, 0.8] },
    );
    steps.forEach((step) => observer.observe(step));
    return () => observer.disconnect();
  }, [isVisible, ref]);

  const active = marketingTourSteps[activeIndex] ?? marketingTourSteps[0];

  return (
    <section id="how-it-works" className={styles.storySection} aria-labelledby="story-title">
      <Reveal className={styles.sectionIntro}>
        <p className={styles.eyebrow}>From data to decisions</p>
        <h2 id="story-title">One connected loop, from the range to the first tee.</h2>
        <p>
          Every screen answers a different question, but the evidence stays connected throughout.
        </p>
      </Reveal>
      <div className={styles.storyGrid} ref={ref}>
        <div className={styles.storySteps}>
          {marketingTourSteps.map((step, index) => (
            <article key={step.id} className={styles.storyStep} data-story-step={index}>
              <p className={styles.storyStepEyebrow}>{step.eyebrow}</p>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
              <span>{step.detail}</span>
            </article>
          ))}
        </div>
        <aside className={styles.storyVisual} aria-live="polite">
          <div className={styles.storyVisualTop}>
            <span>LM World Tour · Demo data</span>
            <strong>{active.metric}</strong>
          </div>
          <div className={styles.storyCanvas} data-story={active.id}>
            <div className={styles.storyShotLine} />
            <div className={styles.storyPlot}>
              {Array.from({ length: 9 }, (_, index) => (
                <i key={index} style={{ "--dot": index } as CSSProperties} />
              ))}
            </div>
            <div className={styles.storyCard}>
              <span>{active.eyebrow}</span>
              <strong>{active.title}</strong>
              <p>{active.detail}</p>
            </div>
          </div>
          <div
            className={styles.storyProgress}
            aria-label={`${activeIndex + 1} of ${marketingTourSteps.length} story chapters`}
          >
            {marketingTourSteps.map((step, index) => (
              <span key={step.id} data-active={index === activeIndex ? "true" : "false"} />
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
}
