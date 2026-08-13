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
import {
  BottomSheet,
  MobileAppShell,
  MobileRouteTabs,
  MobileStatusAction,
  MobileTopBar,
} from "@/components/mobile-sports";
import {
  IOSDisclosureGroup,
  IOSGroupedList,
  IOSInlineStatus,
  IOSListRow,
  IOSSectionHeader,
} from "@/components/app/ios-mobile";
import { DataTableFrame, PageHeader, PageShell, StatusPill } from "@/components/premium";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

type SocialIntelligenceData = Awaited<ReturnType<typeof getSocialIntelligencePageData>>;

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
      <MobileAppShell>
        <MobileTopBar title="Recaps & Safety" />
        <MobileRouteTabs group="social" activeKey="recaps" />
        <MobileStatusAction
          label="Visible safety records"
          value={safetyRows.length}
          detail={`${data.reports.length} ${data.reports.length === 1 ? "report" : "reports"} · ${data.moderation.length} ${data.moderation.length === 1 ? "moderation event" : "moderation events"}`}
          action={
            <BottomSheet label="Report" title="Report social content">
              <SocialReportForm />
            </BottomSheet>
          }
        />
        <MobileSocialSafetyQueue rows={safetyRows} />
        <MobileSocialRecaps summaries={data.summaries} />
      </MobileAppShell>

      <DesktopWorkbenchLayout scope="social-intelligence" className="hidden lg:grid">
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
            <section className="rounded-xl border bg-white p-4 shadow-sm">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Sparkles className="size-4 text-emerald-600" />
                Generate summary
              </p>
              <div className="mt-3">
                <GenerateSummaryForm />
              </div>
            </section>

            <section className="rounded-xl border bg-white p-4 shadow-sm">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Flag className="size-4 text-red-600" />
                Report content
              </p>
              <div className="mt-3">
                <SocialReportForm />
              </div>
            </section>
          </section>

          <section className="grid min-w-0 gap-4">
            <section className="min-w-0 rounded-xl border bg-white p-4 shadow-sm">
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

function MobileSocialSafetyQueue({ rows }: { rows: SocialSafetyRow[] }) {
  const primaryRows = rows.slice(0, 3);
  const olderRows = rows.slice(3);

  return (
    <section className="grid gap-2" aria-label="Social safety queue">
      <IOSSectionHeader
        title="Safety queue"
        description={
          rows.length > 0
            ? "Reports and moderation records visible to this account"
            : "No reports or moderation records are visible"
        }
      />
      <MobileSocialSafetyRows rows={primaryRows} />
      {olderRows.length > 0 ? (
        <IOSDisclosureGroup
          label="Older social safety records"
          items={[
            {
              value: "older-safety-records",
              title: "Older safety records",
              summary: olderRows.length,
              description: "Earlier reports and moderation events",
              contentClassName: "px-0 pb-0 pt-0",
              content: <MobileSocialSafetyRows rows={olderRows} />,
            },
          ]}
        />
      ) : null}
      {rows.length > 0 ? <MobileSafetyTechnicalDetails rows={rows} /> : null}
    </section>
  );
}

function MobileSocialSafetyRows({ rows }: { rows: SocialSafetyRow[] }) {
  return (
    <IOSGroupedList label="Visible social safety records">
      {rows.length > 0 ? (
        rows.map((row) => (
          <IOSListRow
            key={row.id}
            label={row.reason}
            value={row.status}
            detail={
              <>
                <span>
                  {row.source} · {dateFormatter.format(row.createdAt)}
                </span>
                {row.detail ? <span className="mt-0.5 block">{row.detail}</span> : null}
              </>
            }
            status={
              <IOSInlineStatus
                label={row.severity}
                tone={
                  row.severity === "High"
                    ? "critical"
                    : row.severity === "Medium" || row.severity === "Reported"
                      ? "attention"
                      : "info"
                }
              />
            }
          />
        ))
      ) : (
        <IOSListRow
          label="No safety records"
          detail="Reports created by this account and visible moderation events will appear here."
          status={<IOSInlineStatus label="No action needed" tone="positive" />}
        />
      )}
    </IOSGroupedList>
  );
}

function MobileSafetyTechnicalDetails({ rows }: { rows: SocialSafetyRow[] }) {
  return (
    <IOSDisclosureGroup
      label="Social safety record identifiers"
      items={[
        {
          value: "safety-record-identifiers",
          title: "Record identifiers",
          summary: rows.length,
          description: "Target IDs for support or moderation review",
          contentClassName: "px-0 pb-0 pt-0",
          content: (
            <IOSGroupedList label="Safety record target IDs" className="border-0">
              {rows.map((row) => (
                <IOSListRow
                  key={row.id}
                  label={row.source}
                  value={row.status}
                  detail={<span className="[overflow-wrap:anywhere]">{row.target}</span>}
                />
              ))}
            </IOSGroupedList>
          ),
        },
      ]}
    />
  );
}

function MobileSocialRecaps({ summaries }: { summaries: SocialIntelligenceData["summaries"] }) {
  const latest = summaries[0] ?? null;
  const older = summaries.slice(1);

  return (
    <section className="grid gap-2" aria-label="Social recaps">
      <IOSSectionHeader
        title="Recaps"
        description={`${summaries.length} generated ${summaries.length === 1 ? "summary" : "summaries"}`}
        action={
          <BottomSheet label="Generate" title="Generate a recap">
            <GenerateSummaryForm />
          </BottomSheet>
        }
      />
      <IOSGroupedList label="Latest social recap">
        {latest ? (
          <IOSListRow
            label={latest.headline}
            value={label(latest.visibility)}
            detail={latest.body}
            status={
              <IOSInlineStatus
                label={`${label(latest.summaryType)} · ${dateFormatter.format(latest.createdAt)}`}
                tone="info"
              />
            }
          />
        ) : (
          <IOSListRow
            label="No recap yet"
            detail="Generate a private recap when you want a concise summary of real activity."
          />
        )}
      </IOSGroupedList>
      {older.length > 0 ? (
        <IOSDisclosureGroup
          label="Earlier social recaps"
          items={[
            {
              value: "earlier-recaps",
              title: "Earlier recaps",
              summary: older.length,
              description: "Previously generated summaries",
              contentClassName: "px-0 pb-0 pt-0",
              content: (
                <IOSGroupedList label="Earlier generated recaps" className="border-0">
                  {older.map((summary) => (
                    <IOSListRow
                      key={summary.id}
                      label={summary.headline}
                      value={label(summary.visibility)}
                      detail={summary.body}
                      status={
                        <IOSInlineStatus
                          label={`${label(summary.summaryType)} · ${dateFormatter.format(summary.createdAt)}`}
                          tone="neutral"
                        />
                      }
                    />
                  ))}
                </IOSGroupedList>
              ),
            },
          ]}
        />
      ) : null}
    </section>
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
      <Button type="submit" className="min-h-11 rounded-xl bg-[#111827] text-white">
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
        <textarea
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

function SocialSafetyLedger({ rows }: { rows: SocialSafetyRow[] }) {
  return (
    <section
      id="social-safety-ledger"
      data-workbench-scope="social-safety"
      className="min-w-0 overflow-hidden rounded-xl border bg-white p-4 shadow-sm"
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

      <DataTableFrame mainTable mainTableLabel="Social safety queue table" stickyFirstColumn>
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
