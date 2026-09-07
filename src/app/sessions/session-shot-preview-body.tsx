"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ShotReviewButton } from "@/app/shots/shot-review-controls";
import { ClubCorrection } from "@/app/shots/club-correction";
import { csvCell } from "@/lib/csv";
import { Button } from "@/components/ui/button";
import type { ShotMasterDetailRow } from "@/app/shots/shots-master-detail-table";
const SelectedShotDetail = dynamic(
  () => import("@/app/shots/shots-master-detail-table").then((module) => module.SelectedShotDetail),
  { loading: () => <p role="status">Loading saved shot details…</p> },
);
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetClose,
} from "@/components/ui/sheet";
import { UntitledSelect } from "@/components/untitled-ui/form-controls";
type Evidence = {
  sessionId: string;
  page: number;
  pages: number;
  total: number;
  shots: ShotMasterDetailRow[];
};
export function SessionShotPreview({
  sessionId,
  editable = false,
  correctionClubs = [],
}: {
  sessionId: string;
  editable?: boolean;
  correctionClubs?: Array<{ value: string; label: string }>;
}) {
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("shot");
  const [dir, setDir] = useState("asc");
  const [loaded, setLoaded] = useState<{ key: string; data: Evidence } | null>(null);
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null);
  const [retry, setRetry] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [tab, setTab] = useState<"overview" | "source" | "history">("overview");
  const dataKey = `${sessionId}:${page}:${sort}:${dir}`;
  const requestKey = `${dataKey}:${retry}`;
  const data = loaded?.key === dataKey ? loaded.data : null;
  const error = failure?.key === requestKey ? failure.message : null;
  const selected = data?.shots.find((shot) => shot.id === selectedId) ?? null;
  useEffect(() => {
    const controller = new AbortController();
    fetch(
      `/api/sessions/${encodeURIComponent(sessionId)}/preview-shots?page=${page}&sort=${sort}&dir=${dir}`,
      { signal: controller.signal, cache: "no-store" },
    )
      .then(async (response) => {
        const body = await response.json().catch(() => null);
        if (!response.ok || !body)
          throw new Error(body?.error ?? "Could not load shot evidence. Try again shortly.");
        return body as Evidence;
      })
      .then((body) => {
        if (!controller.signal.aborted && body.sessionId === sessionId)
          setLoaded({ key: dataKey, data: body });
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setFailure({
            key: requestKey,
            message: e instanceof Error ? e.message : "Could not load evidence.",
          });
      });
    return () => controller.abort();
  }, [sessionId, page, sort, dir, retry, requestKey, dataKey]);
  const inspect = (id: string) => {
    setSelectedId(id);
    setTab("overview");
    setDetailOpen(true);
  };
  function exportPage() {
    if (!data) return;
    const rows = [
      [
        "Shot",
        "Club",
        "Carry (yd)",
        "Total (yd)",
        "Side (yd)",
        "Ball speed (mph)",
        "Source",
        "Review",
      ],
      ...data.shots.map((s) => [
        s.shotNumberLabel,
        s.clubLabel,
        s.carryLabel,
        s.totalLabel,
        s.sideLabel,
        s.ballSpeedLabel,
        s.fileNameLabel,
        s.reviewStatusLabel,
      ]),
    ];
    const csv = rows
      .map((row) => row.map((value) => csvCell(String(value))).join(","))
      .join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `session-${sessionId}-page-${data.page}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <section
      className="grid min-w-0 gap-3"
      aria-label="Session shot evidence"
      data-session-shot-preview
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <UntitledSelect
          label="Sort shots"
          name="previewSort"
          value={sort}
          onValueChange={(value) => {
            setSort(value);
            setPage(1);
          }}
          options={[
            { value: "shot", label: "Shot number" },
            { value: "carry", label: "Carry distance" },
          ]}
        />
        <UntitledSelect
          label="Order"
          name="previewOrder"
          value={dir}
          onValueChange={(value) => {
            setDir(value);
            setPage(1);
          }}
          options={[
            { value: "asc", label: "Ascending" },
            { value: "desc", label: "Descending" },
          ]}
        />
      </div>
      {error ? (
        <div role="alert" className="rounded-lg border p-4">
          <p>{error}</p>
          <Button variant="outline" className="mt-2 min-h-11" onClick={() => setRetry(retry + 1)}>
            Try again
          </Button>
        </div>
      ) : !data ? (
        <p role="status" className="py-4 text-sm text-muted-foreground">
          Loading this session’s shot evidence…
        </p>
      ) : (
        <>
          <p role="status" className="text-sm text-muted-foreground">
            {data.total} shots · Page {data.page} of {data.pages}. Missing measurements remain
            unavailable.
          </p>
          {data.shots.length ? (
            <>
              <div
                className="hidden overflow-x-auto rounded-lg border sm:block"
                role="region"
                aria-label="Session shots table"
                tabIndex={0}
              >
                <table className="w-full text-sm">
                  <caption className="sr-only">
                    Current page of measured shots. Select Inspect for every field.
                  </caption>
                  <thead>
                    <tr className="border-b text-left">
                      <th
                        scope="col"
                        className="p-2"
                        aria-sort={
                          sort === "shot" ? (dir === "asc" ? "ascending" : "descending") : "none"
                        }
                      >
                        Shot
                      </th>
                      <th scope="col" className="p-2">
                        Club
                      </th>
                      <th
                        scope="col"
                        className="p-2 text-right"
                        aria-sort={
                          sort === "carry" ? (dir === "asc" ? "ascending" : "descending") : "none"
                        }
                      >
                        Carry (yd)
                      </th>
                      <th scope="col" className="p-2 text-right">
                        Total (yd)
                      </th>
                      <th scope="col" className="p-2">
                        Details
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.shots.map((shot) => (
                      <tr key={shot.id} className="border-b last:border-0">
                        <th scope="row" className="p-2 text-left font-normal">
                          {shot.shotNumberLabel}
                        </th>
                        <td className="p-2">{shot.clubLabel}</td>
                        <td className="p-2 text-right tabular-nums">{shot.carryLabel}</td>
                        <td className="p-2 text-right tabular-nums">{shot.totalLabel}</td>
                        <td className="p-2">
                          <Button
                            variant="outline"
                            className="min-h-11"
                            onClick={() => inspect(shot.id)}
                          >
                            Inspect<span className="sr-only"> shot {shot.shotNumberLabel}</span>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="grid divide-y rounded-lg border sm:hidden">
                {data.shots.map((shot) => (
                  <button
                    key={shot.id}
                    onClick={() => inspect(shot.id)}
                    className="grid min-h-14 gap-1 p-3 text-left focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <span className="font-medium">
                      {shot.clubLabel} · Shot {shot.shotNumberLabel}
                    </span>
                    <span className="text-sm">
                      Carry {shot.carryLabel} yd · Total {shot.totalLabel} yd
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {shot.reviewStatusLabel} · Tap for source and all fields
                    </span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="rounded-lg border p-4 text-sm">
              No measured shots are attached to this session. The session and its saved score remain
              available.
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button
              variant="outline"
              className="min-h-11"
              disabled={data.page <= 1}
              onClick={() => setPage(data.page - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              className="min-h-11"
              disabled={!data.shots.length}
              onClick={exportPage}
            >
              Export this page
            </Button>
            <Button
              variant="outline"
              className="min-h-11"
              disabled={data.page >= data.pages}
              onClick={() => setPage(data.page + 1)}
            >
              Next
            </Button>
          </div>
          <Link
            href={`/shots?session=${sessionId}`}
            className="inline-flex min-h-11 items-center text-sm text-primary underline"
          >
            Open full shot workspace
          </Link>
        </>
      )}
      <Sheet open={detailOpen && Boolean(selected)} onOpenChange={setDetailOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[90dvh] overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))]"
          showCloseButton={false}
        >
          <SheetHeader>
            <SheetTitle>
              {selected
                ? `${selected.clubLabel} · Shot ${selected.shotNumberLabel}`
                : "Shot details"}
            </SheetTitle>
            <SheetDescription>
              {selected?.fileNameLabel ?? "Original source and review history"}
            </SheetDescription>
          </SheetHeader>
          {editable && selected ? (
            <div className="grid gap-3 px-4">
              <ShotReviewButton
                shotId={selected.id}
                reviewStatus={selected.reviewStatus}
                onComplete={() => setRetry((value) => value + 1)}
              />
              <ClubCorrection
                shotId={selected.id}
                clubs={correctionClubs}
                onComplete={() => setRetry((value) => value + 1)}
              />
            </div>
          ) : null}
          {detailOpen && selected ? (
            <SelectedShotDetail
              key={selected.id}
              shot={selected}
              tab={tab}
              onTabChange={setTab}
              showActions={false}
            />
          ) : null}
          <SheetClose asChild>
            <Button variant="outline" className="mx-4 min-h-11">
              Close shot details
            </Button>
          </SheetClose>
        </SheetContent>
      </Sheet>
    </section>
  );
}
