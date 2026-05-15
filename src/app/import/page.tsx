import Link from "next/link";
import { Archive, Award, FileClock, RefreshCw, ShieldCheck, Upload } from "lucide-react";
import { desc, eq } from "drizzle-orm";

import { archiveImportFileAction } from "@/app/import/actions";
import { ImportForm } from "@/app/import/import-form";
import { MobileRapsodoConnect } from "@/app/import/mobile-rapsodo-connect";
import { getRapsodoConnectionStatusAction } from "@/app/rapsodo/actions";
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
  PageHeader,
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

export const dynamic = "force-dynamic";

const integerFormatter = new Intl.NumberFormat("en-GB");
const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export default async function ImportPage() {
  const [library, rapsodoStatus] = await Promise.all([
    getImportLibrary(),
    getRapsodoConnectionStatusAction(),
  ]);
  const visibleFiles = library.files.filter((file) => file.status !== "archived");
  const duplicateFiles = visibleFiles.filter((file) => file.status === "duplicate").length;
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
      <MobileAppShell>
        <MobileTopBar title="Import" />
        <MobileTabBar
          activeKey="rapsodo"
          className="sticky top-[calc(6.75rem+env(safe-area-inset-top)+1px)] z-40 bg-white"
          tabs={[
            { key: "rapsodo", label: "Rapsodo", href: "#rapsodo-connect" },
            { key: "csv", label: "CSV", href: "#csv-import" },
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
            <Button asChild className="rounded-full bg-[#0B7A3B] text-white hover:bg-[#064E3B]">
              <a href="#rapsodo-connect">
                <Upload className="size-4" />
                Rapsodo
              </a>
            </Button>
          }
        />
        <MobileRapsodoConnect initialStatus={connectionStatus} />
        <EventHeroCard
          eyebrow="After import"
          title="Eligible submissions appear here"
          description="Course records, tournaments, challenges and friend boards are suggested after Rapsodo data is saved."
          href="#rapsodo-connect"
          actionLabel="Connect Rapsodo"
          media={<PageArtwork variant="import" alt="" className="block h-full min-h-0 rounded-none" sizes="100vw" />}
        />
        <NativeListSection title="This round qualifies for">
          {eligibleSubmissionCards.map((item) => (
            <div key={item.title} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-[#E5E7EB] bg-white p-3">
              <div className="min-w-0">
                <p className="truncate font-semibold">{item.title}</p>
                <p className="mt-1 text-sm text-[#6B7280]">{item.detail}</p>
              </div>
              <Button asChild variant="outline" className="rounded-full">
                <Link href={item.href} prefetch={false}>Submit</Link>
              </Button>
            </div>
          ))}
        </NativeListSection>
        <NativeListSection id="import-sources" title="Other sources">
          <div className="grid gap-2">
            <Link
              href="/rapsodo"
              prefetch={false}
              className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-[#E5E7EB] bg-white p-3"
            >
              <Upload className="size-5 text-[#0B7A3B]" />
              <span className="min-w-0">
                <span className="block font-semibold">Rapsodo R-Cloud sessions</span>
                <span className="block text-sm text-[#6B7280]">Load session list, preview shots and import verified data</span>
              </span>
              <ProofBadge tier="gold" />
            </Link>
            <BottomSheet
              label={
                <span id="csv-import" className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 text-left">
                  <Upload className="size-5 text-[#0B7A3B]" />
                  <span>
                    <span className="block font-semibold">CSV files</span>
                    <span className="block text-sm font-normal text-[#6B7280]">Fallback upload for exported Rapsodo CSVs</span>
                  </span>
                  <ProofBadge tier="silver" />
                </span>
              }
              title="Import CSV files"
              triggerClassName="w-full rounded-lg bg-white p-3 text-[#050505] ring-1 ring-[#E5E7EB]"
            >
              <ImportForm defaultDistanceUnit={library.preferredDistanceUnit} />
            </BottomSheet>
            <BottomSheet
              label={<><ShieldCheck className="size-4" /> Upload scorecard proof</>}
              title="Scorecard proof"
              triggerClassName="w-full rounded-lg bg-white text-[#050505] ring-1 ring-[#E5E7EB]"
            >
              <div className="grid gap-3 text-sm text-[#6B7280]">
                <p>Use proof upload after selecting an eligible record, tournament or challenge. Strong proof combines direct Rapsodo import, scorecard screenshot, course/date/tee match and duplicate checks.</p>
                <Button asChild className="rounded-full bg-[#0B7A3B] text-white">
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
      </MobileAppShell>
      <div className="hidden sm:contents">
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
      </div>
    </PageShell>
    <div id="rapsodo-import" className="hidden sm:block">
      <ImportForm defaultDistanceUnit={library.preferredDistanceUnit} />
    </div>
    </>
  );
}

const eligibleSubmissionCards = [
  {
    title: "Aintree Course Record",
    detail: "Gold proof · Best gross and front nine boards",
    href: "/course-records",
  },
  {
    title: "Spring Major Round 2",
    detail: "Scorecard screenshot required",
    href: "/tournaments",
  },
  {
    title: "May Friends Board",
    detail: "Friends · same verification tier",
    href: "/leaderboard",
  },
  {
    title: "Wedge Window Challenge",
    detail: "12 shots · 24-34° launch",
    href: "/challenges",
  },
];

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
    <>
    <MobileAccordionSection
      title="File library"
      description="Recent imports and duplicate status."
      count={`${integerFormatter.format(files.length)} files`}
    >
      <MobileDataList empty={<p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No import files yet.</p>}>
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
