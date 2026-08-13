import type { Metadata } from "next";

import { AnimatedSection } from "@/components/marketing/animated-section";
import { BetaAccessSection } from "@/components/marketing/beta-access-section";
import { FeatureShowcase } from "@/components/marketing/feature-showcase";
import { HeroProductStage } from "@/components/marketing/hero-product-stage";
import {
  LazyCourseTwinShowcase,
  LazyMarketingFaq,
  LazySampleProductTour,
} from "@/components/marketing/lazy-marketing-sections";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { MobileProductShowcase } from "@/components/marketing/mobile-product-showcase";
import { PrivacyTrustSection } from "@/components/marketing/privacy-trust-section";
import { ScrollProductStory } from "@/components/marketing/scroll-product-story";
import { TrustStrip } from "@/components/marketing/trust-strip";
import { marketingFaqs } from "@/lib/marketing-demo-data";

import styles from "@/components/marketing/marketing.module.css";

export const metadata: Metadata = {
  title: "Launch-monitor golf, turned into decisions",
  description:
    "LM World Tour turns launch-monitor sessions into trusted club numbers, practice decisions and course plans.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "LM World Tour | Turn every measured shot into a better golf game",
    description: "Trusted launch-monitor evidence for bag mapping, practice and course decisions.",
    url: "/",
    siteName: "LM World Tour",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "LM World Tour",
    description: "Measured golf evidence, turned into decisions.",
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
    <main className={styles.page} id="product">
      <MarketingHeader />
      <AnimatedSection type="zoom-in">
        <HeroProductStage />
      </AnimatedSection>
      <AnimatedSection type="fade-up" delay={0.04}>
        <TrustStrip />
      </AnimatedSection>
      <AnimatedSection type="zoom-out">
        <ScrollProductStory />
      </AnimatedSection>
      <AnimatedSection type="zoom-in">
        <FeatureShowcase />
      </AnimatedSection>
      <AnimatedSection type="scale-focus">
        <LazySampleProductTour />
      </AnimatedSection>
      <AnimatedSection type="zoom-out">
        <LazyCourseTwinShowcase />
      </AnimatedSection>
      <AnimatedSection type="fade-up">
        <MobileProductShowcase />
      </AnimatedSection>
      <AnimatedSection type="zoom-in">
        <PrivacyTrustSection />
      </AnimatedSection>
      <AnimatedSection type="scale-focus">
        <BetaAccessSection />
      </AnimatedSection>
      <AnimatedSection type="fade-up">
        <LazyMarketingFaq />
      </AnimatedSection>
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
