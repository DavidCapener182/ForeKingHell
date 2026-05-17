import Link from "next/link";
import type { ReactNode } from "react";
import { Archive, Award, FileClock, RefreshCw, ShieldCheck, Upload } from "lucide-react";
import { desc, eq } from "drizzle-orm";

import { archiveImportFileAction } from "@/app/import/actions";
import { ImportForm } from "@/app/import/import-form";
import { MobileRapsodoConnect } from "@/app/import/mobile-rapsodo-connect";
import { getRapsodoConnectionStatusAction } from "@/app/rapsodo/actions";
import {
  BottomSheet,
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
          activeKey="connect"
          className="sticky top-[calc(6.75rem+env(safe-area-inset-top)+1px)] z-40 bg-white"
          tabs={[
            { key: "connect", label: "Connect", href: "#rapsodo-connect" },
            { key: "csv", label: "CSV", href: "#csv-import" },
            { key: "manual", label: "Manual", href: "/rounds/new" },
            { key: "proof", label: "Proof", href: "/import#proof" },
          ]}
        />
        <MobileStatusAction
          label="Launch monitor import"
          value="Connect or import data"
          detail={`${integerFormatter.format(visibleFiles.length)} recent files · ${integerFormatter.format(duplicateFiles)} duplicates detected · Rapsodo live`}
          action={
            <Button asChild className="rounded-full bg-[#0B7A3B] text-white hover:bg-[#064E3B]">
              <a href="#rapsodo-connect">
                <Upload className="size-4" />
                Provider
              </a>
            </Button>
          }
        />
        <NativeListSection
          id="import-sources"
          title="Import routes"
          description="Provider sync, CSV upload, and manual rounds all feed the same performance history."
        >
          <div className="grid gap-2">
            <Link
              href="#rapsodo-connect"
              prefetch={false}
              className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-[#E5E7EB] bg-white p-3"
            >
              <Upload className="size-5 text-[#0B7A3B]" />
              <span className="min-w-0">
                <span className="block font-semibold">Connect provider</span>
                <span className="block text-sm text-[#6B7280]">Rapsodo R-Cloud is live; adapter-ready providers share the same history layer</span>
              </span>
              <ProofBadge tier="gold" />
            </Link>
            <BottomSheet
              label={
                <span id="csv-import" className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 text-left">
                  <Upload className="size-5 text-[#0B7A3B]" />
                    <span>
                    <span className="block font-semibold">CSV files</span>
                    <span className="block text-sm font-normal text-[#6B7280]">Upload exported launch-monitor or simulator files</span>
                  </span>
                  <ProofBadge tier="silver" />
                </span>
              }
              title="Upload CSV files"
              triggerClassName="w-full rounded-lg bg-white p-3 text-[#050505] ring-1 ring-[#E5E7EB]"
            >
              <ImportForm defaultDistanceUnit={library.preferredDistanceUnit} />
            </BottomSheet>
            <Button asChild variant="outline" className="h-auto justify-start rounded-lg p-3">
              <Link href="/rounds/new" prefetch={false}>
                <Award className="size-4" />
                <span className="grid text-left">
                  <span className="font-semibold">Manual round</span>
                  <span className="text-sm font-normal text-[#6B7280]">Add a real scorecard when there is no device file</span>
                </span>
              </Link>
            </Button>
          </div>
        </NativeListSection>
        <MobileRapsodoConnect initialStatus={connectionStatus} />
        <MobileAccordionSection
          title="Proof and submissions"
          description="Use after a round or verified provider import is saved."
          count={eligibleSubmissionCards.length}
        >
          <MobileDataList>
            <BottomSheet
              label={<><ShieldCheck className="size-4" /> Scorecard proof</>}
              title="Scorecard proof"
              triggerClassName="w-full rounded-lg bg-white text-[#050505] ring-1 ring-[#E5E7EB]"
            >
              <div className="grid gap-3 text-sm text-[#6B7280]">
                <p>Use proof upload after selecting an eligible record, tournament or challenge. Strong proof combines direct provider import, scorecard screenshot, course/date/tee match and duplicate checks.</p>
                <Button asChild className="rounded-full bg-[#0B7A3B] text-white">
                  <a href="#rapsodo-connect">Continue to provider sync</a>
                </Button>
              </div>
            </BottomSheet>
            {eligibleSubmissionCards.map((item) => (
              <MobileDataCard
                key={item.title}
                href={item.href}
                title={item.title}
                subtitle={item.detail}
                action={<StatusPill tone="slate">Submit</StatusPill>}
              />
            ))}
          </MobileDataList>
        </MobileAccordionSection>
        <ImportFileLibrary files={visibleFiles} />
      </MobileAppShell>
      <div className="hidden sm:contents">
      <PageHeader
        eyebrow={<StatusPill tone="green">Import</StatusPill>}
        title="Launch monitor import"
        description="Connect or import from any launch monitor. Rapsodo is live; Square, TrackMan and other sources use the same adapter-ready import contract."
        metrics={[
          { label: "Files", value: integerFormatter.format(visibleFiles.length), detail: "Saved import-file records" },
          { label: "Duplicates", value: integerFormatter.format(duplicateFiles), detail: "Detected before save" },
          { label: "Backfilled", value: integerFormatter.format(library.backfilledCount), detail: "Recovered from legacy sessions" },
        ]}
      />

      <ImportSourceGrid />
      <DesktopCsvImportPanel preferredDistanceUnit={library.preferredDistanceUnit} />
      <ImportFileLibrary files={visibleFiles} />
      </div>
    </PageShell>
    </>
  );
}

function DesktopCsvImportPanel({
  preferredDistanceUnit,
}: {
  preferredDistanceUnit: "meters" | "yards";
}) {
  return (
    <section
      id="desktop-csv-import"
      className="hidden scroll-mt-28 overflow-hidden rounded-lg border border-[#d9ded8] bg-white sm:block"
    >
      <ImportForm defaultDistanceUnit={preferredDistanceUnit} />
    </section>
  );
}

function ImportSourceGrid() {
  return (
    <section className="grid gap-4 lg:grid-cols-3">
      <ImportSourceCard
        title="Connect provider"
        description="Rapsodo R-Cloud is live. Provider accounts keep verified sessions tied to the original source."
        href="/rapsodo"
        cta="Open Rapsodo"
        badge="Rapsodo live"
        icon={<ShieldCheck className="size-5" />}
      />
      <ImportSourceCard
        title="Upload CSV"
        description="Upload exported launch-monitor or simulator files, map columns, preserve raw rows and normalize metrics."
        href="#desktop-csv-import"
        cta="Upload files"
        badge="Adapter-ready"
        icon={<Upload className="size-5" />}
      />
      <ImportSourceCard
        title="Manual round"
        description="Add real scorecards when there is no device file, keeping course form separate from simulator data."
        href="/rounds/new"
        cta="Add round"
        badge="Course data"
        icon={<Award className="size-5" />}
      />
    </section>
  );
}

function ImportSourceCard({
  title,
  description,
  href,
  cta,
  badge,
  icon,
}: {
  title: string;
  description: string;
  href: string;
  cta: string;
  badge: string;
  icon: ReactNode;
}) {
  return (
    <DataPanel className="h-full">
      <CardContent className="grid h-full gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="grid size-11 place-items-center rounded-lg bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
            {icon}
          </div>
          <StatusPill tone="sky">{badge}</StatusPill>
        </div>
        <div>
          <h2 className="text-xl font-semibold tracking-normal">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        </div>
        <Button asChild variant="outline" className="mt-auto w-fit">
          <Link href={href} prefetch={false}>
            {cta}
          </Link>
        </Button>
      </CardContent>
    </DataPanel>
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
