import type { Metadata } from "next";

import { BetaAccessSection } from "@/components/marketing/beta-access-section";
import { FeatureShowcase } from "@/components/marketing/feature-showcase";
import { HeroProductStage } from "@/components/marketing/hero-product-stage";
import { ImportPracticeGuide } from "@/components/marketing/import-practice-guide";
import {
  LazyCourseTwinShowcase,
  LazyMarketingFaq,
  LazySampleProductTour,
  LazyScrollProductStory,
} from "@/components/marketing/lazy-marketing-sections";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { MobileProductShowcase } from "@/components/marketing/mobile-product-showcase";
import { PrivacyTrustSection } from "@/components/marketing/privacy-trust-section";
import { TrustStrip } from "@/components/marketing/trust-strip";
import { marketingFaqs, marketingTourSteps } from "@/lib/marketing-demo-data";

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
      <HeroProductStage />
      <TrustStrip />
      <LazyScrollProductStory />
      <MarketingStoryNoScript />
      <FeatureShowcase />
      <ImportPracticeGuide />
      <LazySampleProductTour />
      <LazyCourseTwinShowcase />
      <MobileProductShowcase />
      <PrivacyTrustSection />
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

function MarketingStoryNoScript() {
  return (
    <noscript>
      <section
        id="how-it-works"
        className={styles.storySection}
        aria-labelledby="story-no-script-title"
      >
        <div className={styles.sectionIntro}>
          <p className={styles.eyebrow}>From data to decisions</p>
          <h2 id="story-no-script-title">One connected loop, from the range to the first tee.</h2>
          <p>
            Every screen answers a different question, but the evidence stays connected throughout.
          </p>
        </div>
        <div className={styles.storySteps}>
          {marketingTourSteps.map((step) => (
            <article key={step.id} className={styles.storyStep}>
              <p className={styles.storyStepEyebrow}>{step.eyebrow}</p>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
              <span>{step.detail}</span>
            </article>
          ))}
        </div>
      </section>
    </noscript>
  );
}
