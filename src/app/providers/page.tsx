import Link from "next/link";
import type { ReactNode } from "react";
import { Cable, CheckCircle2, Database, FileSpreadsheet, FlaskConical, GitCompareArrows, Upload } from "lucide-react";

import { MobileRouteHeader } from "@/components/mobile-sports";
import { DataTableFrame, PageShell, StatusPill } from "@/components/premium";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getProviderIntegrationsPageData } from "@/lib/provider-integrations";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function ProvidersPage() {
  const data = await getProviderIntegrationsPageData();

  return (
    <PageShell size="7xl">
      <MobileRouteHeader title="Platform" group="platform" activeKey="providers" />

      <header className="premium-hero p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <StatusPill tone="sky">Performance platform</StatusPill>
            <h1 className="mt-3 text-3xl font-semibold tracking-normal">
              Launch monitor providers
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              ForeKingHell is the performance history layer for every launch
              monitor, simulator and course round. Rapsodo is live; Square,
              TrackMan and future sources use the same adapter contract as they
              move through beta and research states.
            </p>
          </div>
          <Button asChild>
            <Link href="/import" prefetch={false}>
              <Upload className="size-4" />
              Import data
            </Link>
          </Button>
        </div>
      </header>

      <section className="grid gap-4 lg:grid-cols-3">
        <PlatformPrinciple
          icon={<GitCompareArrows className="size-5" />}
          title="Metric normalisation"
          detail="Carry, total, offline, speed, launch, spin, apex, path, face and smash land in one shared model."
        />
        <PlatformPrinciple
          icon={<FileSpreadsheet className="size-5" />}
          title="Raw data preserved"
          detail="Provider rows and source files stay attached so parsers can improve without losing provenance."
        />
        <PlatformPrinciple
          icon={<Database className="size-5" />}
          title="One history layer"
          detail="Range sessions, simulator rounds and real scorecards feed the same bag, progress and coach views."
        />
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {data.providers.map((provider) => (
          <article key={provider.providerKind} className="premium-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Badge variant={provider.status === "live" ? "secondary" : "outline"}>
                  {statusLabel(provider.status)}
                </Badge>
                <h2 className="mt-3 text-xl font-semibold tracking-normal">{provider.label}</h2>
              </div>
              {provider.status === "live" ? <CheckCircle2 className="size-5 text-emerald-600" /> : <FlaskConical className="size-5 text-amber-600" />}
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <Mini label="Accounts" value={provider.accountCount} />
              <Mini label="Sessions" value={provider.sessionCount} />
              <Mini label="Jobs" value={provider.jobCount} />
            </div>
            <div className="mt-4 grid gap-2 text-sm">
              <ProviderStep done={provider.status === "live"} label="Connect" />
              <ProviderStep done={provider.status === "live"} label="Import file" />
              <ProviderStep done={provider.mappingCount > 0} label="Map fields" />
              <ProviderStep done={provider.sessionCount > 0} label="Review sessions" />
              <ProviderStep done={provider.sessionCount > 0} label="Normalise metrics" />
            </div>
            <Button asChild variant={provider.status === "live" ? "default" : "outline"} className="mt-4 w-full">
              <Link href={provider.status === "live" ? "/import" : "/billing"} prefetch={false}>
                {provider.status === "live" ? <Upload className="size-4" /> : <GitCompareArrows className="size-4" />}
                {provider.status === "live" ? "Import from provider" : "View adapter access"}
              </Link>
            </Button>
          </article>
        ))}
      </section>

      <section className="premium-card p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Cable className="size-4 text-emerald-700" />
              Provider comparison
            </p>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
              Live providers can connect today. Beta and research providers use
              the same adapter shape, with metric coverage visible before full
              release.
            </p>
          </div>
          <StatusPill tone="green">Adapter contract</StatusPill>
        </div>
        <div className="mt-4">
          <DataTableFrame>
            <Table className="min-w-[760px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Provider</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Import paths</TableHead>
                  <TableHead>Supported metrics</TableHead>
                  <TableHead>Raw preservation</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.providers.map((provider) => (
                  <TableRow key={provider.providerKind}>
                    <TableCell className="font-medium">{provider.label}</TableCell>
                    <TableCell>
                      <StatusPill tone={statusTone(provider.status)}>
                        {statusLabel(provider.status)}
                      </StatusPill>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {provider.status === "live"
                        ? "Cloud connect and CSV upload"
                        : "CSV adapter and mapping workflow"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      Carry, total, offline, speed, launch, spin and strike metrics
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      Source file, raw headers, raw rows and parse job history
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DataTableFrame>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <main className="premium-card p-4">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Database className="size-4 text-sky-600" />
            Recent provider sessions
          </p>
          <div className="mt-4 grid gap-2">
            {data.sessions.length === 0 ? (
              <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                Connect a live provider or upload a launch-monitor file to start the shared provider history.
              </p>
            ) : (
              data.sessions.map((session) => (
                <div key={session.id} className="rounded-lg border bg-[#F5F6F4] px-3 py-2 text-sm">
                  <p className="font-medium">{session.title ?? session.providerSessionId}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {session.providerKind} · {session.sessionDate ? dateFormatter.format(session.sessionDate) : "No date"} · {session.importedAt ? "imported" : "pending"}
                  </p>
                </div>
              ))
            )}
          </div>
        </main>

        <aside className="grid gap-4 lg:sticky lg:top-28">
          <section className="premium-card p-4">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <FileSpreadsheet className="size-4 text-emerald-600" />
              Source files
            </p>
            <div className="mt-3 grid gap-2">
              {data.files.slice(0, 8).map((file) => (
                <div key={file.id} className="rounded-lg bg-[#F5F6F4] px-3 py-2 text-sm">
                  <p className="truncate font-medium">{file.fileName}</p>
                  <p className="text-xs text-muted-foreground">{file.providerKind} · {file.status}</p>
                </div>
              ))}
              {data.files.length === 0 ? <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">No source files yet. Upload CSV data to preserve provider originals.</p> : null}
            </div>
          </section>

          <section className="premium-card p-4">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <FlaskConical className="size-4 text-amber-600" />
              Import job status
            </p>
            <div className="mt-3 grid gap-2">
              {data.jobs.slice(0, 6).map((job) => (
                <div key={job.id} className="rounded-lg bg-[#F5F6F4] px-3 py-2 text-sm">
                  <p className="font-medium">{job.providerKind} · {job.status}</p>
                  <p className="text-xs text-muted-foreground">{job.detectedProviderKind ?? "No detected provider"}{job.errorMessage ? ` · ${job.errorMessage}` : ""}</p>
                </div>
              ))}
              {data.jobs.length === 0 ? <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">No import jobs yet. Adapter jobs appear after provider import or CSV upload.</p> : null}
            </div>
          </section>

          <section className="premium-card p-4">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Cable className="size-4 text-slate-700" />
              Adapter contract
            </p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Every provider maps into carry, total, offline, speed, launch, spin, apex, path, face and smash metrics while keeping raw fields.
            </p>
          </section>
        </aside>
      </section>
    </PageShell>
  );
}

function PlatformPrinciple({
  icon,
  title,
  detail,
}: {
  icon: ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <article className="premium-card p-4">
      <div className="grid size-10 place-items-center rounded-lg bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
        {icon}
      </div>
      <h2 className="mt-4 text-lg font-semibold tracking-normal">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{detail}</p>
    </article>
  );
}

function statusLabel(status: string) {
  if (status === "live") return "Live";
  if (status === "beta") return "Beta";
  return "Coming soon";
}

function statusTone(status: string): "green" | "amber" | "slate" {
  if (status === "live") return "green";
  if (status === "beta") return "amber";
  return "slate";
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-[#F5F6F4] px-2 py-2">
      <p className="text-lg font-semibold tracking-normal">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function ProviderStep({ done, label }: { done: boolean; label: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-[#F5F6F4] px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={done ? "font-medium text-emerald-700" : "font-medium text-amber-700"}>
        {done ? "Ready" : "Queued"}
      </span>
    </div>
  );
}
