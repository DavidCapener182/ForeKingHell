"use client";
import { useState } from "react";
import { DesktopWorkbenchControls } from "@/components/app/desktop-workbench-controls";
import { csvCell } from "@/lib/csv";
import { Button } from "@/components/ui/button";
import { UntitledSelect, UntitledTextField } from "@/components/untitled-ui/form-controls";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { formatClubType } from "@/lib/club-format";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableCaption,
} from "@/components/ui/table";
const clubOptions = [
  "driver",
  "3w",
  "5w",
  "7w",
  "3h",
  "4h",
  "5h",
  "3i",
  "4i",
  "5i",
  "6i",
  "7i",
  "8i",
  "9i",
  "pw",
  "gw",
  "aw",
  "sw",
  "lw",
  "putter",
];
export type ShotPreviewRow = {
  fileId?: string;
  fileName: string;
  rowNumber: number;
  clubKey: string;
  clubLabel: string;
  clubType?: string;
  clubBrand: string | null;
  fileShotNumber: number;
  carryYd: number | null;
  totalYd: number | null;
  ballSpeedMph: number | null;
  launchAngleDeg: number | null;
  sideCarryYd: number | null;
  warnings?: string[];
  clubIdentityProvenance?: string;
  correctedClub?: string;
  courseShot: {
    holeNumber: number;
    holeShotNumber: number;
    distanceRemainingYd: number | null;
  } | null;
};
const previewMetrics = ["carry", "total", "ball-speed", "launch", "side"];
const importShotPreviewColumns = [
  { id: "file", label: "Source file and row", locked: true },
  { id: "club", label: "Club", locked: true },
  { id: "carry", label: "Carry (yd)" },
  { id: "total", label: "Total (yd)" },
  { id: "ball-speed", label: "Ball speed (mph)" },
  { id: "launch", label: "Launch (deg)" },
  { id: "side", label: "Side carry (yd)" },
  { id: "review", label: "Review and corrections", locked: true },
];
const metric = (value: number | null | undefined) =>
  value === null || value === undefined
    ? "Unavailable"
    : new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 }).format(value);
export function ShotPreview({
  shots,
  isCourseUpload,
  onClubChange,
}: {
  shots: ShotPreviewRow[];
  isCourseUpload: boolean;
  onClubChange?: (fileId: string, row: number, club: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const identity = (shot: ShotPreviewRow) => `${shot.fileId ?? shot.fileName}:${shot.rowNumber}`;
  const filtered = shots.filter((shot) =>
    `${shot.fileName} ${shot.correctedClub ?? shot.clubLabel} ${shot.fileShotNumber}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const lastPage = Math.max(0, Math.ceil(filtered.length / 20) - 1);
  const current = Math.min(page, lastPage);
  const visible = filtered.slice(current * 20, current * 20 + 20);
  const active = shots.find((shot) => identity(shot) === selected);
  const needsReview = (shot: ShotPreviewRow) =>
    !shot.correctedClub &&
    (shot.clubType === "unknown" ||
      shot.clubType === "other" ||
      ["unknown", "inferred"].includes(shot.clubIdentityProvenance ?? ""));
  const unresolved = shots.filter(needsReview).length;
  function exportFilteredShots() {
    const rows = [
      [
        "File",
        "Source row",
        "Shot",
        "Club",
        "Carry (yd)",
        "Total (yd)",
        "Ball speed (mph)",
        "Launch (deg)",
        "Side carry (yd)",
        "Hole",
        "Warnings",
      ],
      ...filtered.map((shot) => [
        shot.fileName,
        shot.rowNumber,
        shot.fileShotNumber,
        shot.correctedClub ?? shot.clubLabel,
        shot.carryYd ?? "",
        shot.totalYd ?? "",
        shot.ballSpeedMph ?? "",
        shot.launchAngleDeg ?? "",
        shot.sideCarryYd ?? "",
        shot.courseShot?.holeNumber ?? "",
        (shot.warnings ?? []).join("; "),
      ]),
    ];
    const csv = rows
      .map((row) => row.map((value) => csvCell(String(value))).join(","))
      .join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "import-preview-filtered.csv";
    link.click();
    URL.revokeObjectURL(url);
  }
  return (
    <section
      className="min-w-0 rounded-xl border border-border bg-card"
      data-import-shot-preview
      data-workbench-scope="import-shot-preview"
    >
      <header className="grid gap-2 border-b border-border p-4">
        <h2 className="text-lg font-semibold">Review shots</h2>
        <p className="text-sm text-muted-foreground">
          {shots.length} parsed shots · {unresolved} clubs need confirmation. Carry and total remain
          separate. Distances below use yards.
        </p>
        <UntitledTextField
          type="search"
          label="Find a shot"
          name="shot-preview-search"
          value={search}
          onValueChange={(value) => {
            setSearch(value);
            setPage(0);
          }}
          placeholder="File, club or shot number"
        />
        <DesktopWorkbenchControls
          viewKey="import-shot-preview"
          scope="import-shot-preview"
          currentViewLabel="Import preview"
          resultLabel={`${filtered.length} filtered shots`}
          columns={importShotPreviewColumns}
          showExport={false}
          localView={{
            state: { search },
            restore: (state) => {
              setSearch(typeof state.search === "string" ? state.search : "");
              setPage(0);
            },
          }}
        />
        <Button
          variant="outline"
          className="min-h-11 justify-self-start"
          disabled={!filtered.length}
          onClick={exportFilteredShots}
        >
          Export {filtered.length} filtered shots
        </Button>
      </header>
      {unresolved ? (
        <p role="status" className="px-4 pt-3 text-sm text-destructive">
          Open a shot marked “Confirm club” to resolve its identity before saving.
        </p>
      ) : null}
      <div className="p-3">
        <ul className="divide-y divide-border lg:hidden">
          {visible.map((shot) => (
            <li key={identity(shot)}>
              <button
                type="button"
                onClick={() => setSelected(identity(shot))}
                className="grid min-h-16 w-full gap-1 rounded-lg px-2 py-3 text-left focus-visible:outline-2 focus-visible:outline-ring"
              >
                <span className="flex flex-wrap justify-between gap-2 font-semibold">
                  <span>
                    {shot.correctedClub ? formatClubType(shot.correctedClub) : shot.clubLabel} ·
                    Shot {shot.fileShotNumber}
                  </span>
                  <span className="text-xs text-primary">
                    {needsReview(shot) ? "Confirm club" : "Review details"}
                  </span>
                </span>
                <span className="break-words text-xs text-muted-foreground">
                  {shot.fileName} · Source row {shot.rowNumber}
                </span>
                <span className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
                  <span className="whitespace-nowrap" data-column="carry">
                    Carry {metric(shot.carryYd)} yd{" "}
                  </span>
                  <span className="whitespace-nowrap" data-column="total">
                    Total {metric(shot.totalYd)} yd{" "}
                  </span>
                  <span className="whitespace-nowrap" data-column="ball-speed">
                    Ball {metric(shot.ballSpeedMph)} mph{" "}
                  </span>
                  <span className="whitespace-nowrap" data-column="launch">
                    Launch {metric(shot.launchAngleDeg)}°{" "}
                  </span>
                  <span className="whitespace-nowrap" data-column="side">
                    Side {metric(shot.sideCarryYd)} yd
                  </span>
                </span>
                {shot.warnings?.length ? (
                  <span className="text-xs text-destructive">
                    {shot.warnings.length} source warnings
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
        <div
          className="hidden overflow-x-auto rounded-lg border border-border lg:block"
          tabIndex={0}
          role="region"
          aria-label="Parsed shot measurements"
        >
          <Table data-workbench-export-table="import-shot-preview">
            <TableCaption>
              Current import preview. Showing {visible.length} of {filtered.length} matching rows.
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead scope="col" data-column="file" className="sticky left-0 z-20 bg-card">
                  Source file / row
                </TableHead>
                <TableHead scope="col">Club</TableHead>
                <TableHead scope="col" data-column="carry" className="text-right">
                  Carry yd
                </TableHead>
                <TableHead scope="col" data-column="total" className="text-right">
                  Total yd
                </TableHead>
                <TableHead scope="col" data-column="ball-speed" className="text-right">
                  Ball mph
                </TableHead>
                <TableHead scope="col" data-column="launch" className="text-right">
                  Launch °
                </TableHead>
                <TableHead scope="col" data-column="side" className="text-right">
                  Side yd
                </TableHead>
                <TableHead scope="col">Review</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((shot) => (
                <TableRow key={identity(shot)}>
                  <TableCell
                    data-column="file"
                    className="sticky left-0 z-10 max-w-64 whitespace-normal break-words bg-card"
                  >
                    {shot.fileName}
                    <span className="block text-xs text-muted-foreground">
                      Shot {shot.fileShotNumber} · Source row {shot.rowNumber}
                    </span>
                  </TableCell>
                  <TableCell>
                    {shot.correctedClub ? formatClubType(shot.correctedClub) : shot.clubLabel}
                  </TableCell>
                  {[
                    shot.carryYd,
                    shot.totalYd,
                    shot.ballSpeedMph,
                    shot.launchAngleDeg,
                    shot.sideCarryYd,
                  ].map((value, index) => (
                    <TableCell
                      key={index}
                      data-column={previewMetrics[index]}
                      className="text-right tabular-nums"
                    >
                      {metric(value)}
                    </TableCell>
                  ))}
                  <TableCell>
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-11"
                      onClick={() => setSelected(identity(shot))}
                    >
                      {needsReview(shot) ? "Confirm club" : "Details"}
                      {shot.warnings?.length ? ` · ${shot.warnings.length} warnings` : ""}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {!filtered.length ? (
          <p className="p-4 text-sm text-muted-foreground">
            {shots.length
              ? "No shots match this search. Clear the search to review the batch."
              : "Choose CSV files to preview measurements."}
          </p>
        ) : null}
        <nav
          aria-label="Shot preview pages"
          className="mt-3 flex flex-wrap items-center justify-between gap-2"
        >
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={current === 0}
            onClick={() => setPage(current - 1)}
          >
            Previous
          </Button>
          <span className="text-sm" role="status">
            Page {current + 1} of {lastPage + 1} · {filtered.length} rows
          </span>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={current >= lastPage}
            onClick={() => setPage(current + 1)}
          >
            Next
          </Button>
        </nav>
      </div>
      <Sheet
        open={Boolean(active)}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Shot {active?.fileShotNumber} review</SheetTitle>
            <SheetDescription className="break-words">
              {active?.fileName} · Source row {active?.rowNumber}
            </SheetDescription>
          </SheetHeader>
          {active ? (
            <div className="grid gap-4 p-4">
              <dl className="grid grid-cols-2 gap-3">
                {[
                  ["Source club", active.clubLabel],
                  ["Brand", active.clubBrand ?? "Unavailable"],
                  ["Carry yd", metric(active.carryYd)],
                  ["Total yd", metric(active.totalYd)],
                  ["Ball speed mph", metric(active.ballSpeedMph)],
                  ["Launch °", metric(active.launchAngleDeg)],
                  ["Side yd", metric(active.sideCarryYd)],
                  ...(isCourseUpload
                    ? [
                        [
                          "Hole",
                          active.courseShot
                            ? `${active.courseShot.holeNumber}.${active.courseShot.holeShotNumber}`
                            : "Unassigned",
                        ],
                        ["Remaining yd", metric(active.courseShot?.distanceRemainingYd)],
                      ]
                    : []),
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                    <dd className="mt-1 break-words text-sm font-medium">{value}</dd>
                  </div>
                ))}
              </dl>
              {active.warnings?.length ? (
                <div>
                  <h3 className="font-semibold">Source warnings</h3>
                  <ul className="mt-2 list-disc space-y-2 pl-4 text-sm">
                    {active.warnings.map((warning, index) => (
                      <li key={index}>{warning}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {onClubChange && active.fileId ? (
                <UntitledSelect
                  label="Confirm club"
                  name="preview-club"
                  value={active.correctedClub ?? ""}
                  onValueChange={(value) => onClubChange(active.fileId!, active.rowNumber, value)}
                  options={[
                    { value: "", label: "Keep source club" },
                    ...clubOptions.map((value) => ({ value, label: formatClubType(value) })),
                  ]}
                  description="Your correction is saved with this source row. Original file evidence remains intact."
                  error={needsReview(active) ? "Choose the club used for this shot." : undefined}
                />
              ) : null}
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                onClick={() => setSelected(null)}
              >
                Back to preview
              </Button>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </section>
  );
}
