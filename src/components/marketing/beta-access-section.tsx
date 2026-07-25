import Link from "next/link";
import { ArrowRight, CircleCheck, LogIn } from "lucide-react";

import { Button } from "@/components/ui/button";

import { marketingJoinBetaHref } from "@/lib/marketing-links";
import styles from "./marketing.module.css";

export function BetaAccessSection() {
  return (
    <section className={styles.betaSection} aria-labelledby="beta-title">
      <div>
        <p className={styles.eyebrow}>Beta access</p>
        <h2 id="beta-title">Bring your own evidence. Start with the clearest next action.</h2>
        <p>
          Try the post-session loop: import or connect available launch-monitor data, map clubs,
          review confidence, build a practice session and plan for the course.
        </p>
      </div>
      <div className={styles.betaPanel}>
        <ul>
          <li>
            <CircleCheck className="size-4" />
            Rapsodo CSV import is available
          </li>
          <li>
            <CircleCheck className="size-4" />
            Rapsodo cloud sync depends on current environment configuration
          </li>
          <li>
            <CircleCheck className="size-4" />
            Square is beta; TrackMan remains coming soon unless enabled
          </li>
          <li>
            <CircleCheck className="size-4" />
            Feature availability can depend on plan and configuration
          </li>
        </ul>
        <div className={styles.betaActions}>
          <Button asChild>
            <Link href={marketingJoinBetaHref}>
              Join the beta <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/login">
              Sign in <LogIn className="size-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
