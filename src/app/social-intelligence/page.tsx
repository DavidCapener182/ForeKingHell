import type { ReactNode } from "react";
import { Brain, Flag, MessageSquareWarning, ShieldAlert, Sparkles } from "lucide-react";

import {
  generateSocialSummaryAction,
  reportSocialTargetAction,
} from "@/app/social-intelligence/actions";
import { MobileRouteHeader } from "@/components/mobile-sports";
import { PageShell, StatusPill } from "@/components/premium";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getSocialIntelligencePageData } from "@/lib/social-intelligence";
import { socialVisibilityOptions } from "@/lib/social";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function SocialIntelligencePage() {
  const data = await getSocialIntelligencePageData();

  return (
    <PageShell size="7xl">
      <MobileRouteHeader title="Social" group="social" activeKey="recaps" />

      <header className="rounded-xl border bg-white p-5 shadow-sm">
        <StatusPill tone="sky">Recaps and safety</StatusPill>
        <h1 className="mt-3 text-3xl font-semibold tracking-normal">Recaps & Safety</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Generate weekly and challenge recaps while keeping suspicious attempts, reported comments
          and moderation records visible early.
        </p>
      </header>

      <section className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start">
        <aside className="grid gap-4 lg:sticky lg:top-28">
          <section className="rounded-xl border bg-white p-4 shadow-sm">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="size-4 text-emerald-600" />
              Generate summary
            </p>
            <form action={generateSocialSummaryAction} className="mt-3 grid gap-3">
              <select name="summaryType" className="h-9 rounded-xl border bg-slate-50 px-3 text-sm">
                <option value="import_recap">Import recap</option>
                <option value="friend_comparison">Friend comparison</option>
                <option value="challenge_coach">Challenge coach</option>
                <option value="tournament_recap">Tournament recap</option>
              </select>
              <select
                name="visibility"
                defaultValue="private"
                className="h-9 rounded-xl border bg-slate-50 px-3 text-sm"
              >
                {socialVisibilityOptions.map((option) => (
                  <option key={option} value={option}>
                    {label(option)}
                  </option>
                ))}
              </select>
              <Button type="submit" className="rounded-xl bg-[#111827] text-white">
                <Brain className="size-4" />
                Generate
              </Button>
            </form>
          </section>

          <section className="rounded-xl border bg-white p-4 shadow-sm">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Flag className="size-4 text-red-600" />
              Report content
            </p>
            <form action={reportSocialTargetAction} className="mt-3 grid gap-3">
              <select name="targetType" className="h-9 rounded-xl border bg-slate-50 px-3 text-sm">
                <option value="feed_item">Feed item</option>
                <option value="comment">Comment</option>
                <option value="challenge_result">Challenge result</option>
                <option value="course_record_attempt">Course record attempt</option>
                <option value="tournament_submission">Tournament submission</option>
                <option value="profile">Profile</option>
              </select>
              <Input
                name="targetId"
                placeholder="Target id"
                className="h-9 rounded-xl bg-slate-50"
                required
              />
              <Input
                name="reason"
                placeholder="Spam, abuse, suspicious result..."
                className="h-9 rounded-xl bg-slate-50"
                required
              />
              <textarea
                name="details"
                rows={3}
                className="rounded-xl border bg-slate-50 px-3 py-2 text-sm"
                placeholder="Optional details"
              />
              <Button type="submit" variant="destructive">
                <MessageSquareWarning className="size-4" />
                Report
              </Button>
            </form>
          </section>
        </aside>

        <main className="grid gap-4">
          <section className="grid gap-3 md:grid-cols-3">
            <Metric
              icon={<Sparkles className="size-4 text-emerald-600" />}
              label="Summaries"
              value={data.summaries.length}
            />
            <Metric
              icon={<ShieldAlert className="size-4 text-red-600" />}
              label="Reports"
              value={data.reports.length}
            />
            <Metric
              icon={<Flag className="size-4 text-amber-600" />}
              label="Moderation events"
              value={data.moderation.length}
            />
          </section>

          <section className="rounded-xl border bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold">Weekly and challenge recaps</p>
            <div className="mt-4 grid gap-3">
              {data.summaries.length === 0 ? (
                <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                  No summaries generated yet.
                </p>
              ) : (
                data.summaries.map((summary) => (
                  <article key={summary.id} className="rounded-xl border bg-slate-50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Badge variant="secondary">{label(summary.summaryType)}</Badge>
                      <Badge variant="outline">{summary.visibility}</Badge>
                    </div>
                    <h2 className="mt-3 font-semibold">{summary.headline}</h2>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{summary.body}</p>
                    <p className="mt-3 text-xs text-muted-foreground">
                      {summary.model} · {dateFormatter.format(summary.createdAt)}
                    </p>
                  </article>
                ))
              )}
            </div>
          </section>

          <section className="rounded-xl border bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold">Safety queue</p>
            <div className="mt-4 grid gap-3">
              {data.moderation.length > 0 ? (
                data.moderation.map((event) => (
                  <article key={event.id} className="rounded-xl border bg-slate-50 p-4 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Badge variant={event.severity === "high" ? "destructive" : "secondary"}>
                        {label(event.eventType)}
                      </Badge>
                      <Badge variant="outline">{event.status}</Badge>
                    </div>
                    <p className="mt-3 font-medium">
                      {event.reason ?? "Verification review needed"}
                    </p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                      <ReviewMetric
                        label="Imported"
                        value={metadataValue(event.metadataJson, "imported")}
                      />
                      <ReviewMetric
                        label="Screenshot"
                        value={metadataValue(event.metadataJson, "screenshot")}
                      />
                      <ReviewMetric
                        label="Context"
                        value={
                          metadataValue(event.metadataJson, "course") ??
                          metadataValue(event.metadataJson, "tournament")
                        }
                      />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button type="button" size="sm" variant="outline">
                        Approve
                      </Button>
                      <Button type="button" size="sm" variant="outline">
                        Reject
                      </Button>
                      <Button type="button" size="sm" variant="outline">
                        Request more evidence
                      </Button>
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">
                      {event.targetType} / {event.targetId} ·{" "}
                      {dateFormatter.format(event.createdAt)}
                    </p>
                  </article>
                ))
              ) : data.reports.length === 0 ? (
                <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                  No verification events or reports created by this account.
                </p>
              ) : null}
              {data.reports.length > 0
                ? data.reports.map((report) => (
                    <div key={report.id} className="rounded-xl bg-slate-50 px-3 py-2 text-sm">
                      <p className="font-medium">
                        {label(report.reason)} · {report.status}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {report.targetType} / {report.targetId}
                      </p>
                    </div>
                  ))
                : null}
            </div>
          </section>
        </main>
      </section>
    </PageShell>
  );
}

function Metric({
  icon,
  label: metricLabel,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        {metricLabel}
      </p>
      <p className="mt-2 text-2xl font-semibold tracking-normal">{value}</p>
    </div>
  );
}

function ReviewMetric({ label: metricLabel, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-lg bg-white px-3 py-2 ring-1 ring-slate-200">
      <p className="text-xs font-semibold uppercase text-muted-foreground">{metricLabel}</p>
      <p className="mt-1 font-medium">{value ?? "--"}</p>
    </div>
  );
}

function metadataValue(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];

  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  return null;
}

function label(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
