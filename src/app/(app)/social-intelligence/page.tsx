import { Brain, Flag, MessageSquareWarning, Sparkles } from "lucide-react";

import {
  generateSocialSummaryAction,
  reportSocialTargetAction,
} from "@/app/social-intelligence/actions";
import { ConfirmSubmitButton } from "@/components/app/confirm-submit-button";
import {
  DesktopWorkbenchLayout,
  DesktopSavedViewSuggestion,
  DesktopWorkbenchColumn,
} from "@/components/app/desktop-workbench";
import { DataTableFrame, PageHeader, PageShell, StatusPill } from "@/components/premium";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
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

        <section className="grid min-w-0 gap-4 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start">
          <section className="grid gap-4 lg:sticky lg:top-28">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Sparkles className="size-4 text-primary" />
                  Generate summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <GenerateSummaryForm />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Flag className="size-4 text-destructive" />
                  Report content
                </CardTitle>
              </CardHeader>
              <CardContent>
                <SocialReportForm />
              </CardContent>
            </Card>
          </section>

          <section className="grid min-w-0 gap-4">
            <Card className="min-w-0">
              <CardHeader>
                <CardTitle className="text-sm">Weekly and challenge recaps</CardTitle>
              </CardHeader>
              <CardContent className="divide-y">
                {data.summaries.length === 0 ? (
                  <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                    No summaries generated yet.
                  </p>
                ) : (
                  data.summaries.map((summary) => (
                    <article key={summary.id} className="py-4 first:pt-0 last:pb-0">
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
              </CardContent>
            </Card>

            <SocialSafetyLedger rows={safetyRows} />
          </section>
        </section>
      </DesktopWorkbenchLayout>
    </PageShell>
  );
}

function GenerateSummaryForm() {
  return (
    <form action={generateSocialSummaryAction} className="grid gap-3">
      <label className="grid gap-1 text-sm font-medium">
        Summary type
        <Select name="summaryType" defaultValue="import_recap">
          <SelectTrigger className="h-11 w-full text-base">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="import_recap">Import recap</SelectItem>
            <SelectItem value="friend_comparison">Friend comparison</SelectItem>
            <SelectItem value="challenge_coach">Challenge coach</SelectItem>
            <SelectItem value="tournament_recap">Tournament recap</SelectItem>
          </SelectContent>
        </Select>
      </label>
      <label className="grid gap-1 text-sm font-medium">
        Visibility
        <Select name="visibility" defaultValue="private">
          <SelectTrigger className="h-11 w-full text-base">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {socialVisibilityOptions.map((option) => (
              <SelectItem key={option} value={option}>
                {label(option)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>
      <Button type="submit" className="min-h-11 rounded-xl">
        <Brain className="size-4" />
        Generate
      </Button>
    </form>
  );
}

function SocialReportForm() {
  return (
    <form action={reportSocialTargetAction} className="grid gap-3">
      <label className="grid gap-1 text-sm font-medium">
        Content type
        <Select name="targetType" defaultValue="feed_item">
          <SelectTrigger className="h-11 w-full text-base">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="feed_item">Feed item</SelectItem>
            <SelectItem value="comment">Comment</SelectItem>
            <SelectItem value="challenge_result">Challenge result</SelectItem>
            <SelectItem value="course_record_attempt">Course record attempt</SelectItem>
            <SelectItem value="tournament_submission">Tournament submission</SelectItem>
            <SelectItem value="profile">Profile</SelectItem>
          </SelectContent>
        </Select>
      </label>
      <label className="grid gap-1 text-sm font-medium">
        Content ID
        <Input name="targetId" placeholder="Paste the content ID" className="h-11" required />
      </label>
      <label className="grid gap-1 text-sm font-medium">
        Reason
        <Input
          name="reason"
          placeholder="Spam, abuse or suspicious result"
          className="h-11"
          required
        />
      </label>
      <label className="grid gap-1 text-sm font-medium">
        Details <span className="font-normal text-muted-foreground">(optional)</span>
        <Textarea
          name="details"
          rows={4}
          className="rounded-xl border bg-background px-3 py-2 text-base"
          placeholder="Add context for the reviewer"
        />
      </label>
      <ConfirmSubmitButton
        confirmMessage="Submit this social report? This creates a moderation record for the selected target."
        variant="destructive"
      >
        <MessageSquareWarning className="size-4" />
        Submit report
      </ConfirmSubmitButton>
    </form>
  );
}

async function SocialSafetyLedger({ rows }: { rows: SocialSafetyRow[] }) {
  const { DesktopTableWorkbenchControls } = await import("@/components/app/desktop-workbench");

  return (
    <section
      id="social-safety-ledger"
      data-workbench-scope="social-safety"
      className="grid min-w-0 gap-3"
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
      />

      <DataTableFrame mainTable mainTableLabel="Social safety queue table" stickyFirstColumn>
        <Table data-workbench-export-table="social-safety" aria-describedby="social-safety-summary">
          <TableCaption id="social-safety-summary" className="sr-only">
            Social safety queue table showing source, severity, status, reason, target, detail and
            created date.
          </TableCaption>
          <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-card">
            <TableRow>
              <TableHead
                data-column="source"
                className="sticky left-0 z-20 min-w-48 bg-card shadow-[1px_0_0_hsl(var(--border))]"
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
                    className="sticky left-0 z-10 min-w-48 bg-card font-medium shadow-[1px_0_0_hsl(var(--border))]"
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
