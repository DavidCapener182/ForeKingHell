"use client";
import { useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import dynamic from "next/dynamic";
const TodayChangeDrawer = dynamic(
  () => import("./today-drawers").then((module) => module.TodayChangeDrawer),
  { loading: () => <p role="status">Loading evidence…</p> },
);
import type { MobileTodayChange } from "@/lib/mobile-today-briefing";
import styles from "./mobile-companion.module.css";

const carryFormatter = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 });

export function MobileTodayChangeDetail({ change }: { change: MobileTodayChange }) {
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [visited, setVisited] = useState(false);
  if (open && !visited) setVisited(true);
  const direction = change.delta < 0 ? "shorter" : "longer";
  const latestCarry = carryFormatter.format(change.latest.value);
  const previousCarry = carryFormatter.format(change.previous.value);
  const changeSummary = `${Math.abs(change.delta)} yd ${direction} on average`;
  return (
    <>
      <button
        ref={trigger}
        className={styles.change}
        onClick={() => setOpen(true)}
        aria-label={`${change.clubLabel}: ${changeSummary}. Latest average ${latestCarry} yd; earlier average ${previousCarry} yd. View comparison.`}
      >
        <div>
          <p className={styles.changeLabel}>{change.clubLabel} average carry</p>
          <p className={styles.changeValue}>
            {Math.abs(change.delta)}
            <span>yd {direction} on average</span>
          </p>
          <p className={styles.changeDetail}>
            Latest average: {latestCarry} yd · Earlier average: {previousCarry} yd
          </p>
          <p className={styles.changeDetail}>Latest practice: {change.latest.dateLabel}</p>
        </div>
        <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
      </button>
      {visited ? (
        <TodayChangeDrawer
          open={open}
          setOpen={setOpen}
          change={change}
          onRestoreFocus={() => trigger.current?.focus()}
        />
      ) : null}
    </>
  );
}
