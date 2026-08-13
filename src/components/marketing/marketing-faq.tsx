"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { trackPlausibleEvent } from "@/lib/analytics";
import { marketingFaqs } from "@/lib/marketing-demo-data";

import styles from "./marketing.module.css";

export function MarketingFaq() {
  return (
    <section id="faq" className={styles.faqSection} aria-labelledby="faq-title">
      <div>
        <p className={styles.eyebrow}>FAQ</p>
        <h2 id="faq-title">The useful questions before you hand over your data.</h2>
      </div>
      <Accordion
        type="single"
        collapsible
        className={styles.faqList}
        onValueChange={(value) => {
          if (value) trackPlausibleEvent("Public FAQ Item Opened");
        }}
      >
        {marketingFaqs.map((item, index) => (
          <article key={item.question}>
            <AccordionItem value={`faq-${index}`}>
              <AccordionTrigger>{item.question}</AccordionTrigger>
              <AccordionContent>
                <p>{item.answer}</p>
              </AccordionContent>
            </AccordionItem>
          </article>
        ))}
      </Accordion>
    </section>
  );
}
