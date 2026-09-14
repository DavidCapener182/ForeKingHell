import Link from "next/link";

import { BrandMark } from "@/components/brand-mark";
import { BRAND_CONTACT_EMAIL, BRAND_NAME } from "@/lib/brand";
import { marketingJoinBetaHref } from "@/lib/marketing-links";

import styles from "./cinematic.module.css";

export function MarketingFooter() {
  return (
    <footer className={styles.footer} data-mobile-cta-stop>
      <div className={styles.footerBrand}>
        <BrandMark className={styles.footerMark} sizes="48px" />
        <div>
          <strong>{BRAND_NAME}</strong>
          <p>Measured golf evidence, made playable.</p>
        </div>
      </div>
      <nav aria-label="Footer navigation">
        <a href="#product">Product</a>
        <a href="#practice">Practice</a>
        <a href="#course-twin">Course Twin</a>
        <a href="#faq">FAQ</a>
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
        <Link href="/cookies">Cookie preferences</Link>
        <a href={`mailto:${BRAND_CONTACT_EMAIL}`}>{BRAND_CONTACT_EMAIL}</a>
        <Link href="/login">Sign in</Link>
        <Link href={marketingJoinBetaHref}>Join beta</Link>
      </nav>
      <p className={styles.footerLegal}>
        © {new Date().getFullYear()} {BRAND_NAME}
      </p>
    </footer>
  );
}
