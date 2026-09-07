"use client";
import { useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { UntitledSelect } from "@/components/untitled-ui/form-controls";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import styles from "./bag-visual-controls.module.css";
export function BagClubViews({
  label,
  items,
}: {
  label: string;
  items: Array<{ id: string; label: string; content: ReactNode }>;
}) {
  const query = useSearchParams();
  const selected = query.get("clubId") ?? items[0]?.id ?? "";
  const setSelected = (value: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set("clubId", value);
    window.history.pushState(null, "", `${url.pathname}${url.search}${url.hash}`);
  };
  const current = items.find((item) => item.id === selected) ?? items[0];
  return (
    <div className="grid min-w-0 gap-3">
      <UntitledSelect
        label={label}
        name={label}
        value={current?.id ?? ""}
        onValueChange={setSelected}
        options={items.map(({ id, label }) => ({ value: id, label }))}
      />
      {current?.content}
    </div>
  );
}
export function BagVisualLayers({ children, summary }: { children: ReactNode; summary: string }) {
  const [window, setWindow] = useState(true);
  const [median, setMedian] = useState(true);
  return (
    <div className={styles.layers} data-window={window} data-median={median}>
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" className="min-h-11">
            Pattern layers
          </Button>
        </SheetTrigger>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Pattern layers</SheetTitle>
            <SheetDescription>
              Measured carry and offline window, with a separate median marker. Toggling a layer
              does not change the sample.
            </SheetDescription>
          </SheetHeader>
          <div className="grid gap-3 p-4">
            <label className="flex min-h-11 items-center gap-3">
              <input
                className="size-5"
                type="checkbox"
                checked={window}
                onChange={(e) => setWindow(e.target.checked)}
              />
              Measured window
            </label>
            <label className="flex min-h-11 items-center gap-3">
              <input
                className="size-5"
                type="checkbox"
                checked={median}
                onChange={(e) => setMedian(e.target.checked)}
              />
              Median carry marker
            </label>
            <Button
              variant="outline"
              onClick={() => {
                setWindow(true);
                setMedian(true);
              }}
            >
              Reset layers
            </Button>
            <SheetClose asChild>
              <Button>Close layers</Button>
            </SheetClose>
          </div>
        </SheetContent>
      </Sheet>
      {children}
      <p className="mt-3 text-sm leading-6">{summary}</p>
      <p className="mt-2 text-xs text-muted-foreground">
        Shaded rectangle: measured P10–P90 carry and side window. Dot: median carry. Dashed line:
        target line.
      </p>
    </div>
  );
}
