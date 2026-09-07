import { AdminNav, formatDateTime } from "@/app/admin/admin-components";
import { AdminChallengeBoardRegister } from "@/app/admin/admin-challenge-board-register";
import { AdminChallengeTemplates } from "@/app/admin/admin-challenge-templates";
import { PageHeader, PageShell } from "@/components/premium";
import { getAdminChallengesData } from "@/lib/admin";
export const dynamic = "force-dynamic";
export default async function AdminChallengesPage() {
  const data = await getAdminChallengesData();
  return (
    <PageShell>
      <div className="grid min-w-0 gap-5 pb-28">
        <AdminNav active="/admin/challenges" />
        <PageHeader
          title="Challenges and tournaments"
          description="Inspect competition participation and manage the supported challenge templates."
        />
        <p className="text-sm text-muted-foreground">
          Database snapshot: {formatDateTime(new Date())}. Board totals describe the newest 80
          boards at most.
        </p>
        <dl className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Templates", data.templates.length, "#templates"],
            [
              "Open loaded boards",
              data.challenges.filter((r) => r.status === "open").length,
              "#boards",
            ],
            [
              "Entries in loaded boards",
              data.challenges.reduce((n, r) => n + r.entryCount, 0),
              "#boards",
            ],
            [
              "Attempts in loaded boards",
              data.challenges.reduce((n, r) => n + r.attemptCount, 0),
              "#boards",
            ],
          ].map(([label, value, href]) => (
            <div key={label}>
              <dt className="text-sm text-muted-foreground">
                <a href={String(href)} className="underline underline-offset-4">
                  {label}
                </a>
              </dt>
              <dd className="text-2xl font-semibold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
        <AdminChallengeBoardRegister
          rows={data.challenges.map((r) => ({
            id: r.id,
            title: r.title,
            owner: r.creatorDisplayName,
            template: r.templateName,
            status: r.status,
            visibility: r.visibility,
            entries: r.entryCount,
            attempts: r.attemptCount,
            results: r.resultCount,
            starts: r.startsAt?.toISOString() ?? "Not recorded",
            ends: r.endsAt?.toISOString() ?? "No scheduled end",
            created: r.createdAt.toISOString(),
          }))}
        />
        <AdminChallengeTemplates
          templates={data.templates.map((r) => ({
            ...r,
            createdAt: r.createdAt.toISOString(),
            updatedAt: r.updatedAt.toISOString(),
          }))}
        />
      </div>
    </PageShell>
  );
}
