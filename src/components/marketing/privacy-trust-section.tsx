import Link from "next/link";
import Image from "next/image";
import { Database, Eye, FileDown, LockKeyhole, Sparkles } from "lucide-react";

import styles from "./cinematic.module.css";
import { Reveal } from "./reveal";

const commitments = [
  [LockKeyhole, "Account-scoped data", "Your golf records are scoped to your account."],
  [
    Database,
    "Traceable evidence",
    "Imported records remain available to review beside derived conclusions.",
  ],
  [Eye, "Visible data health", "Confidence and data-quality warnings stay in the decision flow."],
  [Sparkles, "Read-only Data Chat", "AI can explain your records, not alter them."],
  [
    FileDown,
    "Controls you can review",
    "Visibility, sharing, export and deletion controls are available where implemented.",
  ],
] as const;

export function PrivacyTrustSection() {
  return (
    <section
      id="privacy"
      className={styles.privacySection}
      aria-labelledby="privacy-title"
      data-scroll-pause="privacy"
    >
      <div className={styles.privacyStage}>
        <div className={styles.privacyImage} aria-hidden>
          <Image
            src="/assets/landing/privacy-evidence.avif"
            alt=""
            width="1800"
            height="1013"
            sizes="100vw"
            loading="lazy"
            data-scene-parallax
          />
          <span />
        </div>
        <Reveal className={styles.privacyHeading} from="left">
          <p className={styles.kicker}>Privacy, AI and data trust</p>
          <h2 id="privacy-title">No black boxes in the bag.</h2>
          <p>
            LM World Tour is designed so golf decisions can be inspected: the data source, the
            evidence quality and the boundary around AI remain visible.
          </p>
          <Link href="/privacy">Read the current privacy notice</Link>
        </Reveal>
        <div className={styles.privacyGrid}>
          {commitments.map(([Icon, title, detail], index) => (
            <Reveal as="article" from="up" key={title}>
              <span>0{index + 1}</span>
              <Icon className="size-5" aria-hidden />
              <div>
                <h3>{title}</h3>
                <p>{detail}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
