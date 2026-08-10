import Link from "next/link";
import {
  Archive,
  ArrowLeft,
  Award,
  CheckCircle2,
  Cloud,
  FileUp,
  FileClock,
  FlaskConical,
  PenLine,
  RefreshCw,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { desc, eq } from "drizzle-orm";

import { archiveImportFileAction } from "@/app/import/actions";
import { ImportForm } from "@/app/import/import-form";
import { MobileRapsodoConnect } from "@/app/import/mobile-rapsodo-connect";
import { getRapsodoConnectionStatusAction } from "@/app/rapsodo/actions";
import { ConfirmSubmitButton } from "@/components/app/confirm-submit-button";
import {
  IOSDisclosureGroup,
  IOSGroupedList,
  IOSInlineStatus,
  IOSListRow,
  IOSSectionHeader,
} from "@/components/app/ios-mobile";
import { ImportQualityFeaturePanel } from "@/components/features/feature-panels";
import {
  BottomSheet,
  MobileAppShell,
  MobileStatusAction,
  MobileTopBar,
} from "@/components/mobile-sports";
import {
  DataPanel,
  DataPair,
  DataTableFrame,
  MobileAccordionSection,
  MobileDataCard,
  MobileDataList,
  PageShell,
  SectionHeader,
  StatusPill,
} from "@/components/premium";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import {
  DesktopTableWorkbenchControls,
  DesktopWorkflowLayout,
  type DesktopSavedViewSuggestion,
  type DesktopWorkbenchColumn,
  type DesktopWorkflowHelpItem,
  type DesktopWorkflowStep,
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
import { importFiles, sessions, users } from "@/db/schema";
import { getDb } from "@/db/client";
import { requireCurrentUserId } from "@/lib/current-user";
import { getFeatureIdeasData } from "@/lib/feature-ideas";

export const dynamic = "force-dynamic";

type ImportPageProps = {
  searchParams?: Promise<{
    source?: string;
  }>;
};

const integerFormatter = new Intl.NumberFormat("en-GB");
const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});
const importLibraryColumns: DesktopWorkbenchColumn[] = [
  { id: "file", label: "File", locked: true },
  { id: "status", label: "Status" },
  { id: "session", label: "Session" },
  { id: "parse", label: "Parse" },
  { id: "actions", label: "Actions", locked: true },
];
const importLibrarySuggestedViews: DesktopSavedViewSuggestion[] = [
  {
    title: "Duplicate checks",
    href: "/import#import-library",
    detail: "Review duplicate and archived-import blockers before submitting proof.",
  },
  {
    title: "Linked sessions",
    href: "/import#import-library",
    detail: "Confirm which imports already feed rounds, bag and coach evidence.",
  },
  {
    title: "Rapsodo setup",
    href: "/rapsodo",
    detail: "Open the provider sync console for cloud-session preview.",
  },
];
const importWorkflowHelpItems = [
  {
    title: "Rapsodo first",
    detail:
      "Direct launch-monitor sessions should become the evidence source before scorecard proof, records or challenges.",
  },
  {
    title: "Trust before action",
    detail:
      "Check duplicate status, club mapping and session links before the data feeds bag yardages or coach priorities.",
  },
  {
    title: "Proof stays secondary",
    detail:
      "Only offer records, tournaments and challenge submissions after a saved import has enough context to cite.",
  },
] satisfies DesktopWorkflowHelpItem[];

export default async function ImportPage({ searchParams }: ImportPageProps) {
  const [params, library, rapsodoStatus, featureData] = await Promise.all([
    searchParams,
    getImportLibrary(),
    getRapsodoConnectionStatusAction(),
    getFeatureIdeasData(),
  ]);
  const mobileCsvMode = params?.source === "csv" || params?.source === "sample";
  const startWithSampleData = params?.source === "sample";
  const visibleFiles = library.files.filter((file) => file.status !== "archived");
  const duplicateFiles = visibleFiles.filter((file) => file.status === "duplicate").length;
  const savedFiles = visibleFiles.filter((file) => file.status === "saved").length;
  const eligibleSubmissionCards = buildEligibleSubmissionCards(visibleFiles);
  const connectionStatus = rapsodoStatus.ok
    ? rapsodoStatus.data
    : {
        connected: false,
        expiresAt: null,
        profile: null,
      };
  const importWorkflowSteps = buildImportWorkflowSteps({
    connected: connectionStatus.connected,
    duplicateFiles,
    fileCount: visibleFiles.length,
    savedFiles,
  });

  return (
    <>
      <PageShell>
        {mobileCsvMode ? (
          <MobileAppShell>
            <MobileTopBar
              title="CSV import"
              leading={
                <Button
                  asChild
                  variant="ghost"
                  size="icon"
                  className="focus-aaa size-11 rounded-full"
                >
                  <Link href="/import" prefetch={false} aria-label="Back to import sources">
                    <ArrowLeft className="size-5" />
                  </Link>
                </Button>
              }
            />
            <div id="csv-import" className="-mx-4">
              <ImportForm
                defaultDistanceUnit={library.preferredDistanceUnit}
                startWithSampleData={startWithSampleData}
              />
            </div>
          </MobileAppShell>
        ) : (
          <MobileAppShell>
            <MobileTopBar title="Import" />
            <MobileStatusAction
              label="Four-step import"
              value={<span className="block whitespace-normal text-balance">Choose a source</span>}
              detail="Preview data, confirm club mapping, then review and import."
              action={
                <StatusPill tone={duplicateFiles > 0 ? "amber" : "green"}>
                  {duplicateFiles > 0 ? `${duplicateFiles} duplicates` : "Quality checked"}
                </StatusPill>
              }
            />
            <MobileImportSourceChooser connected={connectionStatus.connected} />
            <MobileImportFirstRun
              connected={connectionStatus.connected}
              fileCount={visibleFiles.length}
            />
            <MobileRapsodoConnect initialStatus={connectionStatus} />
            <MobileAccordionSection
              title="Import quality checks"
              description="Mapping, duplicates and eligibility."
              count={featureData.importQuality.metric}
            >
              <ImportQualityFeaturePanel data={featureData} compactMobile />
            </MobileAccordionSection>
            <MobileAccordionSection
              title="Other sources"
              description="CSV, scorecard proof and manual round entry."
              count="4 options"
            >
              <IOSGroupedList label="Other import sources">
                <IOSListRow
                  icon={Cloud}
                  label="Rapsodo session inbox"
                  detail="Load, preview and confirm measured R-Cloud sessions."
                  href="/rapsodo"
                  status={<IOSInlineStatus label="Measured source" tone="positive" />}
                />
                <IOSListRow
                  icon={FileUp}
                  label="CSV file"
                  detail="Open the four-step import wizard for a launch-monitor export."
                  href="/import?source=csv#csv-import"
                  status={<IOSInlineStatus label="Measured source" tone="info" />}
                />
                <IOSListRow
                  icon={ShieldCheck}
                  label="Scorecard proof"
                  detail="Attach proof after choosing an eligible record, event or challenge."
                  trailing={
                    <BottomSheet label="Guide" title="Scorecard proof">
                      <div className="grid gap-4 text-sm leading-6 text-muted-foreground">
                        <p>
                          Strong proof combines measured import data, a scorecard image and a
                          matching course, date and tee. Choose the destination before uploading so
                          the proof remains scoped to the right record.
                        </p>
                        <Button asChild className="min-h-11">
                          <Link href="/course-records" prefetch={false}>
                            Choose a record
                          </Link>
                        </Button>
                      </div>
                    </BottomSheet>
                  }
                />
                <IOSListRow
                  icon={Award}
                  label="Manual round"
                  detail="Record a score when measured shot data is not available."
                  href="/rounds/new"
                />
              </IOSGroupedList>
            </MobileAccordionSection>
            <MobileAccordionSection
              title="Eligible submissions"
              description="Record, tournament and challenge suggestions."
              count={`${eligibleSubmissionCards.length} items`}
            >
              <IOSGroupedList label="Eligible submissions after import">
                {eligibleSubmissionCards.map((item) => (
                  <IOSListRow
                    key={item.title}
                    label={item.title}
                    detail={item.detail}
                    value={item.actionLabel}
                    href={item.href}
                  />
                ))}
              </IOSGroupedList>
            </MobileAccordionSection>
            <MobileAccordionSection
              title="Full import context"
              description="Why Rapsodo data unlocks the app."
              count="Guide"
            >
              <IOSGroupedList label="Import context">
                <IOSListRow
                  label="Measured data unlocks analysis"
                  detail="Bag trust, coaching and competition suggestions stay secondary until the import and club mapping have been reviewed."
                  status={<IOSInlineStatus label="Private by default" tone="info" />}
                />
              </IOSGroupedList>
            </MobileAccordionSection>
          </MobileAppShell>
        )}
        <div className="hidden lg:contents">
          <DesktopWorkflowLayout
            steps={importWorkflowSteps}
            helpTitle="Import centre help"
            helpDescription="Keep launch-monitor data trustworthy"
            helpItems={importWorkflowHelpItems}
          >
            <ImportSourceChooser connected={connectionStatus.connected} />
            <FirstRunRapsodoOnboarding
              connected={connectionStatus.connected}
              fileCount={visibleFiles.length}
            />
            <div id="rapsodo-import" className="hidden min-w-0 scroll-mt-28 lg:block">
              <ImportForm
                defaultDistanceUnit={library.preferredDistanceUnit}
                startWithSampleData={startWithSampleData}
              />
            </div>
            <div id="import-quality" className="min-w-0 scroll-mt-28">
              <ImportQualityFeaturePanel data={featureData} />
            </div>
            <div id="import-library" className="min-w-0 scroll-mt-28">
              <ImportFileLibrary files={visibleFiles} />
            </div>
          </DesktopWorkflowLayout>
        </div>
      </PageShell>
    </>
  );
}

function MobileImportSourceChooser({ connected }: { connected: boolean }) {
  return (
    <section className="grid gap-2" aria-label="Choose an import source">
      <IOSSectionHeader
        title="Choose a source"
        description="Step 1 of 4 · measured session data gives the strongest analysis"
      />
      <IOSGroupedList label="Import sources">
        <IOSListRow
          icon={Cloud}
          label={connected ? "Rapsodo connected" : "Connect Rapsodo"}
          detail={
            connected
              ? "Open the connection row below or go straight to the R-Cloud inbox."
              : "Connect R-Cloud, then choose a measured session."
          }
          href="#rapsodo-connect"
          status={
            <IOSInlineStatus
              label={connected ? "Ready" : "Recommended source"}
              tone={connected ? "positive" : "attention"}
            />
          }
        />
        <IOSListRow
          icon={FileUp}
          label="Upload CSV"
          detail="Preview rows and confirm club mapping before anything is saved."
          href="/import?source=csv#csv-import"
          status={<IOSInlineStatus label="Measured source" tone="info" />}
        />
        <IOSListRow
          icon={FlaskConical}
          label="Try the demo workflow"
          detail="Use the existing clearly labelled sample session without adding personal data."
          href="/import?source=sample#csv-import"
          status={<IOSInlineStatus label="Demo data" tone="neutral" />}
        />
      </IOSGroupedList>
    </section>
  );
}

function MobileImportFirstRun({ connected, fileCount }: { connected: boolean; fileCount: number }) {
  if (fileCount > 0) {
    return null;
  }

  return (
    <IOSDisclosureGroup
      label="First import guidance"
      items={[
        {
          value: "first-import-guide",
          title: "First import guide",
          summary: connected ? "2 of 4 ready" : "1 of 4 ready",
          description: "Preview, map, review, then save",
          contentClassName: "px-0 pb-0 pt-0",
          content: (
            <IOSGroupedList label="First import steps" className="border-0">
              <IOSListRow
                label="1. Choose source"
                detail="Rapsodo, a measured CSV or the labelled demo workflow."
                status={<IOSInlineStatus label="Ready" tone="positive" />}
              />
              <IOSListRow
                label="2. Preview data"
                detail="Check the shot count and excluded rows before saving."
                status={
                  <IOSInlineStatus
                    label={connected ? "Ready" : "Choose a source first"}
                    tone={connected ? "positive" : "neutral"}
                  />
                }
              />
              <IOSListRow
                label="3. Confirm clubs"
                detail="Resolve unknown or retired club mappings."
                status={<IOSInlineStatus label="After preview" tone="neutral" />}
              />
              <IOSListRow
                label="4. Review and import"
                detail="Check duplicates and warnings, then save trusted rows."
                status={<IOSInlineStatus label="Final step" tone="neutral" />}
              />
            </IOSGroupedList>
          ),
        },
      ]}
    />
  );
}

function ImportSourceChooser({ connected }: { connected: boolean }) {
  const sources = [
    {
      title: connected ? "Rapsodo connected" : "Connect Rapsodo",
      detail: connected
        ? "Open R-Cloud and choose a measured session."
        : "Connect R-Cloud and choose a measured session.",
      href: "#rapsodo-connect",
      icon: Cloud,
      status: connected ? "Ready" : "Best source",
    },
    {
      title: "Upload CSV",
      detail: "Use an export from Rapsodo or another supported launch monitor.",
      href: "/import?source=csv#csv-import",
      icon: FileUp,
      status: "Measured data",
    },
    {
      title: "Try sample data",
      detail: "Preview the complete workflow with a small, clearly labelled demo session.",
      href: "/import?source=sample#csv-import",
      icon: FlaskConical,
      status: "Demo session",
    },
  ];

  return (
    <section
      className="rounded-3xl border border-border bg-card p-4 sm:p-5"
      aria-labelledby="source-heading"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            Step 1 of 4
          </p>
          <h2
            id="source-heading"
            className="mt-1 font-display text-2xl font-semibold tracking-tight"
          >
            Choose your source
          </h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Measured session data gives the most useful analysis. Manual entry stays available for
            rounds.
          </p>
        </div>
        <StatusPill tone="sky">Private by default</StatusPill>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        {sources.map(({ title, detail, href, icon: Icon, status }) => (
          <Link
            key={title}
            href={href}
            prefetch={false}
            className="group rounded-2xl border border-border/80 bg-secondary/45 p-4 transition hover:-translate-y-0.5 hover:border-primary/35 hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <span className="flex items-start justify-between gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                <Icon className="size-5" aria-hidden />
              </span>
              <span className="rounded-full bg-background px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                {status}
              </span>
            </span>
            <span className="mt-4 block font-semibold text-foreground">{title}</span>
            <span className="mt-1 block text-sm leading-5 text-muted-foreground">{detail}</span>
          </Link>
        ))}
      </div>
      <div className="mt-3 flex flex-col gap-2 rounded-2xl border border-dashed border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="flex items-center gap-3 text-sm text-muted-foreground">
          <PenLine className="size-4 shrink-0" aria-hidden />
          Only recording a score? Add the round manually and attach proof later.
        </span>
        <Button asChild variant="ghost" className="min-h-11 justify-start sm:justify-center">
          <Link href="/rounds/new" prefetch={false}>
            Add manual round
          </Link>
        </Button>
      </div>
    </section>
  );
}

function buildImportWorkflowSteps({
  connected,
  duplicateFiles,
  fileCount,
  savedFiles,
}: {
  connected: boolean;
  duplicateFiles: number;
  fileCount: number;
  savedFiles: number;
}): DesktopWorkflowStep[] {
  const hasFiles = fileCount > 0;
  const hasSavedFiles = savedFiles > 0;

  return [
    {
      title: "Choose source",
      detail: "Start with R-Cloud or a Rapsodo CSV before scorecard proof or manual entry.",
      status: connected || hasFiles ? "complete" : "current",
      value: connected ? "R-Cloud ready" : hasFiles ? `${fileCount} files` : "Start here",
    },
    {
      title: "Preview data",
      detail:
        "Inspect accepted rows, excluded shots, units and parse warnings before changing data.",
      status: hasFiles ? "complete" : connected ? "current" : "upcoming",
      value: hasFiles ? `${fileCount} files` : undefined,
    },
    {
      title: "Confirm club mapping",
      detail: "Confirm club names and session context before stock yardages are updated.",
      status: hasSavedFiles ? "complete" : hasFiles ? "current" : "upcoming",
      value:
        duplicateFiles > 0
          ? `${duplicateFiles} duplicates`
          : hasFiles
            ? "Quality check"
            : undefined,
    },
    {
      title: "Review and import",
      detail: "Check duplicates and warnings, then save trusted rows into analysis and practice.",
      status: hasSavedFiles
        ? "complete"
        : hasFiles && duplicateFiles === 0
          ? "current"
          : "upcoming",
      value: hasSavedFiles ? `${savedFiles} saved` : undefined,
    },
  ];
}

function FirstRunRapsodoOnboarding({
  connected,
  fileCount,
}: {
  connected: boolean;
  fileCount: number;
}) {
  if (fileCount > 0) {
    return null;
  }

  const steps = [
    {
      title: "Choose source",
      detail: "Connect Rapsodo, upload a CSV, or load sample data before using manual entry.",
      ready: true,
    },
    {
      title: "Preview data",
      detail: connected
        ? "Load an R-Cloud session and check the shot count before saving."
        : "Connect R-Cloud or open the CSV wizard to preview exported shots.",
      ready: connected,
    },
    {
      title: "Confirm club mapping",
      detail:
        "Confirm club names before stock yardage, coach scoring or challenge proof is trusted.",
      ready: false,
    },
    {
      title: "Review and import",
      detail: "Check duplicates and warnings, then save the trusted rows and open the result.",
      ready: false,
    },
  ];

  return (
    <DataPanel id="rapsodo-first-run" className="scroll-mt-28">
      <SectionHeader
        title="First-time Rapsodo flow"
        description="A short path for new testers: import data, trust the mapping, see one useful golf insight, then decide whether to compete or share."
        action={
          <StatusPill tone={connected || fileCount > 0 ? "green" : "amber"}>
            {connected ? "Connected" : fileCount > 0 ? "Started" : "Start here"}
          </StatusPill>
        }
      />
      <CardContent>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {steps.map((step, index) => (
            <div key={step.title} className="apple-panel-strong p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="grid size-7 place-items-center rounded-md bg-[#F5F6F4] text-sm font-semibold">
                  {index + 1}
                </span>
                {step.ready ? (
                  <CheckCircle2 className="size-4 text-emerald-700" />
                ) : (
                  <span className="text-xs font-medium text-muted-foreground">Next</span>
                )}
              </div>
              <p className="mt-3 text-sm font-semibold">{step.title}</p>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">{step.detail}</p>
            </div>
          ))}
        </div>
        <div className="trust-indicator mt-3 rounded-lg p-3">
          <p className="text-sm font-semibold">What happens to my data?</p>
          <div className="mt-2 grid gap-2 text-sm leading-5 text-muted-foreground sm:grid-cols-4">
            <p>Private by default.</p>
            <p>You control profile, feed and leaderboard visibility.</p>
            <p>Friends do not get account access.</p>
            <p>Coach, viewer and editor access is managed separately.</p>
          </div>
        </div>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Button asChild className="premium-action rounded-lg">
            <a href="#rapsodo-connect">
              <Upload className="size-4" />
              Start with Rapsodo
            </a>
          </Button>
          <Button asChild variant="outline" className="rounded-lg">
            <Link href="/bag" prefetch={false}>
              See stock yardages
            </Link>
          </Button>
        </div>
      </CardContent>
    </DataPanel>
  );
}

const demoEligibleSubmissionCards = [
  {
    title: "Aintree Course Record",
    detail: "Gold proof · Best gross and front nine boards",
    href: "/course-records",
    actionLabel: "Submit",
  },
  {
    title: "Spring Major Round 2",
    detail: "Scorecard screenshot required",
    href: "/tournaments",
    actionLabel: "Submit",
  },
  {
    title: "May Friends Board",
    detail: "Friends · same verification tier",
    href: "/leaderboard",
    actionLabel: "Submit",
  },
  {
    title: "Wedge Window Challenge",
    detail: "12 shots · 24-34° launch",
    href: "/challenges",
    actionLabel: "Submit",
  },
];

function buildEligibleSubmissionCards(
  visibleFiles: Awaited<ReturnType<typeof getImportLibrary>>["files"],
) {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
    return demoEligibleSubmissionCards;
  }

  const savedFiles = visibleFiles.filter((file) => file.status === "saved");
  const duplicateFiles = visibleFiles.filter((file) => file.status === "duplicate");

  if (savedFiles.length === 0) {
    return [
      {
        title: "No eligible submissions yet",
        detail: "Import a verified session before records, tournaments or challenges are offered.",
        href: "#rapsodo-connect",
        actionLabel: "Import",
      },
    ];
  }

  return [
    {
      title: `${integerFormatter.format(savedFiles.length)} imported ${
        savedFiles.length === 1 ? "file" : "files"
      } ready for review`,
      detail: "Open live records and submit only where the course/date rules match.",
      href: "/course-records",
      actionLabel: "Review",
    },
    {
      title: "Challenge eligibility",
      detail: "Use live challenge rules instead of sample event cards.",
      href: "/challenges",
      actionLabel: "Check",
    },
    {
      title:
        duplicateFiles.length > 0
          ? `${integerFormatter.format(duplicateFiles.length)} duplicate ${
              duplicateFiles.length === 1 ? "file" : "files"
            } excluded`
          : "No duplicate blockers",
      detail:
        duplicateFiles.length > 0
          ? "Clean up duplicates before submitting proof-backed results."
          : "Recent imports are not marked as duplicate in the file library.",
      href: "/import",
      actionLabel: "Open",
    },
  ];
}

async function getImportLibrary() {
  const userId = await requireCurrentUserId();
  const db = getDb();
  const [profile] = await db
    .select({ preferredUnits: users.preferredUnits })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const rows = await db
    .select({
      id: importFiles.id,
      sessionId: importFiles.sessionId,
      fileName: importFiles.fileName,
      fileSizeBytes: importFiles.fileSizeBytes,
      rawCsvHash: importFiles.rawCsvHash,
      parseVersion: importFiles.parseVersion,
      status: importFiles.status,
      metadataJson: importFiles.metadataJson,
      createdAt: importFiles.createdAt,
      sessionDate: sessions.date,
      sessionType: sessions.type,
    })
    .from(importFiles)
    .leftJoin(sessions, eq(sessions.id, importFiles.sessionId))
    .where(eq(importFiles.userId, userId))
    .orderBy(desc(importFiles.createdAt))
    .limit(50);

  const preferredDistanceUnit = profile?.preferredUnits === "metres" ? "meters" : "yards";

  return {
    files: rows,
    backfilledCount: rows.filter((row) => Boolean(row.metadataJson.backfilledFromSessionId)).length,
    preferredDistanceUnit: preferredDistanceUnit as "meters" | "yards",
  };
}

function ImportFileLibrary({
  files,
}: {
  files: Awaited<ReturnType<typeof getImportLibrary>>["files"];
}) {
  return (
    <>
      <MobileAccordionSection
        title="File library"
        description="Recent imports and duplicate status."
        count={`${integerFormatter.format(files.length)} files`}
      >
        <MobileDataList
          empty={
            <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
              No import files yet.
            </p>
          }
        >
          {files.slice(0, 8).map((file) => (
            <MobileDataCard
              key={file.id}
              title={file.fileName}
              subtitle={`${formatDate(file.createdAt)} - ${file.parseVersion}`}
              action={<StatusBadge status={file.status} />}
            >
              <DataPair label="Rows" value={file.sessionId ? "Session linked" : "No session"} />
              <DataPair label="Hash" value={file.rawCsvHash.slice(0, 10)} />
              {file.sessionId ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={`/rounds/${file.sessionId}`}>Open session</Link>
                </Button>
              ) : null}
            </MobileDataCard>
          ))}
        </MobileDataList>
      </MobileAccordionSection>

      <DataPanel className="hidden sm:flex">
        <SectionHeader
          title="File library"
          description="Recent imported files, duplicate status, parse version, and linked sessions."
          action={<FileClock className="size-5 text-sky-600" />}
        />
        <CardContent>
          <DesktopTableWorkbenchControls
            viewKey="import-library"
            scope="import"
            currentViewLabel="Import file library"
            resultLabel={`${integerFormatter.format(files.length)} files`}
            columns={importLibraryColumns}
            suggestedViews={importLibrarySuggestedViews}
            exportTableId="import-library"
            exportFileName="forekinghell-import-library.csv"
            className="mb-3"
          />
          <DataTableFrame
            mainTable
            mainTableLabel="Import file library table"
            stickyFirstColumn
            mobile={
              <MobileDataList
                empty={
                  <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                    No import files yet.
                  </p>
                }
              >
                {files.map((file) => (
                  <MobileDataCard
                    key={file.id}
                    title={file.fileName}
                    subtitle={`${formatDate(file.createdAt)} - ${file.parseVersion}`}
                    action={<StatusBadge status={file.status} />}
                  >
                    <DataPair
                      label="Rows"
                      value={file.sessionId ? "Session linked" : "No session"}
                    />
                    <DataPair label="Hash" value={file.rawCsvHash.slice(0, 10)} />
                    {file.sessionId ? (
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/rounds/${file.sessionId}`}>Open session</Link>
                      </Button>
                    ) : null}
                  </MobileDataCard>
                ))}
              </MobileDataList>
            }
          >
            <Table
              data-workbench-scope="import"
              data-workbench-export-table="import-library"
              aria-describedby="import-library-summary"
            >
              <TableCaption id="import-library-summary" className="sr-only">
                Recent imported files with duplicate status, linked session, parse version and
                archive action.
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead
                    data-column="file"
                    className="sticky left-0 z-20 bg-white shadow-[1px_0_0_rgba(15,23,42,0.08)]"
                  >
                    File
                  </TableHead>
                  <TableHead data-column="status">Status</TableHead>
                  <TableHead data-column="session">Session</TableHead>
                  <TableHead data-column="parse">Parse</TableHead>
                  <TableHead data-column="actions" className="text-right">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {files.length > 0 ? (
                  files.map((file) => (
                    <TableRow key={file.id} tabIndex={0} className="focus-aaa outline-none">
                      <TableCell
                        data-column="file"
                        className="sticky left-0 z-10 bg-white shadow-[1px_0_0_rgba(15,23,42,0.08)]"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium">{file.fileName}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(file.createdAt)} - {formatBytes(file.fileSizeBytes)} -{" "}
                            {file.rawCsvHash.slice(0, 12)}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell data-column="status">
                        <StatusBadge status={file.status} />
                      </TableCell>
                      <TableCell data-column="session">
                        {file.sessionId ? (
                          <Link
                            href={`/rounds/${file.sessionId}`}
                            className="text-sm font-medium text-emerald-700 hover:underline"
                          >
                            {file.sessionType ?? "Session"}{" "}
                            {file.sessionDate ? formatDate(file.sessionDate) : ""}
                          </Link>
                        ) : (
                          <span className="text-sm text-muted-foreground">No session</span>
                        )}
                      </TableCell>
                      <TableCell data-column="parse">
                        <span className="inline-flex items-center gap-1 text-sm">
                          <RefreshCw className="size-3.5 text-muted-foreground" />
                          {file.parseVersion}
                        </span>
                      </TableCell>
                      <TableCell data-column="actions" className="text-right">
                        <form action={archiveImportFileAction}>
                          <input type="hidden" name="importFileId" value={file.id} />
                          <ConfirmSubmitButton
                            type="submit"
                            variant="ghost"
                            size="sm"
                            confirmTitle="Archive import file"
                            confirmMessage={`Archive ${file.fileName}? This removes it from the active import library without deleting linked session evidence.`}
                            confirmActionLabel="Archive file"
                          >
                            <Archive className="size-4" />
                            Archive
                          </ConfirmSubmitButton>
                        </form>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      No import files yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </DataTableFrame>
        </CardContent>
      </DataPanel>
    </>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone = status === "saved" ? "green" : status === "duplicate" ? "amber" : "slate";
  return <StatusPill tone={tone}>{status}</StatusPill>;
}

function formatDate(value: Date) {
  return dateFormatter.format(value);
}

function formatBytes(value: number | null) {
  if (!value) {
    return "Size unknown";
  }

  if (value < 1024 * 1024) {
    return `${Math.round(value / 1024)} KB`;
  }

  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}
