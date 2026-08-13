import Link from "next/link";
import {
  Cable,
  CheckCircle2,
  Database,
  FileSpreadsheet,
  FlaskConical,
  GitCompareArrows,
  Upload,
} from "lucide-react";

import {
  IOSDisclosureGroup,
  IOSGroupedList,
  IOSInlineStatus,
  IOSListRow,
  IOSSectionHeader,
} from "@/components/app/ios-mobile";
import { ProviderHealthFeaturePanel } from "@/components/features/feature-panels";
import {
  MobileAppShell,
  MobileRouteTabs,
  MobileStatusAction,
  MobileTopBar,
} from "@/components/mobile-sports";
import { DataTableFrame, PageShell, StatusPill } from "@/components/premium";
import { PageArtwork, type PageArtworkVariant } from "@/components/visuals/page-artwork";
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
import { getFeatureIdeasData } from "@/lib/feature-ideas";
import { getProviderIntegrationsPageData } from "@/lib/provider-integrations";
import { ProviderConnectionActions } from "@/app/providers/provider-connection-actions";
import { AppEmptyState } from "@/components/app/app-empty-state";
import { ConnectedMetricBar } from "@/components/app/connected-metric-bar";
import { OperationStepper } from "@/components/app/operation-stepper";
import { StatusTimeline } from "@/components/app/status-timeline";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

type ProviderIntegrationsPageData = Awaited<ReturnType<typeof getProviderIntegrationsPageData>>;
type ProviderSession = ProviderIntegrationsPageData["sessions"][number];
type ProviderAdapter = ProviderIntegrationsPageData["providers"][number];

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
    href: "/providers#provider-jobs",
    detail: "Jump to source files, import jobs and sync status.",
  },
];

export default async function ProvidersPage() {
  const [data, featureData] = await Promise.all([
    getProviderIntegrationsPageData(),
    getFeatureIdeasData(),
  ]);

  return (
    <PageShell>
      <MobileAppShell>
        <MobileTopBar title="Providers" />
        <MobileRouteTabs group="platform" activeKey="providers" />
        <MobileProviderConsole data={data} featureData={featureData} />
      </MobileAppShell>

      <DesktopWorkbenchLayout scope="providers" className="hidden lg:grid">
        <header className="premium-hero p-3 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <StatusPill tone="sky">Import expansion</StatusPill>
              <h1 className="mt-2 text-lg font-semibold leading-tight tracking-normal sm:mt-3 sm:text-3xl">
                Launch monitor providers
              </h1>
              <p className="mt-1 hidden max-w-3xl text-sm leading-5 text-muted-foreground sm:mt-2 sm:block sm:leading-6">
                LM World Tour becomes your cross-device golf performance history. Rapsodo is live,
                Square is beta and TrackMan is tracked as a research adapter.
              </p>
            </div>
            <div data-primary-action className="shrink-0">
              <Button
                asChild
                size="sm"
                className="rounded-lg bg-[#0B7A3B] text-white hover:bg-[#064E3B]"
              >
                <Link href="/import" prefetch={false}>
                  <Upload className="size-4" />
                  Import file
                </Link>
              </Button>
            </div>
          </div>
        </header>

        <Tabs defaultValue="connections" className="min-w-0 gap-5" data-provider-workbench-tabs>
          <TabsList variant="line" aria-label="Provider workbench sections">
            <TabsTrigger value="connections">Connections</TabsTrigger>
            <TabsTrigger value="diagnostics">Diagnostics</TabsTrigger>
          </TabsList>

          <TabsContent value="connections" className="grid min-w-0 gap-5">
            {data.providers.length > 0 ? (
              <section id="provider-adapters" className="grid scroll-mt-28 gap-4 md:grid-cols-3">
                {data.providers.map((provider, index) => (
                  <Card key={provider.providerKind} className="overflow-hidden">
                    <CardContent className="grid gap-4 p-4">
                      <PageArtwork
                        variant={providerArtwork(provider.providerKind)}
                        alt=""
                        className="block h-28 min-h-0 rounded-lg"
                        sizes="(min-width: 768px) 33vw, 100vw"
                        priority={index === 0}
                      />
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
                            <FlaskConical className="size-5 text-amber-600 dark:text-amber-300" />
                          )}
                          <ProviderConnectionActions
                            providerKind={provider.providerKind}
                            connected={provider.accountCount > 0}
                            live={provider.status === "live"}
                          />
                        </div>
                      </div>
                      <ConnectedMetricBar
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
                          label="Last sync"
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
                            provider.failureCount > 0 || provider.jobCount === 0 ? "amber" : "green"
                          }
                        />
                      </div>
                      <OperationStepper
                        compact
                        label={`${provider.label} integration progress`}
                        steps={providerWorkflowSteps(provider)}
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
                    </CardContent>
                  </Card>
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

            <ProviderSessionsTable sessions={data.sessions} />
          </TabsContent>

          <TabsContent value="diagnostics" className="grid min-w-0 gap-5">
            <div id="provider-health" className="scroll-mt-28">
              <ProviderHealthFeaturePanel data={featureData} />
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
                    items={data.files.slice(0, 8).map((file) => ({
                      id: file.id,
                      title: file.fileName,
                      description: providerKindLabel(file.providerKind),
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
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <p className="mb-4 flex items-center gap-2 text-sm font-semibold">
                    <FlaskConical className="size-4 text-amber-600 dark:text-amber-300" />
                    Import job status
                  </p>
                  <StatusTimeline
                    label="Provider import jobs"
                    items={data.jobs.slice(0, 8).map((job) => ({
                      id: job.id,
                      title: `${providerKindLabel(job.providerKind)} · ${providerStatusLabel(job.status)}`,
                      description:
                        job.errorMessage ??
                        (job.detectedProviderKind
                          ? `Detected ${providerKindLabel(job.detectedProviderKind)}`
                          : "No detected provider recorded"),
                      status: job.errorMessage ? "Review" : "Observed",
                      kind: job.errorMessage ? ("warning" as const) : ("reviewed" as const),
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
                </CardContent>
              </Card>
            </section>
          </TabsContent>
        </Tabs>
      </DesktopWorkbenchLayout>
    </PageShell>
  );
}

function MobileProviderConsole({
  data,
  featureData,
}: {
  data: ProviderIntegrationsPageData;
  featureData: Awaited<ReturnType<typeof getFeatureIdeasData>>;
}) {
  const failureCount = data.providers.reduce((total, provider) => total + provider.failureCount, 0);
  const pendingSessions = data.sessions.filter((session) => !session.importedAt);
  const connectedProviderCount = data.providers.filter(
    (provider) => provider.accountCount > 0,
  ).length;
  const orderedProviders = [...data.providers].sort(
    (left, right) =>
      right.failureCount - left.failureCount ||
      right.accountCount - left.accountCount ||
      Number(right.status === "live") - Number(left.status === "live"),
  );
  const orderedSessions = [...data.sessions].sort(
    (left, right) =>
      Number(Boolean(left.importedAt)) - Number(Boolean(right.importedAt)) ||
      (right.lastSeenAt?.getTime() ?? 0) - (left.lastSeenAt?.getTime() ?? 0),
  );
  const primarySessions = orderedSessions.slice(0, 8);
  const olderSessions = orderedSessions.slice(8);

  return (
    <>
      <MobileStatusAction
        label={failureCount > 0 ? "Provider failures" : "Provider inbox"}
        value={failureCount > 0 ? failureCount : `${pendingSessions.length} pending`}
        detail={`${connectedProviderCount} connected · ${data.sessions.length} observed sessions`}
        action={
          <Button asChild className="min-h-11">
            <Link
              href={failureCount > 0 ? "#mobile-provider-operations" : "/rapsodo"}
              prefetch={false}
            >
              {failureCount > 0 ? "Review" : connectedProviderCount > 0 ? "Open" : "Connect"}
            </Link>
          </Button>
        }
      />

      <section className="grid gap-2" aria-label="Provider adapters">
        <IOSSectionHeader
          title="Provider connections"
          description="Adapter status and evidence from this account"
        />
        <MobileProviderRows providers={orderedProviders} />
      </section>

      <section className="grid gap-2" aria-label="Provider session inbox">
        <IOSSectionHeader
          title="Recent sessions"
          description={`${pendingSessions.length} waiting for import review`}
        />
        <MobileProviderSessionRows sessions={primarySessions} />
        {olderSessions.length > 0 ? (
          <IOSDisclosureGroup
            label="More provider sessions"
            items={[
              {
                value: "more-provider-sessions",
                title: "More sessions",
                summary: olderSessions.length,
                description: "Older imported and provider-only rows",
                contentClassName: "px-0 pb-0 pt-0",
                content: <MobileProviderSessionRows sessions={olderSessions} />,
              },
            ]}
          />
        ) : null}
      </section>

      <div id="mobile-provider-operations" className="scroll-mt-24">
        <IOSDisclosureGroup
          label="Provider operations detail"
          items={[
            {
              value: "provider-jobs",
              title: "Import jobs",
              summary: data.jobs.length,
              description:
                failureCount > 0
                  ? `${failureCount} failed job${failureCount === 1 ? "" : "s"} need review`
                  : data.jobs.length > 0
                    ? "No failures flagged in the observed jobs"
                    : "No import jobs observed",
              contentClassName: "px-0 pb-0 pt-0",
              content: (
                <IOSGroupedList label="Provider import job rows" className="border-0">
                  {data.jobs.length > 0 ? (
                    data.jobs.map((job) => (
                      <IOSListRow
                        key={job.id}
                        label={`${providerKindLabel(job.providerKind)} · ${providerStatusLabel(job.status)}`}
                        detail={
                          job.errorMessage ??
                          (job.detectedProviderKind
                            ? `Detected ${providerKindLabel(job.detectedProviderKind)}`
                            : "No detected provider recorded")
                        }
                        status={
                          <IOSInlineStatus
                            label={
                              job.status === "failed" || job.errorMessage
                                ? "Review required"
                                : "Observed job"
                            }
                            tone={
                              job.status === "failed" || job.errorMessage ? "critical" : "neutral"
                            }
                          />
                        }
                      />
                    ))
                  ) : (
                    <IOSListRow
                      label="No import jobs"
                      detail="Health cannot be inferred until a provider job has run."
                    />
                  )}
                </IOSGroupedList>
              ),
            },
            {
              value: "provider-files",
              title: "Source files",
              summary: data.files.length,
              description: "Recent provider file evidence",
              contentClassName: "px-0 pb-0 pt-0",
              content: (
                <IOSGroupedList label="Provider source file rows" className="border-0">
                  {data.files.length > 0 ? (
                    data.files.map((file) => (
                      <IOSListRow
                        key={file.id}
                        label={file.fileName}
                        value={providerStatusLabel(file.status)}
                        detail={providerKindLabel(file.providerKind)}
                      />
                    ))
                  ) : (
                    <IOSListRow
                      label="No source files"
                      detail="Connect a provider or import a file to create evidence."
                    />
                  )}
                </IOSGroupedList>
              ),
            },
            {
              value: "provider-health-detail",
              title: "Provider health detail",
              summary: featureData.providerHealth.length,
              description: "Mapping, sync and adapter context",
              content: <ProviderHealthFeaturePanel data={featureData} />,
            },
          ]}
        />
      </div>
    </>
  );
}

function MobileProviderRows({
  providers,
}: {
  providers: ProviderIntegrationsPageData["providers"];
}) {
  return (
    <IOSGroupedList label="Provider connection rows">
      {providers.map((provider) => {
        const connected = provider.accountCount > 0;
        const hasFailure = provider.failureCount > 0;

        return (
          <IOSListRow
            key={provider.providerKind}
            icon={provider.status === "live" ? Cable : FlaskConical}
            label={provider.label}
            detail={`${providerStatusLabel(provider.status)} · ${provider.accountCount} accounts · ${provider.sessionCount} sessions · ${provider.jobCount} jobs · ${formatProviderDate(provider.lastSyncAt)}`}
            href={provider.status === "live" ? "/rapsodo" : "/billing"}
            status={
              <IOSInlineStatus
                label={
                  hasFailure
                    ? `${provider.failureCount} failed job${provider.failureCount === 1 ? "" : "s"}`
                    : connected
                      ? "Connected"
                      : provider.jobCount > 0
                        ? "Job evidence, no account"
                        : "No account evidence"
                }
                tone={hasFailure ? "critical" : connected ? "positive" : "attention"}
              />
            }
          />
        );
      })}
    </IOSGroupedList>
  );
}

function MobileProviderSessionRows({ sessions }: { sessions: ProviderSession[] }) {
  return (
    <IOSGroupedList label="Recent provider session rows">
      {sessions.length > 0 ? (
        sessions.map((session) => (
          <IOSListRow
            key={session.id}
            label={providerSessionTitle(session)}
            value={session.importedAt ? "Imported" : "Pending"}
            detail={`${providerKindLabel(session.providerKind)} · ${formatProviderSessionDate(session.sessionDate)} · last seen ${formatProviderSessionDate(session.lastSeenAt)}`}
            href={session.importedSessionId ? `/rounds/${session.importedSessionId}` : "/rapsodo"}
            status={
              <IOSInlineStatus
                label={session.importedAt ? "Linked session" : "Import review"}
                tone={session.importedAt ? "positive" : "attention"}
              />
            }
          />
        ))
      ) : (
        <IOSListRow
          label="No provider sessions"
          detail="Connect a provider or import a measured file to begin."
        />
      )}
    </IOSGroupedList>
  );
}

function ProviderSessionsTable({ sessions }: { sessions: ProviderSession[] }) {
  return (
    <section
      id="provider-sessions"
      data-workbench-scope="provider-sessions"
      className="premium-card scroll-mt-28 p-4"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Database className="size-4 text-sky-600" aria-hidden />
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
            Recent provider sessions with provider, session date, last seen time, import status and
            provider source identifier.
          </TableCaption>
          <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-[#F8FAF8]">
            <TableRow>
              <TableHead data-column="session" className="sticky left-0 z-20 min-w-56 bg-[#F8FAF8]">
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
                    className="sticky left-0 z-10 min-w-56 bg-white font-medium"
                  >
                    <span className="block max-w-64 truncate">{providerSessionTitle(session)}</span>
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
    </section>
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
            : "text-right font-medium text-amber-700 dark:text-amber-300"
        }
      >
        {value}
      </span>
    </div>
  );
}

function providerWorkflowSteps(provider: ProviderAdapter) {
  const observations = [
    { id: "connect", label: "Connect", complete: provider.accountCount > 0 },
    { id: "file", label: "Import", complete: provider.fileCount > 0 },
    { id: "mapping", label: "Map", complete: provider.mappingCount > 0 },
    { id: "review", label: "Review", complete: provider.sessionCount > 0 },
    { id: "normalise", label: "Normalise", complete: provider.sessionCount > 0 },
  ];
  const firstIncomplete = observations.findIndex((step) => !step.complete);

  return observations.map((step, index) => ({
    id: step.id,
    label: step.label,
    status: step.complete
      ? ("complete" as const)
      : index === firstIncomplete
        ? ("current" as const)
        : ("upcoming" as const),
  }));
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

function providerArtwork(kind: string): PageArtworkVariant {
  if (kind.toLowerCase().includes("rapsodo")) {
    return "providerRapsodo";
  }

  if (kind.toLowerCase().includes("square")) {
    return "providerSquare";
  }

  if (kind.toLowerCase().includes("trackman")) {
    return "providerTrackman";
  }

  return "import";
}
