"use client";
import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
  DrawerClose,
} from "@/components/ui/drawer";
import { MobileGroupedList, MobileListRow, MobileDisclosure } from "./mobile-primitives";
import type { MobileTodayChange } from "@/lib/mobile-today-briefing";
import styles from "./mobile-companion.module.css";

const carryFormatter = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 });

export function MobileTodayChangeDetail({ change }: { change: MobileTodayChange }) {
  const [open, setOpen] = useState(false);
  const direction = change.delta < 0 ? "shorter" : "longer";
  const latestCarry = carryFormatter.format(change.latest.value);
  const previousCarry = carryFormatter.format(change.previous.value);
  const changeSummary = `${Math.abs(change.delta)} yd ${direction} on average`;
  return (
    <>
      <button
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
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{change.clubLabel} average carry</DrawerTitle>
            <DrawerDescription>
              Your latest average carry was {Math.abs(change.delta)} yd {direction} than the earlier
              average. Carry is the distance the ball travels before landing.
            </DrawerDescription>
          </DrawerHeader>
          <div className="grid min-h-0 gap-4 overflow-y-auto px-4 pb-4">
            <MobileGroupedList label="Carry comparison">
              <MobileListRow
                label="Latest practice day"
                value={`${latestCarry} yd`}
                detail={`${change.latest.count} trusted carry readings · ${change.latest.dateLabel}`}
              />
              <MobileListRow
                label="Earlier sample"
                value={`${previousCarry} yd`}
                detail={`${change.previous.count} trusted carry readings`}
              />
            </MobileGroupedList>
            <MobileDisclosure
              items={[
                {
                  value: "latest",
                  title: "Latest evidence",
                  content: (
                    <MobileGroupedList>
                      {change.latest.sessions.map((s) => (
                        <MobileListRow
                          key={s.id}
                          label={s.label}
                          detail={`${s.count} carry reading${s.count === 1 ? "" : "s"} · ${s.date}`}
                          href={s.href}
                        />
                      ))}
                    </MobileGroupedList>
                  ),
                },
                {
                  value: "previous",
                  title: "Earlier evidence",
                  content: (
                    <MobileGroupedList>
                      {change.previous.sessions.map((s) => (
                        <MobileListRow
                          key={s.id}
                          label={s.label}
                          detail={`${s.count} carry reading${s.count === 1 ? "" : "s"} · ${s.date}`}
                          href={s.href}
                        />
                      ))}
                    </MobileGroupedList>
                  ),
                },
              ]}
            />
          </div>
          <DrawerFooter>
            <DrawerClose asChild>
              <Button variant="outline" className="min-h-11">
                Done
              </Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
}
