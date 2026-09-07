import { SocialTaskForm } from "@/app/social-intelligence/social-task-form";
import { SavedRecaps } from "@/app/social-intelligence/saved-recaps";
import { SafetyRecords } from "@/app/social-intelligence/safety-records";
import {
  DesktopSavedViewSuggestion,
  DesktopWorkbenchColumn,
} from "@/components/app/desktop-workbench";
import { PageHeader, PageShell, StatusPill } from "@/components/premium";
import { getSocialIntelligencePageData } from "@/lib/social-intelligence";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "Europe/London",
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
      <div className="grid min-w-0 gap-6 pb-28" data-social-intelligence-workspace>
        <PageHeader
          eyebrow={<StatusPill tone="sky">Recaps and safety</StatusPill>}
          title="Recaps & Safety"
          description="Review recaps generated from your own activity and track your submitted reports."
          metrics={[
            { label: "Summaries", value: data.summaries.length },
            { label: "Reports", value: data.reports.length },
            { label: "Moderation", value: data.moderation.length },
          ]}
        />

        <div className="grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-2">
          <section className="grid gap-3">
            <h2 className="font-semibold">Generate a recap</h2>
            <p className="text-sm text-muted-foreground">
              Use your latest activity as the source. Saved recaps remain separate from feed posts.
            </p>
            <SocialTaskForm
              task="generate"
              sourceCount={data.recentFeed.slice(0, 8).length}
              sourcePeriod={
                data.recentFeed.length
                  ? `${dateFormatter.format(data.recentFeed[Math.min(7, data.recentFeed.length - 1)].createdAt)}–${dateFormatter.format(data.recentFeed[0].createdAt)} UK`
                  : "No source activity yet"
              }
            />
          </section>
          <section className="grid gap-3">
            <h2 className="font-semibold">Report content</h2>
            <p className="text-sm text-muted-foreground">
              Submit the exact content ID and reason for review.
            </p>
            <SocialTaskForm task="report" sourceCount={0} sourcePeriod="" />
          </section>
        </div>
        <SavedRecaps
          summaries={data.summaries.map((summary) => ({
            ...summary,
            createdAt: summary.createdAt.toISOString(),
          }))}
          evidence={Object.values(data.evidenceFeedById).map((item) => ({
            ...item,
            createdAt: item.createdAt.toISOString(),
          }))}
        />
        <SocialSafetyLedger rows={safetyRows} />
      </div>
    </PageShell>
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
            Your latest 20 reports and 20 moderation events. These records do not grant moderator
            permissions.
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

      <SafetyRecords
        rows={rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }))}
      />
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
