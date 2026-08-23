import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";

import { billingPlans } from "@/lib/billing-plan-catalog";

import styles from "./cinematic.module.css";
import { Reveal } from "./reveal";

const publicPlans = billingPlans.filter((plan) => !plan.internal);
const joinForBillingHref = "/login?mode=join&next=%2Fbilling";

export function PricingSection() {
  return (
    <section
      id="pricing"
      className={styles.pricingSection}
      aria-labelledby="pricing-title"
      data-scroll-pause="pricing"
    >
      <div className={styles.pricingStage}>
        <div className={styles.pricingBackdrop} aria-hidden>
          <span data-scene-float />
        </div>
        <Reveal className={styles.pricingHeading} from="left">
          <p className={styles.kicker}>Play first. Pay when it earns its place.</p>
          <h2 id="pricing-title">Start free. Upgrade with your game.</h2>
          <p>Four clear levels, from a first measured import to a connected coaching setup.</p>
        </Reveal>

        <Reveal className={styles.pricingDeck} from="up" ariaLabel="LM World Tour pricing plans">
          {publicPlans.map((plan) => (
            <article
              className={styles.pricingCard}
              data-featured={plan.key === "pro" ? "true" : "false"}
              key={plan.key}
            >
              <header>
                <span>{plan.audience}</span>
                <h3>{plan.name}</h3>
              </header>
              <div className={styles.planPrice}>
                <strong>{plan.monthlyPrice}</strong>
                <span>{plan.key === "free" ? "forever" : "/ month"}</span>
              </div>
              <p>{plan.description}</p>
              <ul>
                {plan.features.slice(0, 3).map((feature) => (
                  <li key={feature}>
                    <Check aria-hidden /> {feature}
                  </li>
                ))}
              </ul>
              <footer>
                <span>Yearly {plan.yearlyPrice}</span>
                <Link href={joinForBillingHref}>
                  {plan.key === "free" ? "Start free" : `Choose ${plan.name}`}
                  <ArrowRight aria-hidden />
                </Link>
              </footer>
            </article>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
