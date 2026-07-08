import { Brain, Flag, MessageSquareWarning, Sparkles } from "lucide-react";

import {
  generateSocialSummaryAction,
  reportSocialTargetAction,
} from "@/app/social-intelligence/actions";
import { ConfirmSubmitButton } from "@/components/app/confirm-submit-button";
import {
  DesktopTableWorkbenchControls,
  DesktopWorkbenchLayout,
  type DesktopSavedViewSuggestion,
  type DesktopWorkbenchColumn,
} from "@/components/app/desktop-workbench";
import { MobileRouteHeader } from "@/components/mobile-sports";
import { DataTableFrame, PageHeader, PageShell, StatusPill } from "@/components/premium";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getSocialIntelligencePageData } from "@/lib/social-intelligence";
import { socialVisibilityOptions } from "@/lib/social";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

type SocialSafetyRow = {
  id: string;
  source: string;
  severity: string;
  status: string;
  reason: string;
  target: string;
  detail: string;
  createdAt: Date;
};

const socialSafetyColumns: DesktopWorkbenchColumn[] = [
  { id: "source", label: "Source", locked: true },
  { id: "severity", label: "Severity" },
  { id: "status", label: "Status" },
  { id: "reason", label: "Reason" },
  { id: "target", label: "Target" },
  { id: "detail", label: "Detail" },
  { id: "created", label: "Created" },
];

const socialSafetySuggestedViews: DesktopSavedViewSuggestion[] = [
  {
    title: "Open safety queue",
    href: "/social-intelligence#social-safety-ledger",
    detail: "Review reports and moderation events visible to this account.",
  },
  {
    title: "Admin moderation",
    href: "/admin/moderation",
    detail: "Resolve safety records from the protected admin console.",
  },
  {
    title: "Public recaps",
    href: "/social-intelligence",
    detail: "Check summary visibility before sharing social copy.",
  },
];

export default async function SocialIntelligencePage() {
  const data = await getSocialIntelligencePageData();
  const safetyRows: SocialSafetyRow[] = [
    ...data.moderation.map((event) => ({
      id: `event-${event.id}`,
      source: "Moderation event",
      severity: label(event.severity),
      status: label(event.status),
      reason: event.reason ?? "Verification review needed",
      target: `${event.targetType} / ${event.targetId}`,
      detail:
        metadataValue(event.metadataJson, "course") ??
        metadataValue(event.metadataJson, "tournament") ??
        metadataValue(event.metadataJson, "reportReason") ??
        label(event.eventType),
      createdAt: event.createdAt,
    })),
    ...data.reports.map((report) => ({
      id: `report-${report.id}`,
      source: "User report",
      severity: "Reported",
      status: label(report.status),
      reason: label(report.reason),
      target: `${report.targetType} / ${report.targetId}`,
      detail: report.details ?? "No details",
      createdAt: report.createdAt,
    })),
  ];

  return (
    <PageShell>
      <MobileRouteHeader title="Social" group="social" activeKey="recaps" />

      <DesktopWorkbenchLayout scope="social-intelligence">
        <PageHeader
          eyebrow={<StatusPill tone="sky">Recaps and safety</StatusPill>}
          title="Recaps & Safety"
          description="Generate weekly and challenge recaps while keeping suspicious attempts, reported comments and moderation records visible early."
          metrics={[
            { label: "Summaries", value: data.summaries.length },
            { label: "Reports", value: data.reports.length },
            { label: "Moderation", value: data.moderation.length },
          ]}
        />

        <section className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start">
          <section className="grid gap-4 lg:sticky lg:top-28">
            <section className="rounded-xl border bg-white p-4 shadow-sm">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Sparkles className="size-4 text-emerald-600" />
                Generate summary
              </p>
              <form action={generateSocialSummaryAction} className="mt-3 grid gap-3">
                <select
                  name="summaryType"
                  aria-label="Summary type"
                  className="h-9 rounded-xl border bg-slate-50 px-3 text-sm"
                >
                  <option value="import_recap">Import recap</option>
                  <option value="friend_comparison">Friend comparison</option>
                  <option value="challenge_coach">Challenge coach</option>
                  <option value="tournament_recap">Tournament recap</option>
                </select>
                <select
                  name="visibility"
                  aria-label="Summary visibility"
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
                <select
                  name="targetType"
                  aria-label="Report target type"
                  className="h-9 rounded-xl border bg-slate-50 px-3 text-sm"
                >
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
                  placeholder="Spam, abuse, suspicious result"
                  className="h-9 rounded-xl bg-slate-50"
                  required
                />
                <textarea
                  name="details"
                  rows={3}
                  className="rounded-xl border bg-slate-50 px-3 py-2 text-sm"
                  placeholder="Optional details"
                />
                <ConfirmSubmitButton
                  confirmMessage="Submit this social report? This creates a moderation record for the selected target."
                  variant="destructive"
                >
                  <MessageSquareWarning className="size-4" />
                  Report
                </ConfirmSubmitButton>
              </form>
            </section>
          </section>

          <section className="grid gap-4">
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

            <SocialSafetyLedger rows={safetyRows} />
          </section>
        </section>
      </DesktopWorkbenchLayout>
    </PageShell>
  );
}

function SocialSafetyLedger({ rows }: { rows: SocialSafetyRow[] }) {
  return (
    <section
      id="social-safety-ledger"
      data-workbench-scope="social-safety"
      className="rounded-xl border bg-white p-4 shadow-sm"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold">Safety queue</p>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">
            Reports and moderation events visible to this account, ready for review or export.
          </p>
        </div>
        <StatusPill tone={rows.length > 0 ? "amber" : "green"}>{rows.length} rows</StatusPill>
      </div>

      <DesktopTableWorkbenchControls
        viewKey="social-safety"
        scope="social-safety"
        currentViewLabel="Social safety queue"
        resultLabel={`${rows.length} safety rows`}
        columns={socialSafetyColumns}
        suggestedViews={socialSafetySuggestedViews}
        exportTableId="social-safety"
        exportFileName="forekinghell-social-safety.csv"
        className="my-3"
      />

      <DataTableFrame mainTable mainTableLabel="Social safety queue table">
        <Table data-workbench-export-table="social-safety" aria-describedby="social-safety-summary">
          <TableCaption id="social-safety-summary" className="sr-only">
            Social safety queue table showing source, severity, status, reason, target, detail and
            created date.
          </TableCaption>
          <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-white">
            <TableRow>
              <TableHead
                data-column="source"
                className="sticky left-0 z-20 min-w-48 bg-white shadow-[1px_0_0_rgba(15,23,42,0.08)]"
              >
                Source
              </TableHead>
              <TableHead data-column="severity">Severity</TableHead>
              <TableHead data-column="status">Status</TableHead>
              <TableHead data-column="reason">Reason</TableHead>
              <TableHead data-column="target">Target</TableHead>
              <TableHead data-column="detail">Detail</TableHead>
              <TableHead data-column="created">Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length > 0 ? (
              rows.map((row) => (
                <TableRow key={row.id} tabIndex={0} className="focus-aaa outline-none">
                  <TableCell
                    data-column="source"
                    className="sticky left-0 z-10 min-w-48 bg-white font-medium shadow-[1px_0_0_rgba(15,23,42,0.08)]"
                  >
                    {row.source}
                  </TableCell>
                  <TableCell data-column="severity">
                    <Badge variant={row.severity === "High" ? "destructive" : "outline"}>
                      {row.severity}
                    </Badge>
                  </TableCell>
                  <TableCell data-column="status">{row.status}</TableCell>
                  <TableCell data-column="reason">{row.reason}</TableCell>
                  <TableCell data-column="target" className="font-mono text-xs">
                    {row.target}
                  </TableCell>
                  <TableCell data-column="detail">{row.detail}</TableCell>
                  <TableCell data-column="created">{dateFormatter.format(row.createdAt)}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                  No verification events or reports created by this account.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </DataTableFrame>
    </section>
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
