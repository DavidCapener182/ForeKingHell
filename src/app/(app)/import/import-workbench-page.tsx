import Link from "next/link";
import { Archive, FileClock, RefreshCw, ShieldCheck, Upload } from "lucide-react";
import { desc, eq } from "drizzle-orm";

import { archiveImportFileAction } from "@/app/import/actions";
import { UntitledPageHeader } from "@/components/untitled-ui/headers";
import { ImportSourceChooser } from "@/app/import/import-source-chooser";
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
  DesktopTableWorkbenchControls,
  type DesktopSavedViewSuggestion,
  type DesktopWorkbenchColumn,
  type DesktopWorkflowHelpItem,
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
  const connectionStatus = rapsodoStatus.ok
    ? rapsodoStatus.data
    : {
        connected: false,
        expiresAt: null,
        profile: null,
      };
  return (
    <PageShell>
      <UntitledPageHeader
        title="Import"
        description="Choose a source, review the current batch and save your session."
        actions={
          <Button asChild variant="outline">
            <a href="#import-library">Recent imports</a>
          </Button>
        }
      />
      <div className="grid min-w-0 gap-5">
        <ImportSourceChooser
          connected={connectionStatus.connected}
          initialSource={startWithSampleData ? "sample" : "csv"}
        />

        <div id="csv-import" className="min-w-0 scroll-mt-28">
          <ImportForm
            defaultDistanceUnit={library.preferredDistanceUnit}
            startWithSampleData={startWithSampleData}
          />
        </div>
        <details className="rounded-xl border border-border p-4">
          <summary className="min-h-11 cursor-pointer py-2 font-semibold">
            Import help and data quality
          </summary>
          <div className="grid gap-3 pt-3">
            {importWorkflowHelpItems.map((item) => (
              <div key={item.title}>
                <h2 className="text-sm font-semibold">{item.title}</h2>
                <p className="text-sm text-muted-foreground">{item.detail}</p>
              </div>
            ))}
          </div>
          <FirstRunRapsodoOnboarding
            connected={connectionStatus.connected}
            fileCount={visibleFiles.length}
          />
          <div id="import-quality" className="mt-4 scroll-mt-28">
            <ImportQualityFeaturePanel data={featureData} />
          </div>
        </details>
        <div id="import-library" className="min-w-0 scroll-mt-28">
          <ImportFileLibrary files={visibleFiles} />
        </div>
      </div>
    </PageShell>
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
            History of up to 50 recent files. These outcomes do not change the current upload steps.
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
        <DataTableFrame
          mainTable
          mainTableLabel="Import file library table"
          stickyFirstColumn
          mobile={
            <div className="divide-y divide-border rounded-xl border border-border bg-card">
              {files.length ? (
                files.map((file) => (
                  <details key={file.id} className="p-3">
                    <summary className="min-h-12 cursor-pointer py-1">
                      <span className="block break-words text-sm font-semibold">
                        {file.fileName}
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {formatDate(file.createdAt)} · {file.status}
                      </span>
                    </summary>
                    <div className="grid gap-3 pt-3">
                      <dl className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <dt className="text-xs text-muted-foreground">Size</dt>
                          <dd>{formatBytes(file.fileSizeBytes)}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-muted-foreground">Parser</dt>
                          <dd>{file.parseVersion}</dd>
                        </div>
                        <div className="col-span-2">
                          <dt className="text-xs text-muted-foreground">Source fingerprint</dt>
                          <dd className="break-all">{file.rawCsvHash}</dd>
                        </div>
                      </dl>
                      {file.sessionId ? (
                        <Button asChild variant="outline" className="min-h-11">
                          <Link
                            href={`/${file.sessionType === "round" || file.sessionType === "simulated_course" ? "rounds" : "sessions"}/${file.sessionId}`}
                          >
                            Open {file.sessionType ?? "session"}
                          </Link>
                        </Button>
                      ) : (
                        <p className="text-sm text-muted-foreground">No linked session</p>
                      )}
                      <form action={archiveImportFileAction}>
                        <input type="hidden" name="importFileId" value={file.id} />
                        <ConfirmSubmitButton
                          type="submit"
                          variant="ghost"
                          className="min-h-11"
                          confirmTitle="Archive import file"
                          confirmMessage={`Archive ${file.fileName}? Linked session evidence is retained.`}
                          confirmActionLabel="Archive file"
                        >
                          Archive file
                        </ConfirmSubmitButton>
                      </form>
                    </div>
                  </details>
                ))
              ) : (
                <p className="p-4 text-sm text-muted-foreground">
                  No import files yet. Choose a source above.
                </p>
              )}
            </div>
          }
        >
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
                        <p className="max-w-72 whitespace-normal break-words font-medium">
                          {file.fileName}
                        </p>
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
                          href={`/${file.sessionType === "round" || file.sessionType === "simulated_course" ? "rounds" : "sessions"}/${file.sessionId}`}
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
