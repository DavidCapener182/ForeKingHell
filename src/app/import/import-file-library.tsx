import { ImportHistoryTools as DesktopTableWorkbenchControls } from "./import-history-tools";
import Link from "next/link";
import { Archive, FileClock, RefreshCw } from "lucide-react";
import { archiveImportFileAction } from "@/app/import/actions";
import { AppEmptyState } from "@/components/app/app-empty-state";
import { ConfirmSubmitButton } from "@/components/app/confirm-submit-button";
import { DataTableFrame, StatusPill } from "@/components/premium";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type DesktopSavedViewSuggestion,
  type DesktopWorkbenchColumn,
} from "@/components/app/desktop-workbench-controls";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { getImportFileHistory } from "@/lib/import-file-history";
import { importHistoryHref, type ImportHistoryParams } from "@/lib/import-history-query";
import { ImportHistoryFilters } from "./import-history-filters";
const integerFormatter = new Intl.NumberFormat("en-GB");
const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});
const importLibraryColumns: DesktopWorkbenchColumn[] = [
  { id: "file", label: "File", locked: true },
  { id: "status", label: "Status" },
  { id: "source", label: "Source" },
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
export function ImportFileLibrary({
  history,
  params = {},
}: {
  history: Awaited<ReturnType<typeof getImportFileHistory>>;
  params?: ImportHistoryParams;
}) {
  const { files } = history;
  const planId = Array.isArray(params.practicePlanId)
    ? params.practicePlanId[0]
    : params.practicePlanId;
  const planQuery = planId ? `?practicePlanId=${encodeURIComponent(planId)}` : "";
  return (
    <Card className="shadow-sm" data-import-library-card>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div>
          <CardTitle>File library</CardTitle>
          <CardDescription>
            Search your complete file history. CSV exports contain this page of matching files only.
            Historical outcomes do not complete the current upload steps.
          </CardDescription>
        </div>
        <FileClock className="size-5 text-primary" />
      </CardHeader>
      <CardContent>
        <ImportHistoryFilters
          query={history.query}
          statuses={history.statuses}
          sources={history.sources}
        />
        <p role="status" className="mb-3 text-sm">
          {history.total} matching files · Page {history.page} of {history.pages} · {files.length}{" "}
          files on this page
        </p>
        <nav aria-label="Import history pages" className="mb-3 flex flex-wrap items-center gap-3">
          {history.page > 1 ? (
            <Button asChild variant="outline">
              <Link href={importHistoryHref(params, history.page - 1)} scroll={false}>
                Previous files
              </Link>
            </Button>
          ) : null}
          {history.page < history.pages ? (
            <Button asChild variant="outline">
              <Link href={importHistoryHref(params, history.page + 1)} scroll={false}>
                Next files
              </Link>
            </Button>
          ) : null}
        </nav>
        <DesktopTableWorkbenchControls
          viewKey="import-library"
          scope="import"
          currentViewLabel="Import file library"
          resultLabel={`${integerFormatter.format(files.length)} files on this page of ${integerFormatter.format(history.total)} matches`}
          columns={importLibraryColumns}
          suggestedViews={importLibrarySuggestedViews}
          exportTableId="import-library"
          exportFileName={`forekinghell-import-library-page-${history.page}.csv`}
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
                        {formatDate(file.createdAt)} · {file.source} · {file.status}
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
                          disabled={file.status === "archived"}
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
                  No files match this history scope. Clear or change the filters.
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
                <TableHead data-column="source">Source</TableHead>
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
                    <TableCell data-column="source">{file.source}</TableCell>
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
                          disabled={file.status === "archived"}
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
                  <TableCell colSpan={6} className="p-4">
                    <AppEmptyState
                      icon={<FileClock className="size-5" />}
                      title="No matching import files"
                      description="Clear or change the history filters, or choose an import source to add a file."
                      primaryAction={
                        <Button asChild>
                          <Link href={`/rapsodo${planQuery}`}>Open Rapsodo</Link>
                        </Button>
                      }
                      secondaryAction={
                        <Button asChild variant="outline">
                          <Link
                            href={`/import?source=sample${planId ? `&practicePlanId=${encodeURIComponent(planId)}` : ""}#csv-import`}
                          >
                            Try sample data
                          </Link>
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
