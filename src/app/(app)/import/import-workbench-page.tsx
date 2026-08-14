import Link from "next/link";
import {
  Archive,
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
import { getRapsodoConnectionStatusAction } from "@/app/rapsodo/actions";
import { AppEmptyState } from "@/components/app/app-empty-state";
import { ConfirmSubmitButton } from "@/components/app/confirm-submit-button";
import { ImportQualityFeaturePanel } from "@/components/features/feature-panels";
import { DataTableFrame, PageShell, StatusPill } from "@/components/premium";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
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

export default async function ImportWorkbenchPage({ searchParams }: ImportPageProps) {
  const [params, library, rapsodoStatus, featureData] = await Promise.all([
    searchParams,
    getImportLibrary(),
    getRapsodoConnectionStatusAction(),
    getFeatureIdeasData(),
  ]);
  const startWithSampleData = params?.source === "sample";
  const visibleFiles = library.files.filter((file) => file.status !== "archived");
  const duplicateFiles = visibleFiles.filter((file) => file.status === "duplicate").length;
  const savedFiles = visibleFiles.filter((file) => file.status === "saved").length;
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
    <PageShell>
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
        <div id="csv-import" className="min-w-0 scroll-mt-28">
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
    </PageShell>
  );
}

function ImportSourceChooser({ connected }: { connected: boolean }) {
  const sources = [
    {
      title: connected ? "Rapsodo connected" : "Connect Rapsodo",
      detail: connected
        ? "Open R-Cloud and choose a measured session."
        : "Connect R-Cloud and choose a measured session.",
      href: "/rapsodo",
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
    <Card aria-labelledby="source-heading" className="shadow-sm" data-import-source-card>
      <CardHeader className="flex-row flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            Step 1 of 4
          </p>
          <CardTitle id="source-heading" className="mt-1 font-display text-2xl tracking-tight">
            Choose your source
          </CardTitle>
          <CardDescription className="mt-1 text-sm leading-6">
            Measured session data gives the most useful analysis. Manual entry stays available for
            rounds.
          </CardDescription>
        </div>
        <StatusPill tone="sky">Private by default</StatusPill>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 lg:grid-cols-3">
          {sources.map(({ title, detail, href, icon: Icon, status }) => (
            <Link
              key={title}
              href={href}
              prefetch={false}
              className="group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Item variant="muted" className="h-full items-start p-4 group-hover:bg-muted">
                <ItemMedia className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="size-5" aria-hidden />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>{title}</ItemTitle>
                  <ItemDescription className="whitespace-normal">{detail}</ItemDescription>
                </ItemContent>
                <ItemActions>
                  <Badge variant="secondary">{status}</Badge>
                </ItemActions>
              </Item>
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
      </CardContent>
    </Card>
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

  return (
    <Alert id="rapsodo-first-run" className="scroll-mt-28" data-import-first-run-alert>
      <ShieldCheck className="size-4" aria-hidden />
      <AlertTitle className="flex flex-wrap items-center gap-2">
        Start with measured data
        <Badge variant={connected ? "default" : "outline"}>
          {connected ? "Rapsodo connected" : "Choose a source"}
        </Badge>
      </AlertTitle>
      <AlertDescription className="grid gap-3">
        <p>
          The workflow above guides preview, club mapping and review. Your first job is only to
          connect R-Cloud or choose a CSV; imported data stays private until you change sharing.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild className="premium-action rounded-lg">
            <Link href="/rapsodo">
              <Upload className="size-4" />
              {connected ? "Load Rapsodo session" : "Connect Rapsodo"}
            </Link>
          </Button>
          <Button asChild variant="outline" className="rounded-lg">
            <Link href="/import?source=csv#csv-import">Choose CSV instead</Link>
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
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
    <Card className="shadow-sm" data-import-library-card>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div>
          <CardTitle>File library</CardTitle>
          <CardDescription>
            Recent imported files, duplicate status, parse version, and linked sessions.
          </CardDescription>
        </div>
        <FileClock className="size-5 text-primary" />
      </CardHeader>
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
        <DataTableFrame mainTable mainTableLabel="Import file library table" stickyFirstColumn>
          <Table
            data-workbench-scope="import"
            data-workbench-export-table="import-library"
            aria-describedby="import-library-summary"
          >
            <TableCaption id="import-library-summary" className="sr-only">
              Recent imported files with duplicate status, linked session, parse version and archive
              action.
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead
                  data-column="file"
                  className="sticky left-0 z-20 bg-card shadow-[1px_0_0_hsl(var(--border))]"
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
                      className="sticky left-0 z-10 bg-card shadow-[1px_0_0_hsl(var(--border))]"
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
                          className="text-sm font-medium text-primary hover:underline"
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
                  <TableCell colSpan={5} className="p-4">
                    <AppEmptyState
                      icon={<FileClock className="size-5" />}
                      title="No import files yet"
                      description="Choose R-Cloud, upload a CSV, or try the labelled sample data to start the library."
                      primaryAction={
                        <Button asChild>
                          <Link href="/rapsodo">Open Rapsodo</Link>
                        </Button>
                      }
                      secondaryAction={
                        <Button asChild variant="outline">
                          <Link href="/import?source=sample#csv-import">Try sample data</Link>
                        </Button>
                      }
                      className="border-0 bg-transparent"
                    />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </DataTableFrame>
      </CardContent>
    </Card>
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
