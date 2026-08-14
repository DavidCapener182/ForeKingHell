import { Check, LockKeyhole, MonitorSmartphone, ScanSearch, Sparkles } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

import styles from "./marketing.module.css";

const proof = [
  [ScanSearch, "Traceable imports", "Original rows remain reviewable"],
  [Check, "Confidence shown", "Sample, freshness and signal stay visible"],
  [LockKeyhole, "Private by default", "Account-scoped golf data"],
  [Sparkles, "Read-only AI", "Advice does not write to records"],
  [MonitorSmartphone, "Mobile and desktop", "One golf workspace across devices"],
] as const;

export function TrustStrip() {
  return (
    <Card className={styles.trustStrip} aria-label="Product trust and availability">
      {proof.map(([Icon, title, detail], index) => (
        <CardContent key={title} className={styles.trustItem}>
          <Icon className="size-4" aria-hidden />
          <span>
            <strong>{title}</strong>
            <small>{detail}</small>
          </span>
          {index < proof.length - 1 ? (
            <Separator orientation="vertical" className={styles.trustSeparator} />
          ) : null}
        </CardContent>
      ))}
    </Card>
  );
}
