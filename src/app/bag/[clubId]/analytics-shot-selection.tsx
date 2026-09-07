"use client";

import { type ReactNode } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { UntitledSelect } from "@/components/untitled-ui/form-controls";
import { ShotEvidenceSheet } from "@/app/shots/shot-evidence-sheet";

export function AnalyticsShotSelection({
  shots,
  clubs,
  children,
}: {
  shots: Array<{ id: string; label: string }>;
  clubs: Array<{ value: string; label: string }>;
  children: ReactNode;
}) {
  const query = useSearchParams();
  const router = useRouter();
  const selected = shots.find((shot) => shot.id === query.get("shotId")) ?? shots[0];
  function select(id: string) {
    if (!shots.some((shot) => shot.id === id)) return;
    const url = new URL(window.location.href);
    url.searchParams.set("shotId", id);
    window.history.pushState(null, "", url);
  }
  return (
    <div
      className="grid min-w-0 gap-4"
      data-analytics-selection
      onClick={(event) => {
        const target = (event.target as Element).closest<HTMLElement>("[data-analytics-shot-id]");
        if (target?.dataset.analyticsShotId) select(target.dataset.analyticsShotId);
      }}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        const target = (event.target as Element).closest<HTMLElement>("[data-analytics-shot-id]");
        if (target?.dataset.analyticsShotId) {
          event.preventDefault();
          select(target.dataset.analyticsShotId);
        }
      }}
    >
      <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4">
        {selected ? (
          <>
            <div className="min-w-0 flex-1 basis-64">
              <UntitledSelect
                label="Selected analytics shot"
                name="analyticsShot"
                value={selected.id}
                onValueChange={select}
                options={shots.map((shot) => ({ value: shot.id, label: shot.label }))}
              />
            </div>
            <ShotEvidenceSheet
              key={selected.id}
              shotId={selected.id}
              title={selected.label}
              clubs={clubs}
              onComplete={() => router.refresh()}
            />
            <p className="w-full text-sm text-muted-foreground" aria-live="polite">
              Selected: {selected.label}. Open Full evidence for original measurements and review
              history.
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            No saved shots for this club. Import a session to begin.
          </p>
        )}
      </div>
      {children}
    </div>
  );
}
