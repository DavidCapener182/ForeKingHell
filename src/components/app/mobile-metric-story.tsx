"use client";
import { useEffect, useState } from "react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import { MobileMetric } from "./mobile-screen";
export function MobileMetricStory({
  metrics,
  context,
}: {
  metrics: { label: string; value: string; unit?: string; detail?: string }[];
  context: string;
}) {
  const [api, setApi] = useState<CarouselApi>();
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (!api) return;
    const update = () => setIndex(api.selectedScrollSnap());
    api.on("select", update);
    return () => {
      api.off("select", update);
    };
  }, [api]);
  if (!metrics.length) return null;
  return (
    <section aria-label="Session metric story" className="grid min-w-0 gap-3">
      <p className="text-sm text-muted-foreground">{context}</p>
      <Carousel setApi={setApi} opts={{ align: "start" }} className="min-w-0">
        <CarouselContent>
          {metrics.map((metric) => (
            <CarouselItem key={metric.label} className="basis-[90%]">
              <div className="rounded-2xl bg-card p-5">
                <MobileMetric {...metric} />
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
      <div className="flex items-center justify-between">
        <button
          type="button"
          className="min-h-11 px-2 text-primary disabled:opacity-30"
          disabled={!index}
          onClick={() => api?.scrollPrev()}
        >
          Previous
        </button>
        <span className="text-sm tabular-nums">
          {index + 1} of {metrics.length}
        </span>
        <button
          type="button"
          className="min-h-11 px-2 text-primary disabled:opacity-30"
          disabled={index >= metrics.length - 1}
          onClick={() => api?.scrollNext()}
        >
          Next
        </button>
      </div>
    </section>
  );
}
