import Link from "next/link";
import { Cable, CheckCircle2, Database, FileSpreadsheet, FlaskConical, GitCompareArrows, Upload } from "lucide-react";

import { ProviderHealthFeaturePanel } from "@/components/features/feature-panels";
import { MobileRouteHeader } from "@/components/mobile-sports";
import { PageShell, StatusPill } from "@/components/premium";
import { PageArtwork, type PageArtworkVariant } from "@/components/visuals/page-artwork";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getFeatureIdeasData } from "@/lib/feature-ideas";
import { getProviderIntegrationsPageData } from "@/lib/provider-integrations";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function ProvidersPage() {
  const [data, featureData] = await Promise.all([getProviderIntegrationsPageData(), getFeatureIdeasData()]);

  return (
    <PageShell size="7xl">
      <MobileRouteHeader title="Platform" group="platform" activeKey="providers" />

      <header className="premium-hero p-3 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <StatusPill tone="sky">Import expansion</StatusPill>
            <h1 className="mt-2 text-lg font-semibold leading-tight tracking-normal sm:mt-3 sm:text-3xl">Launch monitor providers</h1>
            <p className="mt-1 hidden max-w-3xl text-sm leading-5 text-muted-foreground sm:mt-2 sm:block sm:leading-6">
              ForeKingHell becomes your cross-device golf performance history. Rapsodo is live; Square and TrackMan are staged as beta provider tiles.
            </p>
          </div>
          <div data-primary-action className="shrink-0">
            <Button asChild size="sm" className="rounded-lg bg-[#0B7A3B] text-white hover:bg-[#064E3B]">
              <Link href="/import" prefetch={false}>
                <Upload className="size-4" />
                Import file
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        {data.providers.map((provider) => (
          <article key={provider.providerKind} className="premium-card p-4">
            <PageArtwork
              variant={providerArtwork(provider.providerKind)}
              alt=""
              className="mb-3 block h-28 min-h-0 rounded-lg"
              sizes="(min-width: 768px) 33vw, 100vw"
            />
            <div className="flex items-start justify-between gap-3">
              <div>
                <Badge variant={provider.status === "live" ? "secondary" : "outline"}>{provider.status}</Badge>
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

      <ProviderHealthFeaturePanel data={featureData} />

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <main className="premium-card p-4">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Database className="size-4 text-sky-600" />
            Recent provider sessions
          </p>
          <div className="mt-4 grid gap-2">
            {data.sessions.length === 0 ? (
              <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No provider sessions recorded yet.</p>
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
              {data.files.length === 0 ? <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">No source files yet.</p> : null}
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
              {data.jobs.length === 0 ? <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">No import jobs yet.</p> : null}
            </div>
          </section>

          <section className="premium-card p-4">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Cable className="size-4 text-slate-700" />
              Import health
            </p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Each connected source reports mapping, review and sync status before new shots enter your performance history.
            </p>
          </section>
        </aside>
      </section>
    </PageShell>
  );
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

function providerArtwork(kind: string): PageArtworkVariant {
  if (kind.toLowerCase().includes("rapsodo")) {
    return "providerRapsodo";
  }

  if (kind.toLowerCase().includes("square")) {
    return "providerSquare";
  }

  if (kind.toLowerCase().includes("trackman")) {
    return "providerTrackman";
  }

  return "import";
}
