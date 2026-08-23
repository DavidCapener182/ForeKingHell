"use client";

import Image from "next/image";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { trackPlausibleEvent } from "@/lib/analytics";
import { marketingFaqs } from "@/lib/marketing-demo-data";

import styles from "./cinematic.module.css";
import { Reveal } from "./reveal";

export function MarketingFaq() {
  return (
    <section
      id="faq"
      className={styles.faqSection}
      aria-labelledby="faq-title"
      data-scroll-pause="faq"
    >
      <div className={styles.faqStage}>
        <div className={styles.faqImage} aria-hidden>
          <Image
            src="/assets/landing/product-review.avif"
            alt=""
            width="1800"
            height="1013"
            sizes="100vw"
            loading="lazy"
            data-scene-parallax
          />
          <span />
        </div>
        <Reveal from="left">
          <p className={styles.kicker}>The useful questions</p>
          <h2 id="faq-title">Before you hand over a single shot.</h2>
        </Reveal>
        <Accordion
          type="single"
          collapsible
          className={styles.faqList}
          onValueChange={(value) => {
            if (value) trackPlausibleEvent("Public FAQ Item Opened");
          }}
        >
          {marketingFaqs.map((item, index) => (
            <Reveal as="article" from="up" key={item.question}>
              <AccordionItem value={`faq-${index}`}>
                <AccordionTrigger>{item.question}</AccordionTrigger>
                <AccordionContent>
                  <p>{item.answer}</p>
                </AccordionContent>
              </AccordionItem>
            </Reveal>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
