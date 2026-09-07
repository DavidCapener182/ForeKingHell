"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { socialIntelligenceFormAction } from "@/app/social-intelligence/actions";
import { ResponsiveDetailPanel } from "@/components/app/responsive-detail-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useClientReady } from "@/hooks/use-client-ready";
const types = [
  ["import_recap", "Import recap"],
  ["friend_comparison", "Friend comparison guidance"],
  ["challenge_coach", "Challenge guidance"],
  ["tournament_recap", "Tournament recap guidance"],
];
export function SocialTaskForm({
  task,
  sourceCount,
  sourcePeriod,
}: {
  task: "generate" | "report";
  sourceCount: number;
  sourcePeriod: string;
}) {
  const ready = useClientReady();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [review, setReview] = useState(false);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const busy = useRef(false);
  const [fields, setFields] = useState({
    summaryType: "import_recap",
    visibility: "private",
    targetType: "feed_item",
    targetId: "",
    reason: "",
    details: "",
  });
  const set = (key: keyof typeof fields, value: string) => setFields({ ...fields, [key]: value });
  const label = task === "generate" ? "Generate recap" : "Report content";
  return (
    <>
      <Button
        disabled={!ready}
        variant={task === "generate" ? "default" : "outline"}
        onClick={() => {
          setOpen(true);
          setSaved(false);
        }}
      >
        {label}
      </Button>
      {saved ? (
        <p role="status">
          {task === "generate"
            ? "Recap saved. Review its content and sources below."
            : "Report submitted for review. This does not mean the content has been removed."}
        </p>
      ) : null}
      <ResponsiveDetailPanel
        open={open}
        onOpenChange={(next) => {
          if (!pending) setOpen(next);
        }}
        title={label}
        description={
          task === "generate"
            ? "Generate from your own recent activity. This does not publish a feed post."
            : "Name the exact content and explain the reason before submitting a report."
        }
      >
        <form
          className="grid gap-4"
          aria-busy={pending}
          onSubmit={(e) => {
            e.preventDefault();
            if (!review) {
              setReview(true);
              return;
            }
            if (busy.current) return;
            busy.current = true;
            setError(undefined);
            start(async () => {
              try {
                const data = new FormData();
                data.set("operation", task);
                for (const [key, value] of Object.entries(fields)) data.set(key, value);
                const result = await socialIntelligenceFormAction({ ok: false }, data);
                if (!result.ok) {
                  setError(result.error ?? "Could not complete this request.");
                  return;
                }
                setOpen(false);
                setReview(false);
                setSaved(true);
                if (task === "report")
                  setFields({ ...fields, targetId: "", reason: "", details: "" });
                router.refresh();
              } catch {
                setError("Could not complete this request. Your draft is retained.");
              } finally {
                busy.current = false;
              }
            });
          }}
        >
          {task === "generate" ? (
            <p className="rounded-xl border p-3 text-sm">
              Source scope: your {sourceCount} latest feed{" "}
              {sourceCount === 1 ? "activity" : "activities"} (maximum 8). {sourcePeriod}. These
              options use your activity only; they do not load a friend, challenge or tournament
              dataset.
            </p>
          ) : null}
          {review ? (
            <section className="grid gap-3 rounded-xl border p-3" aria-label="Review request">
              {task === "generate" ? (
                <>
                  <p>{types.find((t) => t[0] === fields.summaryType)?.[1]}</p>
                  <p>Saved visibility: {fields.visibility}</p>
                </>
              ) : (
                <>
                  <p className="break-all">
                    {fields.targetType} / {fields.targetId}
                  </p>
                  <p className="break-words">Reason: {fields.reason}</p>
                  <p className="whitespace-pre-wrap break-words">
                    {fields.details || "No further details."}
                  </p>
                </>
              )}
            </section>
          ) : task === "generate" ? (
            <>
              <Label>
                Recap type
                <select
                  className="min-h-11 w-full rounded-lg border bg-background px-3"
                  value={fields.summaryType}
                  onChange={(e) => set("summaryType", e.target.value)}
                >
                  {types.map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </Label>
              <Label>
                Saved visibility
                <select
                  className="min-h-11 w-full rounded-lg border bg-background px-3"
                  value={fields.visibility}
                  onChange={(e) => set("visibility", e.target.value)}
                >
                  {["private", "friends", "public"].map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </Label>
            </>
          ) : (
            <>
              <Label>
                Content type
                <select
                  className="min-h-11 w-full rounded-lg border bg-background px-3"
                  value={fields.targetType}
                  onChange={(e) => set("targetType", e.target.value)}
                >
                  {[
                    "feed_item",
                    "comment",
                    "challenge_result",
                    "course_record_attempt",
                    "tournament_submission",
                    "profile",
                  ].map((v) => (
                    <option key={v} value={v}>
                      {v.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </Label>
              <Label>
                Content ID
                <Input
                  required
                  value={fields.targetId}
                  maxLength={220}
                  onChange={(e) => set("targetId", e.target.value)}
                />
              </Label>
              <Label>
                Reason
                <Input
                  required
                  value={fields.reason}
                  maxLength={120}
                  onChange={(e) => set("reason", e.target.value)}
                />
              </Label>
              <Label>
                Details (optional)
                <Textarea
                  rows={5}
                  value={fields.details}
                  maxLength={1200}
                  onChange={(e) => set("details", e.target.value)}
                />
              </Label>
            </>
          )}
          {error ? (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2 border-t pt-4">
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            {review ? (
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => setReview(false)}
              >
                Edit details
              </Button>
            ) : null}
            <Button type="submit" disabled={pending}>
              {pending
                ? "Saving…"
                : review
                  ? task === "generate"
                    ? "Confirm generation"
                    : "Confirm report"
                  : "Review request"}
            </Button>
          </div>
        </form>
      </ResponsiveDetailPanel>
    </>
  );
}
