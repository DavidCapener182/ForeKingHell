"use client";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetClose,
} from "@/components/ui/sheet";
import type { RealityFlightLine } from "@/lib/reality-handicap";
export type LabEvidenceRow = {
  id: string;
  title: string;
  summary: string;
  fields: Array<{ label: string; value: string; href?: string }>;
  href?: string;
};
export function LabEvidenceList({
  rows,
  title,
  children,
}: {
  rows: LabEvidenceRow[];
  title: string;
  children?: ReactNode;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<LabEvidenceRow | null>(null);
  const visible = rows.filter((row) =>
    `${row.title} ${row.summary}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <div
      className="grid min-w-0 gap-3"
      onClick={(event) => {
        const id = (event.target as Element)
          .closest("[data-lab-shot-id]")
          ?.getAttribute("data-lab-shot-id");
        if (id) setSelected(rows.find((row) => row.id === id) ?? null);
      }}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        const id = (event.target as Element).getAttribute("data-lab-shot-id");
        if (id) {
          event.preventDefault();
          setSelected(rows.find((row) => row.id === id) ?? null);
        }
      }}
    >
      {children}
      <Input
        aria-label={`Search ${title.toLowerCase()}`}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={`Search ${title.toLowerCase()}…`}
      />
      <p role="status" className="text-sm text-muted-foreground">
        {visible.length} matching records
      </p>
      <div className="max-h-80 overflow-y-auto divide-y rounded-xl border">
        {visible.map((row) => (
          <Button
            key={row.id}
            variant="ghost"
            className="h-auto min-h-14 w-full flex-col items-start whitespace-normal p-3 text-left"
            onClick={() => setSelected(row)}
          >
            <span className="font-semibold">{row.title}</span>
            <span className="text-sm font-normal text-muted-foreground">{row.summary}</span>
          </Button>
        ))}
        {!visible.length && <p className="p-4">No matching records.</p>}
      </div>
      <Sheet
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <SheetContent className="w-full sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>{selected?.title ?? title}</SheetTitle>
            <SheetDescription>{selected?.summary ?? "Complete recorded evidence"}</SheetDescription>
          </SheetHeader>
          <dl className="grid min-h-0 flex-1 gap-3 overflow-y-auto p-4">
            {selected?.fields.map((field) => (
              <div key={field.label}>
                <dt className="text-xs text-muted-foreground">{field.label}</dt>
                <dd className="break-words text-sm font-medium">
                  {field.href ? (
                    <a className="text-primary underline" href={field.href}>
                      {field.value}
                    </a>
                  ) : (
                    field.value
                  )}
                </dd>
              </div>
            ))}
          </dl>
          <div className="grid gap-2 border-t p-4">
            {selected?.href && (
              <Button asChild>
                <a href={selected.href}>Open source evidence</a>
              </Button>
            )}
            <SheetClose asChild>
              <Button variant="outline">Close details</Button>
            </SheetClose>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
export function LabShotEvidence({
  lines,
  children,
}: {
  lines: RealityFlightLine[];
  children: ReactNode;
}) {
  return (
    <LabEvidenceList
      title="Plotted shots"
      rows={lines.map((line, index) => ({
        id: line.id,
        title: `${line.clubLabel} · shot ${index + 1}`,
        summary: `${line.carryYd.toFixed(1)} yd carry · ${line.sideYd.toFixed(1)} yd side`,
        href: `/shots?shotId=${encodeURIComponent(line.id)}`,
        fields: [
          { label: "Shot ID", value: line.id },
          { label: "Carry", value: `${line.carryYd} yd` },
          { label: "Side carry (signed)", value: `${line.sideYd} yd` },
          {
            label: "Launch direction",
            value:
              line.launchDirectionDeg === null ? "Not recorded" : `${line.launchDirectionDeg}°`,
          },
          { label: "Modelled score cost", value: String(line.scoreCost) },
          { label: "Evidence inclusion", value: line.included ? "Included" : "Excluded" },
          {
            label: "Model interpretation",
            value: line.isDirectionalDamage
              ? "Directional danger"
              : line.isCostly
                ? "Carry or strike cost"
                : "Playable plotted shot",
          },
        ],
      }))}
    >
      {children}
    </LabEvidenceList>
  );
}
