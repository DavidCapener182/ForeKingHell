"use client";

import dynamic from "next/dynamic";

const MarketingFaq = dynamic(
  () => import("@/components/marketing/marketing-faq").then((module) => module.MarketingFaq),
  { ssr: false, loading: MarketingSectionPlaceholder },
);
const SampleProductTour = dynamic(
  () =>
    import("@/components/marketing/sample-product-tour").then((module) => module.SampleProductTour),
  { ssr: false, loading: MarketingSectionPlaceholder },
);
const CourseTwinShowcase = dynamic(
  () =>
    import("@/components/marketing/course-twin-showcase").then(
      (module) => module.CourseTwinShowcase,
    ),
  { ssr: false, loading: MarketingSectionPlaceholder },
);

export function LazySampleProductTour() {
  return <SampleProductTour />;
}

export function LazyCourseTwinShowcase() {
  return <CourseTwinShowcase />;
}

export function LazyMarketingFaq() {
  return <MarketingFaq />;
}

function MarketingSectionPlaceholder() {
  return <div className="min-h-[36rem]" aria-hidden />;
}
