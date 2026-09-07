"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import dynamic from "next/dynamic";
import type { ShotMasterDetailRow } from "./shots-master-detail-table";
const SelectedShotDetail = dynamic(
  () => import("./shots-master-detail-table").then((module) => module.SelectedShotDetail),
  {
    loading: () => (
      <p role="status" className="p-4">
        Loading shot detail…
      </p>
    ),
  },
);
import { ClubCorrection } from "./club-correction";
export function ShotEvidenceSheet({
  shotId,
  title,
  clubs,
  onComplete,
}: {
  shotId: string;
  title: string;
  clubs: Array<{ value: string; label: string }>;
  onComplete?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [revision, setRevision] = useState(0);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" className="min-h-11">
          Full evidence
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-xl" showCloseButton={false}>
        <SheetHeader className="border-b">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>
            Original measurements, flight evidence and review history for this exact shot.
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {open && <Evidence key={`${shotId}:${revision}`} shotId={shotId} />}
        </div>
        <div className="grid gap-2 border-t px-4 pt-2 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <ClubCorrection
            shotId={shotId}
            clubs={clubs}
            onComplete={() => {
              setRevision((n) => n + 1);
              onComplete?.();
            }}
          />
          <SheetClose asChild>
            <Button className="min-h-11" variant="outline">
              Close evidence
            </Button>
          </SheetClose>
        </div>
      </SheetContent>
    </Sheet>
  );
}
function Evidence({ shotId }: { shotId: string }) {
  const [shot, setShot] = useState<ShotMasterDetailRow | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [tab, setTab] = useState<"overview" | "source" | "history">("overview");
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/shots/${encodeURIComponent(shotId)}/evidence`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        const body = await response.json().catch(() => null);
        if (!response.ok || !body?.shot || body.shot.id !== shotId)
          throw new Error(body?.error ?? "Could not load shot evidence.");
        return body.shot as ShotMasterDetailRow;
      })
      .then((value) => {
        if (!controller.signal.aborted) {
          setShot(value);
          setError("");
        }
      })
      .catch((cause) => {
        if (!controller.signal.aborted)
          setError(cause instanceof Error ? cause.message : "Could not load evidence.");
      });
    return () => controller.abort();
  }, [shotId, attempt]);
  if (error)
    return (
      <div className="grid gap-3 p-4">
        <p role="alert">{error}</p>
        <Button
          onClick={() => {
            setError("");
            setAttempt((n) => n + 1);
          }}
        >
          Retry evidence
        </Button>
      </div>
    );
  if (!shot)
    return (
      <p role="status" className="p-4">
        Loading shot evidence…
      </p>
    );
  return <SelectedShotDetail shot={shot} tab={tab} onTabChange={setTab} showActions={false} />;
}
