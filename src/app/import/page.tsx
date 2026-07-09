import Link from "next/link";
import {
  Archive,
  ArrowLeft,
  Award,
  CheckCircle2,
  FileClock,
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
import { ImportQualityFeaturePanel } from "@/components/features/feature-panels";
import {
  BottomSheet,
  EventHeroCard,
  MobileAppShell,
  MobileStatusAction,
  MobileTabBar,
  MobileTopBar,
  NativeListSection,
  ProofBadge,
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
  const mobileCsvMode = params?.source === "csv";
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
              <ImportForm defaultDistanceUnit={library.preferredDistanceUnit} />
            </div>
          </MobileAppShell>
        ) : (
          <MobileAppShell>
            <MobileTopBar title="Import" />
            <MobileTabBar
              activeKey="rapsodo"
              className="sticky top-[calc(6rem+env(safe-area-inset-top)+1px)] z-40"
              tabs={[
                { key: "rapsodo", label: "Rapsodo", href: "#rapsodo-connect" },
                { key: "csv", label: "CSV", href: "/import?source=csv#csv-import" },
                { key: "scorecard", label: "Scorecard", href: "/import#scorecard" },
                { key: "manual", label: "Manual", href: "/rounds/new" },
                { key: "proof", label: "Proof", href: "/import#proof" },
              ]}
            />
            <MobileStatusAction
              label="Rapsodo import"
              value="Import verified session"
              detail={`${integerFormatter.format(visibleFiles.length)} recent files · ${integerFormatter.format(duplicateFiles)} duplicates detected`}
              action={
                <Button asChild className="premium-action rounded-lg">
                  <a href="#rapsodo-connect">
                    <Upload className="size-4" />
                    Rapsodo
                  </a>
                </Button>
              }
            />
            <FirstRunRapsodoOnboarding
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
              <NativeListSection id="import-sources" title="Other sources">
                <div className="grid gap-2">
                  <Link
                    href="/rapsodo"
                    prefetch={false}
                    className="premium-rail-card grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg p-3"
                  >
                    <Upload className="size-5 text-[#0B7A3B]" />
                    <span className="min-w-0">
                      <span className="block font-semibold">Rapsodo R-Cloud sessions</span>
                      <span className="block text-sm text-[#6B7280]">
                        Load session list, preview shots and import verified data
                      </span>
                    </span>
                    <ProofBadge tier="gold" />
                  </Link>
                  <Link
                    id="csv-import"
                    href="/import?source=csv#csv-import"
                    prefetch={false}
                    className="premium-rail-card grid min-h-16 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg p-3 text-left"
                  >
                    <Upload className="size-5 text-[#0B7A3B]" />
                    <span className="min-w-0">
                      <span className="block font-semibold">CSV files</span>
                      <span className="block text-sm font-normal text-[#6B7280]">
                        Open the full import wizard for exported Rapsodo CSVs
                      </span>
                    </span>
                    <ProofBadge tier="silver" />
                  </Link>
                  <BottomSheet
                    label={
                      <>
                        <ShieldCheck className="size-4" /> Upload scorecard proof
                      </>
                    }
                    title="Scorecard proof"
                    triggerClassName="w-full rounded-lg bg-white/80 text-[#050505] ring-1 ring-[#E5E7EB]"
                  >
                    <div className="grid gap-3 text-sm text-[#6B7280]">
                      <p>
                        Use proof upload after selecting an eligible record, tournament or
                        challenge. Strong proof combines direct Rapsodo import, scorecard
                        screenshot, course/date/tee match and duplicate checks.
                      </p>
                      <Button asChild className="premium-action rounded-lg">
                        <a href="#rapsodo-connect">Continue to Rapsodo</a>
                      </Button>
                    </div>
                  </BottomSheet>
                  <Button asChild variant="outline" className="justify-start rounded-lg">
                    <Link href="/rounds/new" prefetch={false}>
                      <Award className="size-4" />
                      Manual round
                    </Link>
                  </Button>
                </div>
              </NativeListSection>
            </MobileAccordionSection>
            <MobileAccordionSection
              title="Eligible submissions"
              description="Record, tournament and challenge suggestions."
              count={`${eligibleSubmissionCards.length} items`}
            >
              <NativeListSection
                title="Eligible submissions"
                description="Secondary suggestions after import quality checks pass."
              >
                {eligibleSubmissionCards.map((item) => (
                  <div
                    key={item.title}
                    className="premium-rail-card grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{item.title}</p>
                      <p className="mt-1 text-sm text-[#6B7280]">{item.detail}</p>
                    </div>
                    <Button asChild variant="outline" className="rounded-full">
                      <Link href={item.href} prefetch={false}>
                        {item.actionLabel}
                      </Link>
                    </Button>
                  </div>
                ))}
              </NativeListSection>
            </MobileAccordionSection>
            <MobileAccordionSection
              title="Full import context"
              description="Why Rapsodo data unlocks the app."
              count="Guide"
            >
              <EventHeroCard
                eyebrow="Empty upload state"
                title="Rapsodo CSVs unlock the app"
                description="Use direct Rapsodo data first; proof and competition prompts stay secondary until the import is reviewed."
                href="#rapsodo-connect"
                actionLabel="Connect Rapsodo"
              />
            </MobileAccordionSection>
          </MobileAppShell>
        )}
        <div className="hidden sm:contents">
          <DesktopWorkflowLayout
            steps={importWorkflowSteps}
            helpTitle="Import centre help"
            helpDescription="Keep launch-monitor data trustworthy"
            helpItems={importWorkflowHelpItems}
          >
            <FirstRunRapsodoOnboarding
              connected={connectionStatus.connected}
              fileCount={visibleFiles.length}
            />
            <div id="rapsodo-import" className="hidden min-w-0 scroll-mt-28 sm:block">
              <ImportForm defaultDistanceUnit={library.preferredDistanceUnit} />
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
      title: "Upload and map",
      detail: "Preview shot rows, confirm distance units and keep club names consistent.",
      status: hasFiles ? "complete" : connected ? "current" : "upcoming",
      value: hasFiles ? `${fileCount} files` : undefined,
    },
    {
      title: "Review rows",
      detail: "Check duplicates, linked sessions, parse version and data-quality warnings.",
      status: hasSavedFiles ? "complete" : hasFiles ? "current" : "upcoming",
      value:
        duplicateFiles > 0
          ? `${duplicateFiles} duplicates`
          : hasFiles
            ? "Quality check"
            : undefined,
    },
    {
      title: "Save import",
      detail: "Only saved imports should feed bag confidence, coach evidence and practice plans.",
      status: hasSavedFiles
        ? "complete"
        : hasFiles && duplicateFiles === 0
          ? "current"
          : "upcoming",
      value: hasSavedFiles ? `${savedFiles} saved` : undefined,
    },
    {
      title: "Use evidence",
      detail:
        "Open the first useful insight, then submit proof-backed records only where rules match.",
      status: hasSavedFiles ? "current" : "upcoming",
      value: hasSavedFiles ? "Ready to cite" : undefined,
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
      title: "Connect/upload",
      detail: "Start with R-Cloud or a Rapsodo CSV so session data becomes the source of truth.",
      ready: true,
    },
    {
      title: "Preview",
      detail: connected
        ? "Load an R-Cloud session and check the shot count before saving."
        : "Connect R-Cloud or open the CSV wizard to preview exported shots.",
      ready: connected,
    },
    {
      title: "Map clubs",
      detail:
        "Confirm club names before stock yardage, coach scoring or challenge proof is trusted.",
      ready: false,
    },
    {
      title: "Import",
      detail: "Save confirmed shots only after duplicates, dates and club mapping look right.",
      ready: false,
    },
    {
      title: "Review trust",
      detail:
        "Use the first trusted insight for bag numbers, practice priorities and optional proof.",
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
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-7">
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
