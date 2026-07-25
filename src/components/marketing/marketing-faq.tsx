"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { trackPlausibleEvent } from "@/lib/analytics";
import { marketingFaqs } from "@/lib/marketing-demo-data";

import styles from "./marketing.module.css";

export function MarketingFaq() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <section id="faq" className={styles.faqSection} aria-labelledby="faq-title">
      <div>
        <p className={styles.eyebrow}>FAQ</p>
        <h2 id="faq-title">The useful questions before you hand over your data.</h2>
      </div>
      <div className={styles.faqList}>
        {marketingFaqs.map((item, index) => {
          const isOpen = open === index;
          const id = `marketing-faq-${index}`;
          return (
            <article key={item.question}>
              <h3>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={id}
                  onClick={() => {
                    setOpen(isOpen ? null : index);
                    if (!isOpen) trackPlausibleEvent("Public FAQ Item Opened");
                  }}
                >
                  <span>{item.question}</span>
                  <ChevronDown className="size-5" aria-hidden />
                </button>
              </h3>
              <div id={id} hidden={!isOpen}>
                <p>{item.answer}</p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
