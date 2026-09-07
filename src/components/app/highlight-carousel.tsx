"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import styles from "./highlight-carousel.module.css";

type Props = {
  label: string;
  slides: Array<{ id: string; label: string; content: ReactNode }>;
  selectedIndex?: number;
  onSelected?: (index: number) => void;
  autoPlay?: boolean;
};

/** Slow, interruptible highlights. Rotation never moves keyboard focus or announces automatically. */
export function HighlightCarousel({
  label,
  slides,
  selectedIndex,
  onSelected,
  autoPlay = true,
}: Props) {
  const [api, setApi] = useState<CarouselApi>();
  const [initialIndex] = useState(selectedIndex ?? 0);
  const [index, setIndex] = useState(selectedIndex ?? 0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(true);
  const [visible, setVisible] = useState(true);
  const [inView, setInView] = useState(true);
  const rotating =
    autoPlay && !paused && !hovered && !reducedMotion && visible && inView && slides.length > 1;

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    const visibility = () => setVisible(!document.hidden);
    update();
    visibility();
    media.addEventListener("change", update);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      media.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);

  useEffect(() => {
    if (!api) return;
    const sync = () => {
      const next = api.selectedScrollSnap();
      setIndex(next);
      onSelected?.(next);
    };
    const stop = () => setPaused(true);
    api.on("select", sync);
    api.on("pointerDown", stop);
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), {
      threshold: 0.1,
    });
    observer.observe(api.rootNode());
    return () => {
      api.off("select", sync);
      api.off("pointerDown", stop);
      observer.disconnect();
    };
  }, [api, onSelected]);

  useEffect(() => {
    if (api && selectedIndex !== undefined && selectedIndex !== api.selectedScrollSnap()) {
      const stop = () => setPaused(true);
      api.on("select", stop);
      api.scrollTo(selectedIndex, reducedMotion);
      api.off("select", stop);
    }
  }, [api, selectedIndex, reducedMotion]);

  useEffect(() => {
    if (!api || !rotating) return;
    const timer = window.setInterval(() => api.scrollNext(), 8000);
    return () => window.clearInterval(timer);
  }, [api, rotating, index]);

  if (!slides.length) return null;
  return (
    <Carousel
      opts={{ loop: true, startIndex: initialIndex, duration: reducedMotion ? 0 : 40 }}
      setApi={setApi}
      className={styles.carousel}
      aria-label={label}
      data-highlight-carousel
      data-active-slide={index}
      data-rotating={rotating}
      onFocusCapture={(event) => {
        // Clicking Play/Pause must perform one action, not pause on focus then toggle back.
        if (!(event.target instanceof Element && event.target.closest("[data-rotation-toggle]"))) {
          setPaused(true);
        }
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <CarouselContent className={`ml-0 ${styles.track}`} aria-live={rotating ? "off" : "polite"}>
        {slides.map((slide, position) => (
          <CarouselItem
            key={slide.id}
            className={`flex pl-0 ${styles.card}`}
            aria-label={`${position + 1} of ${slides.length}: ${slide.label}`}
            aria-hidden={position !== index}
            inert={position !== index}
          >
            <div className={styles.slide}>{slide.content}</div>
          </CarouselItem>
        ))}
      </CarouselContent>
      {slides.length > 1 ? (
        <div className={styles.controls}>
          <div className={styles.position}>
            <span className={styles.counter}>
              {index + 1} / {slides.length}
            </span>
            <span>{slides[index]?.label}</span>
          </div>
          <div className={styles.buttons}>
            <button
              type="button"
              aria-label="Previous highlight"
              onClick={() => {
                setPaused(true);
                api?.scrollPrev(reducedMotion);
              }}
            >
              <ChevronLeft size={18} aria-hidden />
            </button>
            <button
              type="button"
              data-rotation-toggle
              aria-label={
                paused || !autoPlay ? "Start highlight rotation" : "Pause highlight rotation"
              }
              disabled={reducedMotion || !autoPlay}
              title={reducedMotion ? "Automatic rotation is off for reduced motion" : undefined}
              onClick={() => setPaused((value) => !value)}
            >
              {paused || !autoPlay ? (
                <Play size={16} aria-hidden />
              ) : (
                <Pause size={16} aria-hidden />
              )}
            </button>
            <button
              type="button"
              aria-label="Next highlight"
              onClick={() => {
                setPaused(true);
                api?.scrollNext(reducedMotion);
              }}
            >
              <ChevronRight size={18} aria-hidden />
            </button>
          </div>
        </div>
      ) : null}
      {slides.length > 1 ? (
        <div className={styles.pagination} aria-label="Choose a highlight">
          {slides.map((slide, position) => (
            <button
              key={slide.id}
              type="button"
              aria-label={`Show highlight ${position + 1}: ${slide.label}`}
              aria-current={position === index ? "true" : undefined}
              onClick={() => {
                setPaused(true);
                api?.scrollTo(position, reducedMotion);
              }}
            >
              <span />
            </button>
          ))}
        </div>
      ) : null}
    </Carousel>
  );
}
