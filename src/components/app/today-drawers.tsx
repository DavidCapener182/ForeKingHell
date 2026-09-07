"use client";
import type { ReactNode } from "react";
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
export function TodayEvidenceDrawer({
  open,
  onOpenChange,
  onRestoreFocus,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRestoreFocus: () => void;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onRestoreFocus();
        }}
      >
        <DrawerHeader>
          <DrawerTitle>{title}</DrawerTitle>
          <DrawerDescription>{description}</DrawerDescription>
        </DrawerHeader>
        <div className="min-h-0 overflow-y-auto px-4 pb-4">{children}</div>
        <DrawerFooter>
          <DrawerClose asChild>
            <Button variant="outline" className="min-h-11">
              Done
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
export function TodayChangeDrawer({
  open,
  setOpen,
  onRestoreFocus,
  change,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  onRestoreFocus: () => void;
  change: MobileTodayChange;
}) {
  const direction = change.delta < 0 ? "shorter" : "longer";
  const formatter = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 });
  const latestCarry = formatter.format(change.latest.value);
  const previousCarry = formatter.format(change.previous.value);
  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerContent
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onRestoreFocus();
        }}
      >
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
  );
}
