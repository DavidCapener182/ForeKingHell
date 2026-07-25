import Link from "next/link";

import { BRAND_NAME } from "@/lib/brand";
import { marketingJoinBetaHref } from "@/lib/marketing-links";

import styles from "./marketing.module.css";

export function MarketingFooter() {
  return (
    <footer className={styles.footer}>
      <div>
        <strong>{BRAND_NAME}</strong>
        <p>Measured golf evidence, turned into the next useful decision.</p>
      </div>
      <nav aria-label="Footer navigation">
        <a href="#product">Product</a>
        <a href="#how-it-works">How it works</a>
        <a href="#course-twin">Course Twin</a>
        <a href="#faq">FAQ</a>
        <Link href="/privacy">Privacy</Link>
        <Link href="/login">Sign in</Link>
        <Link href={marketingJoinBetaHref}>Join beta</Link>
      </nav>
      <p className={styles.footerLegal}>
        © {new Date().getFullYear()} {BRAND_NAME}
      </p>
    </footer>
  );
}
