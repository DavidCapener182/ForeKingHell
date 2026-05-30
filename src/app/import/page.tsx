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
import { PageArtwork } from "@/components/visuals/page-artwork";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
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
  const eligibleSubmissionCards = buildEligibleSubmissionCards(visibleFiles);
  const connectionStatus = rapsodoStatus.ok
    ? rapsodoStatus.data
    : {
        connected: false,
        expiresAt: null,
        profile: null,
      };

  return (
    <>
      <PageShell>
        {mobileCsvMode ? (
          <MobileAppShell>
            <MobileTopBar
              title="CSV import"
              leading={
                <Button asChild variant="ghost" size="icon" className="size-10 rounded-full">
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
                media={
                  <PageArtwork
                    variant="import"
                    alt=""
                    className="block h-full min-h-0 rounded-none"
                    sizes="calc(100vw - 2rem)"
                  />
                }
              />
            </MobileAccordionSection>
          </MobileAppShell>
        )}
        <div className="hidden sm:contents">
          <FirstRunRapsodoOnboarding
            connected={connectionStatus.connected}
            fileCount={visibleFiles.length}
          />
          <div id="rapsodo-import" className="hidden sm:block">
            <ImportForm defaultDistanceUnit={library.preferredDistanceUnit} />
          </div>
          <ImportQualityFeaturePanel data={featureData} />
          <ImportFileLibrary files={visibleFiles} />
        </div>
      </PageShell>
    </>
  );
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
      title: "Welcome",
      detail: "Turn Rapsodo data into stock yardages, progress and practice priorities.",
      ready: true,
    },
    {
      title: "Import Rapsodo",
      detail: connected
        ? "R-Cloud is connected; upload CSV if you want a fallback import."
        : "Upload a CSV or connect/sync Rapsodo.",
      ready: connected,
    },
    {
      title: "Check club mapping",
      detail: "Confirm club names before any stock yardage or challenge data is trusted.",
      ready: false,
    },
    {
      title: "Read first insight",
      detail: "The first card tells you what changed or what data is still missing.",
      ready: false,
    },
    {
      title: "Review bag gaps",
      detail: "Stock yardages and the gapping ladder show the first decision numbers.",
      ready: false,
    },
    {
      title: "Use coach next action",
      detail: "The coach surface gives one practice priority, why it matters and the drill.",
      ready: false,
    },
    {
      title: "Share or compete",
      detail: "PB, challenge and leaderboard prompts stay optional after data checks pass.",
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
          <DataTableFrame
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Session</TableHead>
                  <TableHead>Parse</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {files.length > 0 ? (
                  files.map((file) => (
                    <TableRow key={file.id}>
                      <TableCell>
                        <div className="min-w-0">
                          <p className="truncate font-medium">{file.fileName}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(file.createdAt)} - {formatBytes(file.fileSizeBytes)} -{" "}
                            {file.rawCsvHash.slice(0, 12)}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={file.status} />
                      </TableCell>
                      <TableCell>
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
                      <TableCell>
                        <span className="inline-flex items-center gap-1 text-sm">
                          <RefreshCw className="size-3.5 text-muted-foreground" />
                          {file.parseVersion}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <form action={archiveImportFileAction}>
                          <input type="hidden" name="importFileId" value={file.id} />
                          <Button type="submit" variant="ghost" size="sm">
                            <Archive className="size-4" />
                            Archive
                          </Button>
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
