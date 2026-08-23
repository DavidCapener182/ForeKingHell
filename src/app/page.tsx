import type { Metadata } from "next";

import { BetaAccessSection } from "@/components/marketing/beta-access-section";
import {
  BrandPromise,
  EditorialFeatureGrid,
  PracticeShowcase,
  ProductScreensShowcase,
} from "@/components/marketing/cinematic-sections";
import { HeroProductStage } from "@/components/marketing/hero-product-stage";
import {
  LazyCourseTwinShowcase,
  LazyMarketingFaq,
} from "@/components/marketing/lazy-marketing-sections";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { PrivacyTrustSection } from "@/components/marketing/privacy-trust-section";
import { PricingSection } from "@/components/marketing/pricing-section";
import { StoryContinuity } from "@/components/marketing/story-continuity";
import { marketingFaqs } from "@/lib/marketing-demo-data";

import cinematic from "@/components/marketing/cinematic.module.css";
import styles from "@/components/marketing/marketing.module.css";

export const metadata: Metadata = {
  title: "Make your golf data playable",
  description:
    "LM World Tour turns measured shots into trusted club numbers, focused practice and smarter course decisions.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "LM World Tour | Make your golf data playable",
    description: "Measured shots become a trusted bag, a focused practice job and a course plan.",
    url: "/",
    siteName: "LM World Tour",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "LM World Tour",
    description: "Measured golf evidence, made playable.",
  },
};

export default function HomePage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "LM World Tour",
    applicationCategory: "SportsApplication",
    operatingSystem: "Web",
    description:
      "Personal golf analytics for launch-monitor data, bag mapping, rounds and practice planning.",
    featureList: [
      "Launch-monitor import",
      "Trusted bag mapping",
      "Practice planning",
      "Course Strategy",
      "Read-only Data Chat",
    ],
  };
  const faqStructuredData = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: marketingFaqs.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };

  return (
    <main className={`${styles.page} ${cinematic.page}`} data-marketing-motion="idle" id="product">
      <MarketingHeader />
      <StoryContinuity />
      <HeroProductStage />
      <BrandPromise />
      <LazyCourseTwinShowcase />
      <PracticeShowcase />
      <ProductScreensShowcase />
      <EditorialFeatureGrid />
      <PrivacyTrustSection />
      <PricingSection />
      <BetaAccessSection />
      <LazyMarketingFaq />
      <MarketingFooter />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqStructuredData) }}
      />
    </main>
  );
}
