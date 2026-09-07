import Link from "next/link";
import { ProviderDetails } from "@/app/providers/provider-details";
import {
  Cable,
  CheckCircle2,
  Database,
  FileSpreadsheet,
  FlaskConical,
  GitCompareArrows,
  Upload,
} from "lucide-react";

import { DataTableFrame, PageShell, StatusPill } from "@/components/premium";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DesktopTableWorkbenchControls,
  DesktopWorkbenchLayout,
  type DesktopSavedViewSuggestion,
  type DesktopWorkbenchColumn,
} from "@/components/app/desktop-workbench";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getProviderIntegrationsPageData } from "@/lib/provider-integrations";
import { ProviderConnectionActions } from "@/app/providers/provider-connection-actions";
import { AppEmptyState } from "@/components/app/app-empty-state";
import { ConnectedMetricBar } from "@/components/app/connected-metric-bar";
import { OperationStepper } from "@/components/app/operation-stepper";
import { StatusTimeline } from "@/components/app/status-timeline";
import { Card, CardContent } from "@/components/ui/card";
import { UrlTabs } from "@/components/untitled-ui/url-tabs";
import { LabEvidenceList } from "@/app/simulator-lab/lab-evidence";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

type ProviderIntegrationsPageData = Awaited<ReturnType<typeof getProviderIntegrationsPageData>>;
type ProviderSession = ProviderIntegrationsPageData["sessions"][number];

const providerSessionColumns: DesktopWorkbenchColumn[] = [
  { id: "session", label: "Session", locked: true },
  { id: "provider", label: "Provider" },
  { id: "session-date", label: "Session date" },
  { id: "last-seen", label: "Last seen" },
  { id: "import-status", label: "Import status" },
  { id: "provider-id", label: "Provider ID" },
];

const providerSessionSuggestedViews: DesktopSavedViewSuggestion[] = [
  {
    title: "Pending import review",
    href: "/providers#provider-sessions",
    detail: "Sessions seen by a provider but not yet imported.",
  },
  {
    title: "Latest Rapsodo sessions",
    href: "/providers#provider-adapters",
    detail: "Use the live adapter tile with recent session evidence.",
  },
  {
    title: "Provider job health",
    href: "/providers?tab=diagnostics#provider-jobs",
    detail: "Jump to source files, import jobs and sync status.",
  },
];

type ProvidersPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function parseProviderTab(value: string | string[] | undefined) {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate === "diagnostics" ? "diagnostics" : "connections";
}

export default async function ProvidersPage({ searchParams }: ProvidersPageProps) {
  const params = (await searchParams) ?? {};
  const activeTab = parseProviderTab(params.tab);
  const pageNumber = (value: string | string[] | undefined) =>
    Number(Array.isArray(value) ? value[0] : value);
  const data = await getProviderIntegrationsPageData({
    sessionsPage: pageNumber(params.sessionsPage),
    jobsPage: pageNumber(params.jobsPage),
    filesPage: pageNumber(params.filesPage),
  });
  function ledgerPages(kind: "sessions" | "jobs" | "files") {
    const pagination = data.pagination[kind];
    const href = (page: number) => {
      const query = new URLSearchParams();
      for (const [key, value] of Object.entries(params))
        for (const entry of Array.isArray(value) ? value : value ? [value] : [])
          query.append(key, entry);
      query.set(`${kind}Page`, String(page));
      query.set("tab", kind === "sessions" ? "connections" : "diagnostics");
      return `/providers?${query}#${kind === "sessions" ? "provider-sessions" : "provider-jobs"}`;
    };
    return (
      <nav
        aria-label={`Provider ${kind} pages`}
        className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
      >
        <span>
          {pagination.total} {kind} · Page {pagination.page} of {pagination.pages}
        </span>
        <div className="flex gap-2">
          {pagination.page > 1 ? (
            <Button asChild variant="outline">
              <Link prefetch={false} href={href(pagination.page - 1)}>
                Previous {kind}
              </Link>
            </Button>
          ) : null}
          {pagination.page < pagination.pages ? (
            <Button asChild variant="outline">
              <Link prefetch={false} href={href(pagination.page + 1)}>
                Next {kind}
              </Link>
            </Button>
          ) : null}
        </div>
      </nav>
    );
  }

  return (
    <PageShell>
      <DesktopWorkbenchLayout scope="providers">
        <header className="premium-hero p-3 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <StatusPill tone="sky">Import expansion</StatusPill>
              <h1 className="mt-2 text-lg font-semibold leading-tight tracking-normal sm:mt-3 sm:text-3xl">
                Launch monitor providers
              </h1>
              <p className="mt-1 max-w-3xl text-sm leading-5 text-muted-foreground sm:mt-2 sm:leading-6">
                Manage supported connections and inspect recorded imports. Historical sessions
                remain available after disconnecting; adapter availability does not mean an account
                is connected.
              </p>
            </div>
            <div data-primary-action className="shrink-0">
              <Button asChild size="sm" className="rounded-lg">
                <Link href="/import" prefetch={false}>
                  <Upload className="size-4" />
                  Import file
                </Link>
              </Button>
            </div>
          </div>
        </header>

        <UrlTabs
          defaultTabKey={activeTab}
          label="Provider workbench sections"
          tabs={[
            {
              id: "connections",
              label: "Connections",
              content: (
                <div className="grid min-w-0 gap-5">
                  {data.providers.length > 0 ? (
                    <section
                      id="provider-adapters"
                      className="grid scroll-mt-28 gap-4 md:grid-cols-3"
                    >
                      {data.providers.map((provider) => (
                        <ProviderDetails
                          key={provider.providerKind}
                          title={provider.label}
                          status={`${providerStatusLabel(provider.status)} · ${provider.accountCount > 0 ? "Stored account" : "No stored account"}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <Badge variant={provider.status === "live" ? "secondary" : "outline"}>
                                {providerStatusLabel(provider.status)}
                              </Badge>
                              <h2 className="mt-2 text-xl font-semibold tracking-normal">
                                {provider.label}
                              </h2>
                            </div>
                            <div className="flex items-center gap-2">
                              {provider.status === "live" ? (
                                <CheckCircle2 className="size-5 text-primary" />
                              ) : (
                                <FlaskConical className="size-5 text-[var(--status-warning-foreground)]" />
                              )}
                              <ProviderConnectionActions
                                providerKind={provider.providerKind}
                                connected={provider.accountCount > 0}
                                live={provider.status === "live"}
                              />
                            </div>
                          </div>
                          <ConnectedMetricBar
                            embedded
                            className="shadow-none xl:grid-cols-3"
                            label={`${provider.label} connection metrics`}
                            metrics={[
                              { label: "Accounts", value: provider.accountCount },
                              { label: "Sessions", value: provider.sessionCount },
                              { label: "Jobs", value: provider.jobCount },
                            ]}
                          />
                          <div
                            className="grid gap-2 rounded-lg border bg-muted/35 p-3 text-sm"
                            data-provider-import-health
                          >
                            <p className="font-semibold">Provider import health</p>
                            <ProviderHealthRow
                              label="Last recorded activity"
                              value={formatProviderDate(provider.lastSyncAt)}
                              tone={provider.lastSyncAt ? "green" : "amber"}
                            />
                            <ProviderHealthRow
                              label="Import failures"
                              value={
                                provider.failureCount > 0
                                  ? `${provider.failureCount} ${provider.latestFailureMessage ?? "needs review"}`
                                  : provider.jobCount > 0
                                    ? `${provider.jobCount} jobs checked · none flagged`
                                    : "No import jobs observed"
                              }
                              tone={
                                provider.failureCount > 0 || provider.jobCount === 0
                                  ? "amber"
                                  : "green"
                              }
                            />
                          </div>
                          <OperationStepper
                            compact
                            label={`${provider.label} latest recorded operation`}
                            steps={providerWorkflowSteps(
                              data.latestJobs.find(
                                (job) => job.providerKind === provider.providerKind,
                              ),
                            )}
                          />
                          <Button
                            asChild
                            variant={provider.status === "live" ? "default" : "outline"}
                            className="w-full"
                          >
                            <Link
                              href={provider.status === "live" ? "/rapsodo" : "/billing"}
                              prefetch={false}
                            >
                              {provider.status === "live" ? (
                                <Upload className="size-4" />
                              ) : (
                                <GitCompareArrows className="size-4" />
                              )}
                              {provider.status === "live"
                                ? provider.accountCount > 0
                                  ? "Open provider inbox"
                                  : "Connect provider"
                                : "View adapter access"}
                            </Link>
                          </Button>
                        </ProviderDetails>
                      ))}
                    </section>
                  ) : (
                    <AppEmptyState
                      icon={<Cable className="size-5" />}
                      title="No provider connections"
                      description="Connect R-Cloud or import a measured file to create provider evidence."
                      primaryAction={
                        <Button asChild>
                          <Link href="/rapsodo">Connect R-Cloud</Link>
                        </Button>
                      }
                      secondaryAction={
                        <Button asChild variant="outline">
                          <Link href="/import">Import CSV</Link>
                        </Button>
                      }
                    />
                  )}

                  <p className="text-sm text-muted-foreground">
                    Connection health uses the latest 20 recorded sessions, jobs and files. Browse
                    complete saved history below.
                  </p>
                  <ProviderSessionsTable sessions={data.sessions} />
                  {ledgerPages("sessions")}
                </div>
              ),
            },
            {
              id: "diagnostics",
              label: "Diagnostics",
              content: (
                <div className="grid min-w-0 gap-5">
                  <div id="provider-health" className="scroll-mt-28">
                    <Card>
                      <CardContent className="grid gap-3 p-4">
                        <h2 className="font-semibold">Provider import health</h2>
                        <p className="text-sm text-muted-foreground">
                          Recent recorded operations, separate from adapter availability. Historical
                          activity does not verify a live connection.
                        </p>
                        {data.providers.map((provider) => (
                          <div
                            key={provider.providerKind}
                            className="grid gap-2 rounded-xl border p-3"
                          >
                            <div className="flex flex-wrap justify-between gap-2">
                              <h3 className="font-medium">{provider.label}</h3>
                              <Badge variant={provider.failureCount ? "destructive" : "outline"}>
                                {provider.failureCount
                                  ? "Needs review"
                                  : provider.jobCount
                                    ? "No recent failures recorded"
                                    : "No recorded jobs"}
                              </Badge>
                            </div>
                            <p className="break-words text-sm text-muted-foreground">
                              {provider.latestFailureMessage ??
                                `${providerStatusLabel(provider.status)} · ${formatProviderDate(provider.lastSyncAt)}`}
                            </p>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  </div>
                  <section
                    id="provider-jobs"
                    className="grid scroll-mt-28 gap-4 lg:grid-cols-2 lg:items-start"
                  >
                    <Card>
                      <CardContent className="p-4">
                        <p className="mb-4 flex items-center gap-2 text-sm font-semibold">
                          <FileSpreadsheet className="size-4 text-primary" />
                          Source files
                        </p>
                        <StatusTimeline
                          label="Provider source files"
                          items={data.files.map((file) => ({
                            id: file.id,
                            title: file.fileName,
                            description: `${providerKindLabel(file.providerKind)} · ${formatProviderDate(file.createdAt)} · ${file.fileSizeBytes ?? "Unknown"} bytes`,
                            status: providerStatusLabel(file.status),
                            kind: "import" as const,
                          }))}
                          empty={
                            <AppEmptyState
                              icon={<FileSpreadsheet className="size-5" />}
                              title="No source files"
                              description="Import a provider file to create source evidence."
                              primaryAction={
                                <Button asChild size="sm">
                                  <Link href="/import">Import file</Link>
                                </Button>
                              }
                            />
                          }
                        />
                        {ledgerPages("files")}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-4">
                        <p className="mb-4 flex items-center gap-2 text-sm font-semibold">
                          <FlaskConical className="size-4 text-[var(--status-warning-foreground)]" />
                          Import job status
                        </p>
                        <StatusTimeline
                          label="Provider import jobs"
                          items={data.jobs.map((job) => ({
                            id: job.id,
                            title: `${providerKindLabel(job.providerKind)} · ${providerStatusLabel(job.status)}`,
                            description:
                              job.errorMessage ??
                              (job.detectedProviderKind
                                ? `Detected ${providerKindLabel(job.detectedProviderKind)}`
                                : "No detected provider recorded"),
                            status: `${providerStatusLabel(job.status)} · ${formatProviderDate(job.updatedAt)}`,
                            kind:
                              job.errorMessage || job.status === "failed"
                                ? ("warning" as const)
                                : ["saved", "completed", "imported"].includes(job.status)
                                  ? ("reviewed" as const)
                                  : ("import" as const),
                          }))}
                          empty={
                            <AppEmptyState
                              icon={<FlaskConical className="size-5" />}
                              title="No import jobs"
                              description="A provider job will appear after the first connection or file import."
                              primaryAction={
                                <Button asChild size="sm">
                                  <Link href="/import">Start an import</Link>
                                </Button>
                              }
                            />
                          }
                        />
                        {ledgerPages("jobs")}
                      </CardContent>
                    </Card>
                  </section>
                </div>
              ),
            },
          ]}
        />
      </DesktopWorkbenchLayout>
    </PageShell>
  );
}

function ProviderSessionsTable({ sessions }: { sessions: ProviderSession[] }) {
  return (
    <Card
      id="provider-sessions"
      data-workbench-scope="provider-sessions"
      className="scroll-mt-28 gap-0 py-0"
    >
      <CardContent className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Database className="size-4 text-primary" aria-hidden />
              Recent provider sessions
            </p>
            <p className="mt-1 max-w-2xl text-sm leading-5 text-muted-foreground">
              Review sessions seen by launch-monitor providers before they enter player performance
              history.
            </p>
          </div>
          <Badge variant="outline" className="w-fit">
            {sessions.length} sessions
          </Badge>
        </div>

        <LabEvidenceList
          title="Provider sessions"
          rows={sessions.map((session) => ({
            id: session.id,
            title: providerSessionTitle(session),
            summary: `${providerKindLabel(session.providerKind)} · ${session.providerSessionId} · ${session.importedAt ? "Imported" : "Pending review"}`,
            href: session.importedSessionId ? `/sessions/${session.importedSessionId}` : undefined,
            fields: [
              { label: "Provider", value: providerKindLabel(session.providerKind) },
              { label: "Remote ID", value: session.providerSessionId },
              { label: "Session date", value: formatProviderSessionDate(session.sessionDate) },
              { label: "Last seen", value: formatProviderSessionDate(session.lastSeenAt) },
              { label: "Imported at", value: formatProviderSessionDate(session.importedAt) },
              {
                label: "Local session",
                value: session.importedSessionId ?? "Not imported",
                href: session.importedSessionId
                  ? `/sessions/${session.importedSessionId}`
                  : undefined,
              },
            ],
          }))}
        />
        <p className="my-3 text-sm text-muted-foreground">
          This page of recorded provider sessions. CSV export includes this page only. Import
          history is separate from current connection health.
        </p>
        <details>
          <summary className="min-h-11 cursor-pointer py-3 font-medium">
            Full session table and export
          </summary>
          <DesktopTableWorkbenchControls
            viewKey="provider-sessions"
            scope="provider-sessions"
            currentViewLabel="Provider sessions"
            resultLabel={`${sessions.length} sessions`}
            columns={providerSessionColumns}
            suggestedViews={providerSessionSuggestedViews}
            exportTableId="provider-sessions"
            exportFileName="forekinghell-provider-sessions.csv"
            className="my-3"
          />

          <DataTableFrame mainTable mainTableLabel="Provider sessions table" stickyFirstColumn>
            <Table
              data-workbench-export-table="provider-sessions"
              aria-describedby="provider-sessions-summary"
            >
              <TableCaption id="provider-sessions-summary" className="sr-only">
                Recent provider sessions with provider, session date, last seen time, import status
                and provider source identifier.
              </TableCaption>
              <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-muted">
                <TableRow>
                  <TableHead data-column="session" className="sticky left-0 z-20 min-w-56 bg-muted">
                    Session
                  </TableHead>
                  <TableHead data-column="provider">Provider</TableHead>
                  <TableHead data-column="session-date">Session date</TableHead>
                  <TableHead data-column="last-seen">Last seen</TableHead>
                  <TableHead data-column="import-status">Import status</TableHead>
                  <TableHead data-column="provider-id">Provider ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.length > 0 ? (
                  sessions.map((session) => (
                    <TableRow
                      key={session.id}
                      tabIndex={0}
                      className="focus-aaa outline-none"
                      aria-label={`${providerSessionTitle(session)} provider session`}
                    >
                      <TableCell
                        data-column="session"
                        className="sticky left-0 z-10 min-w-56 bg-card font-medium"
                      >
                        <span className="block max-w-64 truncate">
                          {providerSessionTitle(session)}
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {session.importedSessionId
                            ? "Linked to ForeKingHell session"
                            : "Provider only"}
                        </span>
                      </TableCell>
                      <TableCell data-column="provider">
                        {providerKindLabel(session.providerKind)}
                      </TableCell>
                      <TableCell data-column="session-date">
                        {formatProviderSessionDate(session.sessionDate)}
                      </TableCell>
                      <TableCell data-column="last-seen">
                        {formatProviderSessionDate(session.lastSeenAt)}
                      </TableCell>
                      <TableCell data-column="import-status">
                        <StatusPill tone={session.importedAt ? "green" : "amber"}>
                          {session.importedAt ? "Imported" : "Pending review"}
                        </StatusPill>
                      </TableCell>
                      <TableCell data-column="provider-id" className="font-mono text-xs">
                        {session.providerSessionId}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="p-4">
                      <AppEmptyState
                        icon={<Database className="size-5" />}
                        title="No provider sessions"
                        description="Connect a provider or import a measured file to begin the session inbox."
                        primaryAction={
                          <Button asChild size="sm">
                            <Link href="/rapsodo">Connect R-Cloud</Link>
                          </Button>
                        }
                        secondaryAction={
                          <Button asChild size="sm" variant="outline">
                            <Link href="/import">Import CSV</Link>
                          </Button>
                        }
                      />
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </DataTableFrame>
        </details>
      </CardContent>
    </Card>
  );
}

function ProviderHealthRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "green" | "amber";
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-md bg-background px-2 py-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={
          tone === "green"
            ? "text-right font-medium text-primary"
            : "text-right font-medium text-[var(--status-warning-foreground)]"
        }
      >
        {value}
      </span>
    </div>
  );
}

function providerWorkflowSteps(job: ProviderIntegrationsPageData["jobs"][number] | undefined) {
  if (!job) return [{ id: "none", label: "No recorded operation", status: "upcoming" as const }];
  const failed = job.status === "failed" || Boolean(job.errorMessage);
  const complete = ["saved", "completed", "imported", "duplicate"].includes(job.status);
  const pending = ["queued", "pending"].includes(job.status);
  return [
    {
      id: job.id,
      label: `${providerStatusLabel(job.status)} · ${formatProviderDate(job.updatedAt)}`,
      status: failed
        ? ("error" as const)
        : complete
          ? ("complete" as const)
          : pending
            ? ("upcoming" as const)
            : ("current" as const),
    },
  ];
}

function providerStatusLabel(status: string) {
  if (status === "live") {
    return "live/current";
  }

  if (status === "beta") {
    return "beta adapter";
  }

  if (status === "research") {
    return "research adapter";
  }

  return status;
}

function formatProviderDate(value: Date | null) {
  return value ? dateFormatter.format(value) : "Not synced yet";
}

function formatProviderSessionDate(value: Date | null) {
  return value ? dateFormatter.format(value) : "No date";
}

function providerSessionTitle(session: ProviderSession) {
  return session.title ?? session.providerSessionId;
}

function providerKindLabel(kind: string) {
  return kind
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
