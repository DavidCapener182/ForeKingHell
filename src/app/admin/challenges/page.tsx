import Link from "next/link";
import { Flag, ListChecks, Target, Trophy } from "lucide-react";

import {
  AdminMetric,
  AdminNav,
  AdminPageHeader,
  AdminSection,
  formatDateTime,
  label,
  StatusBadge,
} from "@/app/admin/admin-components";
import { PageShell } from "@/components/premium";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getAdminChallengesData } from "@/lib/admin";

export const dynamic = "force-dynamic";

export default async function AdminChallengesPage() {
  const data = await getAdminChallengesData();
  const openChallenges = data.challenges.filter((challenge) => challenge.status === "open");
  const totalEntries = data.challenges.reduce((sum, challenge) => sum + challenge.entryCount, 0);
  const totalAttempts = data.challenges.reduce((sum, challenge) => sum + challenge.attemptCount, 0);

  return (
    <PageShell size="7xl">
      <AdminNav active="/admin/challenges" />

      <AdminPageHeader
        eyebrow="Admin challenges"
        title="Challenges and tournaments"
        description="Monitor challenge templates, active boards, participation, attempts and calculated results."
        tone="amber"
      />

      <section className="grid gap-3 md:grid-cols-4">
        <AdminMetric
          icon={ListChecks}
          label="Templates"
          value={data.templates.length}
          detail="Challenge formats"
        />
        <AdminMetric
          icon={Trophy}
          label="Challenges"
          value={data.challenges.length}
          detail={`${openChallenges.length} open`}
        />
        <AdminMetric
          icon={Flag}
          label="Entries"
          value={totalEntries}
          detail="Joined participants"
        />
        <AdminMetric
          icon={Target}
          label="Attempts"
          value={totalAttempts}
          detail="Submitted scores"
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start">
        <AdminSection
          title="Templates"
          description="Seeded formats available to public and private challenges."
        >
          <div className="grid gap-2">
            {data.templates.map((template) => (
              <div key={template.id} className="rounded-xl bg-slate-50 px-3 py-2 text-sm">
                <p className="font-medium">{template.name}</p>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                  {template.description ?? "No description"}
                </p>
                <p className="mt-2 font-mono text-xs text-muted-foreground">
                  {label(template.challengeType)}
                </p>
              </div>
            ))}
          </div>
        </AdminSection>

        <AdminSection
          title="Challenge boards"
          description="Open the public challenge page for creation and participant-facing operations."
          action={
            <Button asChild variant="outline">
              <Link href="/challenges">Open challenges</Link>
            </Button>
          }
        >
          <div
            aria-label="Challenge boards table"
            tabIndex={0}
            className="overflow-x-auto outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="border-b text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Challenge</th>
                  <th className="px-3 py-2 font-medium">Owner</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Participation</th>
                  <th className="px-3 py-2 font-medium">Ends</th>
                  <th className="px-3 py-2 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {data.challenges.map((challenge) => (
                  <tr key={challenge.id} className="border-b last:border-b-0">
                    <td className="px-3 py-3">
                      <p className="font-medium">{challenge.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{challenge.templateName}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge variant="outline">{label(challenge.visibility)}</Badge>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-medium">{challenge.creatorDisplayName}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {challenge.creatorEmail ?? "No email"}
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge status={challenge.status} />
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">
                      {challenge.entryCount} entries · {challenge.attemptCount} attempts ·{" "}
                      {challenge.resultCount} results
                    </td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">
                      {formatDateTime(challenge.endsAt)}
                    </td>
                    <td className="px-3 py-3">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/challenges/${challenge.id}`}>Open</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AdminSection>
      </section>
    </PageShell>
  );
}
