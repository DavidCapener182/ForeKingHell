import Link from "next/link";
import { Archive, FileClock, RefreshCw } from "lucide-react";
import { desc, eq } from "drizzle-orm";

import { archiveImportFileAction } from "@/app/import/actions";
import { ImportForm } from "@/app/import/import-form";
import {
  DataPanel,
  DataPair,
  DataTableFrame,
  MobileDataCard,
  MobileDataList,
  PageHeader,
  PageShell,
  SectionHeader,
  StatusPill,
} from "@/components/premium";
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

export const dynamic = "force-dynamic";

const integerFormatter = new Intl.NumberFormat("en-GB");
const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export default async function ImportPage() {
  const library = await getImportLibrary();
  const visibleFiles = library.files.filter((file) => file.status !== "archived");
  const duplicateFiles = visibleFiles.filter((file) => file.status === "duplicate").length;

  return (
    <>
    <PageShell>
      <PageHeader
        eyebrow={<StatusPill tone="green">Import</StatusPill>}
        title="CSV import"
        description="Upload Rapsodo files, review duplicates, and keep a versioned file history for reprocessing."
        metrics={[
          { label: "Files", value: integerFormatter.format(visibleFiles.length), detail: "Saved import-file records" },
          { label: "Duplicates", value: integerFormatter.format(duplicateFiles), detail: "Detected before save" },
          { label: "Backfilled", value: integerFormatter.format(library.backfilledCount), detail: "Recovered from legacy sessions" },
        ]}
      />

      <ImportFileLibrary files={visibleFiles} />
    </PageShell>
    <ImportForm defaultDistanceUnit={library.preferredDistanceUnit} />
    </>
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

function ImportFileLibrary({ files }: { files: Awaited<ReturnType<typeof getImportLibrary>>["files"] }) {
  return (
    <DataPanel>
      <SectionHeader
        title="File library"
        description="Recent imported files, duplicate status, parse version, and linked sessions."
        action={<FileClock className="size-5 text-sky-600" />}
      />
      <CardContent>
        <DataTableFrame
          mobile={
            <MobileDataList empty={<p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No import files yet.</p>}>
              {files.map((file) => (
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
                          {formatDate(file.createdAt)} - {formatBytes(file.fileSizeBytes)} - {file.rawCsvHash.slice(0, 12)}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell><StatusBadge status={file.status} /></TableCell>
                    <TableCell>
                      {file.sessionId ? (
                        <Link href={`/rounds/${file.sessionId}`} className="text-sm font-medium text-emerald-700 hover:underline">
                          {file.sessionType ?? "Session"} {file.sessionDate ? formatDate(file.sessionDate) : ""}
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
                  <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                    No import files yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </DataTableFrame>
      </CardContent>
    </DataPanel>
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
