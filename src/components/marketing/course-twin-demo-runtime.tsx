"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import Image from "next/image";

import { Button } from "@/components/ui/button";

import styles from "./marketing.module.css";

export default function CourseTwinDemoRuntime() {
  const [replay, setReplay] = useState(0);
  const [club, setClub] = useState<"3 Wood" | "Driver">("3 Wood");
  const carry = club === "3 Wood" ? "214–224 yd" : "234–249 yd";

  return (
    <div className={styles.twinRuntime} data-replay={replay}>
      <div className={styles.twinScene} aria-label="Interactive mapped-hole demo">
        <Image
          className={styles.twinAerialImage}
          src="/assets/generated/lmwt-course-twin-aerial.png"
          alt=""
          fill
          sizes="(max-width: 850px) 100vw, 52vw"
        />
        <div className={styles.twinAerialShade} aria-hidden />
        <div className={styles.twinFairway} />
        <div className={styles.twinBunker} />
        <div className={styles.twinGreen} />
        <div className={styles.twinRoute}>
          <i />
          <span />
        </div>
        <div className={styles.twinMarker}>Safe target</div>
      </div>
      <div className={styles.twinRuntimeControls}>
        <div>
          <span>Planned club</span>
          <strong>{club}</strong>
        </div>
        <div>
          <span>Expected carry</span>
          <strong>{carry}</strong>
        </div>
        <div>
          <span>Common miss</span>
          <strong>Right side</strong>
        </div>
        <div className={styles.twinButtons}>
          <Button
            type="button"
            variant="outline"
            onClick={() => setClub((current) => (current === "3 Wood" ? "Driver" : "3 Wood"))}
          >
            Switch club
          </Button>
          <Button type="button" onClick={() => setReplay((current) => current + 1)}>
            <RotateCcw className="size-4" /> Replay route
          </Button>
        </div>
      </div>
    </div>
  );
}
