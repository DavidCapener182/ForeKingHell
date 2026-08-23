import { ArrowRight, Check, LogIn } from "lucide-react";
import Link from "next/link";

import { marketingJoinBetaHref } from "@/lib/marketing-links";

import styles from "./cinematic.module.css";
import { Reveal } from "./reveal";

export function BetaAccessSection() {
  return (
    <section className={styles.finalCta} aria-labelledby="beta-title" data-scroll-pause="beta">
      <div className={styles.finalCtaStage}>
        <picture className={styles.finalCtaImage}>
          <source media="(max-width: 767px)" srcSet="/assets/landing/final-green-mobile.avif" />
          <img
            src="/assets/landing/final-green-desktop.avif"
            alt="A quiet golf green and flag in the last light of the day"
            width="1825"
            height="862"
            loading="lazy"
            decoding="async"
            data-scene-parallax
          />
        </picture>
        <span className={styles.finalCtaShade} aria-hidden />
        <Reveal className={styles.finalCtaCopy} from="left">
          <p className={styles.kicker}>Your next session starts here</p>
          <h2 id="beta-title">Stop collecting shots. Start using them.</h2>
          <p>
            Bring available launch-monitor evidence into one place, then follow the clearest next
            action.
          </p>
          <div className={styles.finalCtaActions}>
            <Link href={marketingJoinBetaHref} className={styles.primaryAction}>
              Join the beta <ArrowRight aria-hidden />
            </Link>
            <Link href="/login" className={styles.finalSignIn}>
              Existing golfer <LogIn aria-hidden />
            </Link>
          </div>
        </Reveal>
        <Reveal
          as="ul"
          className={styles.finalProof}
          from="right"
          ariaLabel="Beta availability summary"
        >
          <li>
            <Check aria-hidden /> Rapsodo CSV available
          </li>
          <li>
            <Check aria-hidden /> Demo data clearly labelled
          </li>
          <li>
            <Check aria-hidden /> Provider availability varies
          </li>
        </Reveal>
      </div>
    </section>
  );
}
