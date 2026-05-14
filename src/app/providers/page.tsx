import Link from "next/link";
import { Cable, CheckCircle2, Database, FileSpreadsheet, FlaskConical, Upload } from "lucide-react";

import { PageShell, StatusPill } from "@/components/premium";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
      <header className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <StatusPill tone="sky">Import expansion</StatusPill>
            <h1 className="mt-3 text-3xl font-semibold tracking-normal">Launch monitor providers</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              Rapsodo stays live while Square and TrackMan adapters share the same normalised metrics, provider sessions and import jobs.
            </p>
          </div>
          <Button asChild>
            <Link href="/import" prefetch={false}>
              <Upload className="size-4" />
              Import file
            </Link>
          </Button>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        {data.providers.map((provider) => (
          <article key={provider.providerKind} className="rounded-xl border bg-white p-4 shadow-sm">
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
          </article>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <main className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Database className="size-4 text-sky-600" />
            Recent provider sessions
          </p>
          <div className="mt-4 grid gap-2">
            {data.sessions.length === 0 ? (
              <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No provider sessions recorded yet.</p>
            ) : (
              data.sessions.map((session) => (
                <div key={session.id} className="rounded-xl border bg-slate-50 px-3 py-2 text-sm">
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
          <section className="rounded-xl border bg-white p-4 shadow-sm">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <FileSpreadsheet className="size-4 text-emerald-600" />
              Source files
            </p>
            <div className="mt-3 grid gap-2">
              {data.files.slice(0, 8).map((file) => (
                <div key={file.id} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                  <p className="truncate font-medium">{file.fileName}</p>
                  <p className="text-xs text-muted-foreground">{file.providerKind} · {file.status}</p>
                </div>
              ))}
              {data.files.length === 0 ? <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">No source files yet.</p> : null}
            </div>
          </section>

          <section className="rounded-xl border bg-white p-4 shadow-sm">
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

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-slate-50 px-2 py-2">
      <p className="text-lg font-semibold tracking-normal">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
