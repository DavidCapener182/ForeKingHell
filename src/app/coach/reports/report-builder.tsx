"use client";
import { useRef, useState, useTransition, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { coachReportSectionIds, type CoachReportSectionId } from "@/lib/coach-report";
import { createCoachReportWithStateAction } from "./actions";
const subscribeReady = () => () => {};
type Copy = Record<CoachReportSectionId, { title: string; detail: string; checked: boolean }>;
export function ReportBuilder({
  copy,
  templates,
  includeComparisons = false,
}: {
  copy: Copy;
  templates: Array<{ value: string; label: string }>;
  includeComparisons?: boolean;
}) {
  const ready = useSyncExternalStore(
    subscribeReady,
    () => true,
    () => false,
  );
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const submitting = useRef(false);
  const [step, setStep] = useState(0);
  const [review, setReview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [sections, setSections] = useState<CoachReportSectionId[]>(
    coachReportSectionIds.filter(
      (id) => copy[id].checked || (id === "saved_comparisons" && includeComparisons),
    ),
  );
  const [hideExact, setHideExact] = useState(true);
  const [password, setPassword] = useState("");
  const [expiry, setExpiry] = useState("14");
  const [title, setTitle] = useState("");
  const [disableDownload, setDisableDownload] = useState(false);
  const [hideSocial, setHideSocial] = useState(true);
  const included = sections.filter((id) => !(hideExact && id === "raw_evidence"));
  function reviewDraft() {
    if (!form.current?.reportValidity()) return;
    if (!included.length) {
      setError("Select at least one section that is not excluded by privacy settings.");
      return;
    }
    setError(null);
    setReview(true);
  }
  function create() {
    if (submitting.current || !form.current) return;
    submitting.current = true;
    const data = new FormData(form.current);
    startTransition(async () => {
      try {
        const result = await createCoachReportWithStateAction(data);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        if (result.shareToken) {
          router.push(`/coach/reports?share=${encodeURIComponent(result.shareToken)}`);
          setReview(false);
          router.refresh();
        } else {
          setError(
            "The report link was not returned. Keep this draft open and review report history before retrying.",
          );
        }
      } catch {
        setError(
          "Could not confirm report creation. Your selections remain here; check history before retrying.",
        );
      } finally {
        submitting.current = false;
      }
    });
  }
  return (
    <form
      ref={form}
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (step === 0) setStep(1); else reviewDraft();
      }}
    >
      <ol className="flex flex-wrap gap-3 text-sm" aria-label="Report builder steps">
        {["Evidence", "Privacy", "Review"].map((name, index) => (
          <li key={name} aria-current={(review ? 2 : step) === index ? "step" : undefined}>
            {index + 1}. {name}
          </li>
        ))}
      </ol>
      <fieldset
        hidden={step !== 0}
        style={{ display: step !== 0 ? "none" : undefined }}
        disabled={pending || !ready}
        className="grid gap-4"
      >
        <legend className="mb-3 font-semibold">Report and evidence</legend>
        <label className="grid gap-2 text-sm">
          Report title (optional)
          <Input
            name="title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={120}
            placeholder="Uses a generated title when blank"
          />
        </label>
        <label className="grid gap-2 text-sm">
          Report template
          <select
            name="template"
            className="min-h-11 rounded-lg border bg-background px-3"
            defaultValue="coach"
          >
            {templates.map((template) => (
              <option key={template.value} value={template.value}>
                {template.label}
              </option>
            ))}
          </select>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          {coachReportSectionIds.map((id) => (
            <label
              key={id}
              className="flex min-h-14 cursor-pointer items-start gap-3 rounded-lg border p-4"
            >
              <Checkbox
                name="sections"
                value={id}
                checked={sections.includes(id)}
                onCheckedChange={(checked) =>
                  setSections((current) =>
                    checked ? [...current, id] : current.filter((item) => item !== id),
                  )
                }
              />
              <span>
                <strong className="block">{copy[id].title}</strong>
                <span className="mt-1 block text-sm text-muted-foreground">{copy[id].detail}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset
        hidden={step !== 1}
        style={{ display: step !== 1 ? "none" : undefined }}
        disabled={pending || !ready}
        className="grid gap-4"
      >
        <legend className="mb-3 font-semibold">Privacy and expiry</legend>
        <label className="grid gap-2 text-sm">
          Link expires after
          <select
            name="expiryDays"
            className="min-h-11 rounded-lg border bg-background px-3"
            value={expiry}
            onChange={(event) => setExpiry(event.target.value)}
          >
            {["7", "14", "30"].map((days) => (
              <option key={days} value={days}>
                {days} days
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm">
          Optional password
          <Input
            name="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={8}
            maxLength={128}
          />
        </label>
        {[
          {
            name: "disableDownload",
            label: "Disable download",
            value: disableDownload,
            set: setDisableDownload,
          },
          {
            name: "hideExactShotData",
            label: "Hide exact shot data, even if selected",
            value: hideExact,
            set: setHideExact,
          },
          {
            name: "hideSocialInformation",
            label: "Hide social information",
            value: hideSocial,
            set: setHideSocial,
          },
        ].map((setting) => (
          <label
            key={setting.name}
            className="flex min-h-14 items-center gap-3 rounded-lg border p-3"
          >
            <Checkbox
              name={setting.name}
              checked={setting.value}
              onCheckedChange={(value) => setting.set(value === true)}
            />
            <span>{setting.label}</span>
          </label>
        ))}
      </fieldset>
      <div className="rounded-lg border p-3 text-sm">
        Anyone holding the link{password ? " and password" : ""} can open this frozen report until
        expiry or revocation. Private coach notes and unselected sections are excluded. Selected
        “Your notes” includes your recent session and practice notes.
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3 border-t pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {step === 1 ? (
          <Button type="button" variant="outline" onClick={() => setStep(0)}>
            Back to evidence
          </Button>
        ) : null}
        {step === 0 ? (
          <Button type="button" disabled={!ready} onClick={() => setStep(1)}>
            Continue to privacy
          </Button>
        ) : (
          <Button type="button" onClick={reviewDraft}>Review report</Button>
        )}
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setReview(false);
            setStep(0);
            setError(null);
          }}
        >
          Cancel review, keep draft
        </Button>
      </div>
      <Sheet
        open={review}
        onOpenChange={(open) => {
          if (!pending) setReview(open);
        }}
      >
        <SheetContent className="w-full sm:max-w-xl" showCloseButton={!pending}>
          <SheetHeader>
            <SheetTitle>Review frozen report</SheetTitle>
            <SheetDescription>No report is created until you confirm below.</SheetDescription>
          </SheetHeader>
          <div className="grid min-h-0 gap-4 overflow-y-auto px-4">
            <h3 className="font-semibold">{title.trim() || "Generated report title"}</h3>
            <ul className="list-inside list-disc">
              {included.map((id) => (
                <li key={id}>{copy[id].title}</li>
              ))}
            </ul>
            <p>
              {included.length} sections · expires in {expiry} days ·{" "}
              {password ? "Password protected" : "Anyone with the link"}
            </p>
            <p>
              {disableDownload ? "Download disabled." : "Download allowed."}{" "}
              {hideExact ? "Exact raw shot evidence excluded." : ""}
            </p>
            <p className="text-sm">
              This grants access to the frozen selected sections only. It does not grant an account
              role or access to future account updates.
            </p>
            {error ? (
              <p role="alert" className="text-destructive">
                {error}
              </p>
            ) : null}
          </div>
          <div className="mt-auto grid gap-2 border-t p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Button type="button" disabled={pending} onClick={create}>
              {pending ? "Creating report…" : "Create frozen report link"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setReview(false)}
            >
              Back to draft
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </form>
  );
}
