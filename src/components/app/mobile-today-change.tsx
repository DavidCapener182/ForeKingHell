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

export function MobileTodayChangeDetail({ change }: { change: MobileTodayChange }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        className={styles.change}
        onClick={() => setOpen(true)}
        aria-label={`Inspect ${change.clubLabel} carry change`}
      >
        <div>
          <p className={styles.changeLabel}>{change.clubLabel} carry</p>
          <p className={styles.changeValue}>
            {change.delta > 0 ? "+" : ""}
            {change.delta}
            <span>yd</span>
          </p>
          <p className={styles.changeDetail}>
            {change.latest.dateLabel} · compared with earlier trusted shots
          </p>
        </div>
        <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
      </button>
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{change.clubLabel} carry</DrawerTitle>
            <DrawerDescription>
              Average carry across the latest practice day compared with the earlier trusted sample.
              More distance alone does not prove improvement.
            </DrawerDescription>
          </DrawerHeader>
          <div className="grid min-h-0 gap-4 overflow-y-auto px-4 pb-4">
            <MobileGroupedList label="Carry comparison">
              <MobileListRow
                label="Latest practice day"
                value={`${new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 }).format(change.latest.value)} yd`}
                detail={`${change.latest.count} trusted carry readings · ${change.latest.dateLabel}`}
              />
              <MobileListRow
                label="Earlier sample"
                value={`${new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 }).format(change.previous.value)} yd`}
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
