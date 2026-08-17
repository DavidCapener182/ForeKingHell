"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight } from "lucide-react";

import { MobileCarouselPagination } from "@/components/app/mobile-controls";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

export type MobileBagYardage = {
  id: string;
  club: string;
  model: string;
  playNumber: string;
  reliableRange: string;
  gap: string;
  confidence: number;
  nextStep: string;
};

export function MobileBagYardageCarousel({ clubs }: { clubs: MobileBagYardage[] }) {
  const [api, setApi] = useState<CarouselApi>();
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    if (!api) return;

    const updateSelectedIndex = () => setSelectedIndex(api.selectedScrollSnap());
    queueMicrotask(updateSelectedIndex);
    api.on("select", updateSelectedIndex);
    api.on("reInit", updateSelectedIndex);

    return () => {
      api.off("select", updateSelectedIndex);
      api.off("reInit", updateSelectedIndex);
    };
  }, [api]);

  if (clubs.length === 0) return null;

  return (
    <section className="grid min-w-0 gap-3" aria-labelledby="mobile-bag-yardages-title">
      <div className="min-w-0">
        <h2 id="mobile-bag-yardages-title" className="text-lg font-semibold tracking-tight">
          Yardages and gaps
        </h2>
        <p className="mt-0.5 text-sm leading-5 text-muted-foreground">
          Swipe through {clubs.length} clubs. Open the detail only when you need the evidence.
        </p>
      </div>

      <Carousel
        opts={{ align: "start", containScroll: "trimSnaps", dragFree: false }}
        setApi={setApi}
        className="w-full min-w-0 max-w-full"
        aria-label="Bag yardages"
        data-bag-yardage-carousel
      >
        <CarouselContent className="-ml-3 touch-pan-y">
          {clubs.map((club, index) => (
            <CarouselItem
              key={club.id}
              className="basis-[calc(100%-1.5rem)] pl-3"
              aria-label={`${club.club}, club ${index + 1} of ${clubs.length}`}
            >
              <article className="h-full min-w-0 overflow-hidden rounded-[var(--mobile-radius-lg)] border border-border bg-card shadow-sm">
                <div className="grid gap-4 p-4">
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xl font-bold tracking-tight text-foreground">
                        {club.club}
                      </p>
                      <p className="mt-0.5 truncate text-sm text-muted-foreground">{club.model}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-primary/12 px-2.5 py-1 text-xs font-semibold text-primary">
                      {club.confidence}% trust
                    </span>
                  </div>

                  <div className="rounded-[var(--mobile-radius-md)] bg-primary px-4 py-4 text-primary-foreground">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] opacity-75">
                      Play this number
                    </p>
                    <p className="mt-1 text-4xl font-bold tracking-[-0.04em] tabular-nums">
                      {club.playNumber}
                    </p>
                  </div>
                </div>

                <Accordion type="single" collapsible>
                  <AccordionItem value="yardage-detail" className="border-t border-border">
                    <AccordionTrigger className="min-h-14 px-4 py-3 text-left hover:no-underline">
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-foreground">
                          Range, gap and next step
                        </span>
                        <span className="mt-0.5 block truncate text-xs font-normal text-muted-foreground">
                          Reliable {club.reliableRange}
                        </span>
                      </span>
                      <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                        {club.gap}
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="grid gap-3 px-4 pb-4">
                      <div className="grid grid-cols-2 gap-3 rounded-[var(--mobile-radius-md)] bg-secondary p-3">
                        <MobileBagDetail label="Reliable range" value={club.reliableRange} />
                        <MobileBagDetail label="Gap to next" value={club.gap} />
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                          Next benchmark
                        </p>
                        <p className="mt-1 text-sm leading-5 font-medium text-foreground">
                          {club.nextStep}
                        </p>
                      </div>
                      <Link
                        href={`/bag/${club.id}`}
                        className="focus-aaa inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--mobile-radius-md)] border border-border bg-card px-4 text-sm font-semibold text-foreground active:scale-[0.98] motion-reduce:active:scale-100"
                      >
                        View club analysis
                        <ArrowUpRight className="size-4" aria-hidden="true" />
                      </Link>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </article>
            </CarouselItem>
          ))}
        </CarouselContent>

        {clubs.length <= 5 ? (
          <div className="mt-3 grid grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center gap-3">
            <CarouselPrevious className="static size-11 translate-y-0 disabled:invisible" />
            <MobileCarouselPagination
              labels={clubs.map((club) => club.club)}
              selectedIndex={selectedIndex}
              onSelect={(index) => api?.scrollTo(index)}
              ariaLabel="Choose bag club"
            />
            <CarouselNext className="static size-11 translate-y-0 disabled:invisible" />
          </div>
        ) : (
          <div className="mt-3 flex items-center justify-between gap-3">
            <p
              className="text-sm font-medium text-muted-foreground tabular-nums"
              aria-live="polite"
            >
              {selectedIndex + 1} of {clubs.length} · {clubs[selectedIndex]?.club}
            </p>
            <div className="flex items-center gap-2">
              <CarouselPrevious className="static size-11 translate-y-0" />
              <CarouselNext className="static size-11 translate-y-0" />
            </div>
          </div>
        )}
        <p className="sr-only" aria-live="polite">
          Club {selectedIndex + 1} of {clubs.length}: {clubs[selectedIndex]?.club}
        </p>
      </Carousel>
    </section>
  );
}

function MobileBagDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  );
}
