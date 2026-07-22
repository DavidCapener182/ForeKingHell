import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { ArrowLeft, ExternalLink, FileLock2, Link2, ShieldCheck } from "lucide-react";

import { createCoachReportAction, revokeCoachReportAction } from "@/app/coach/reports/actions";
import { PageHeader, PageShell, StatusPill } from "@/components/premium";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getDb } from "@/db/client";
import { contentExports, shareLinks } from "@/db/schema";
import { coachReportSectionIds, type CoachReportSectionId } from "@/lib/coach-report";
import { coachReportTemplates, parseCoachReportAccessConfig } from "@/lib/coach-report-access";
import { requireCurrentUserId } from "@/lib/current-user";
import { getSiteOrigin } from "@/lib/site-origin";

export const dynamic = "force-dynamic";

const sectionCopy: Record<
  CoachReportSectionId,
  { title: string; detail: string; checked: boolean }
> = {
  profile_summary: {
    title: "Profile summary",
    detail: "Display name, home course, handicap band and launch-monitor setup.",
    checked: true,
  },
  goals: {
    title: "Current goals",
    detail: "Season outcome, target date, focus and weekly rhythm.",
    checked: true,
  },
  bag_numbers: {
    title: "Bag numbers",
    detail: "Stock carry, playable rate, sample size and confidence by club.",
    checked: true,
  },
  recent_sessions: {
    title: "Recent sessions",
    detail: "Up to eight session dates, sources and measured shot counts.",
    checked: true,
  },
  key_trends: {
    title: "Key trends",
    detail: "Deterministic movement, trust and sample-confidence signals.",
    checked: true,
  },
  bag_gaps: {
    title: "Bag gaps",
    detail: "Adjacent stock-carry gaps with the supporting sample size.",
    checked: true,
  },
  practice_adherence: {
    title: "Practice adherence",
    detail: "The last 28 days of planned, completed and measured sessions.",
    checked: true,
  },
  course_performance: {
    title: "Course performance",
    detail: "Recent recorded rounds, gross scores and scorecard completeness.",
    checked: false,
  },
  personal_bests: {
    title: "Personal bests",
    detail: "Selected measured carry bests with their supporting clean-shot sample.",
    checked: false,
  },
  saved_comparisons: {
    title: "Saved session comparisons",
    detail: "Frozen session-versus-session notes, sample sizes, verdicts and metric deltas.",
    checked: false,
  },
  notes: {
    title: "Your notes",
    detail: "Recent session and practice notes. Leave off if they are private.",
    checked: false,
  },
  raw_evidence: {
    title: "Selected raw evidence",
    detail: "The 20 latest shots with a limited, coach-useful metric set.",
    checked: false,
  },
};

export default async function CoachReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ share?: string; error?: string; include?: string }>;
}) {
  const params = await searchParams;
  const userId = await requireCurrentUserId();
  const links = await getDb()
    .select({
      id: shareLinks.id,
      title: shareLinks.title,
      createdAt: shareLinks.createdAt,
      expiresAt: shareLinks.expiresAt,
      revokedAt: shareLinks.revokedAt,
      exportCreatedAt: contentExports.createdAt,
      renderConfig: contentExports.renderConfigJson,
    })
    .from(shareLinks)
    .innerJoin(
      contentExports,
      and(
        eq(contentExports.id, shareLinks.resourceId),
        eq(contentExports.userId, shareLinks.userId),
        eq(contentExports.sourceType, "coach_report"),
      ),
    )
    .where(and(eq(shareLinks.userId, userId), eq(shareLinks.resourceType, "coach_report")))
    .orderBy(desc(shareLinks.createdAt))
    .limit(20);
  const sharedUrl = params.share
    ? `${getSiteOrigin()}/share/report/${encodeURIComponent(params.share)}`
    : null;
  const now = new Date();

  return (
    <PageShell>
      <PageHeader
        eyebrow={<StatusPill tone="sky">Selective sharing</StatusPill>}
        title="Coach reports"
        description="Create a frozen evidence report, choose exactly what it contains, and revoke access whenever you want."
        actions={
          <Button asChild variant="outline" className="min-h-11 rounded-xl">
            <Link href="/coach">
              <ArrowLeft className="size-4" aria-hidden />
              Coach
            </Link>
          </Button>
        }
      />

      {params.error === "select_sections" ? (
        <div
          role="alert"
          className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive"
        >
          Select at least one report section.
        </div>
      ) : null}

      {sharedUrl ? (
        <Card className="premium-card border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="size-5 text-primary" aria-hidden />
              Report link ready
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <div>
              <Label htmlFor="new-report-link">Private share link</Label>
              <Input id="new-report-link" value={sharedUrl} readOnly className="mt-2" />
              <p className="mt-2 text-xs text-muted-foreground">
                This token is shown once. Save it before leaving the page.
              </p>
            </div>
            <Button asChild className="premium-action min-h-11 rounded-xl">
              <Link href={sharedUrl} target="_blank" rel="noreferrer">
                Open report
                <ExternalLink className="size-4" aria-hidden />
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(20rem,0.75fr)]">
        <Card className="premium-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileLock2 className="size-5 text-primary" aria-hidden />
              Create a frozen report
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createCoachReportAction} className="grid gap-4">
              <div className="grid gap-2 sm:max-w-md">
                <Label htmlFor="template">Report template</Label>
                <select
                  id="template"
                  name="template"
                  defaultValue="coach"
                  className="h-11 rounded-xl border border-input bg-background px-3 text-sm"
                >
                  {coachReportTemplates.map((template) => (
                    <option key={template.value} value={template.value}>
                      {template.label}
                    </option>
                  ))}
                </select>
              </div>
              <fieldset className="grid gap-3 sm:grid-cols-2">
                <legend className="mb-2 font-semibold">Include these sections</legend>
                {coachReportSectionIds.map((section) => {
                  const copy = sectionCopy[section];
                  return (
                    <label
                      key={section}
                      className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border/70 bg-secondary/35 p-4"
                    >
                      <input
                        type="checkbox"
                        name="sections"
                        value={section}
                        defaultChecked={
                          copy.checked ||
                          (section === "saved_comparisons" && params.include === "comparisons")
                        }
                        className="mt-1 size-4 accent-primary"
                      />
                      <span>
                        <span className="block font-semibold">{copy.title}</span>
                        <span className="mt-1 block text-sm leading-5 text-muted-foreground">
                          {copy.detail}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </fieldset>

              <div className="grid gap-2 sm:max-w-xs">
                <Label htmlFor="expiryDays">Link expires after</Label>
                <select
                  id="expiryDays"
                  name="expiryDays"
                  defaultValue="14"
                  className="h-11 rounded-xl border border-input bg-background px-3 text-sm"
                >
                  <option value="7">7 days</option>
                  <option value="14">14 days</option>
                  <option value="30">30 days</option>
                </select>
              </div>

              <div className="grid gap-3 rounded-2xl border border-border bg-secondary/35 p-4 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-semibold sm:col-span-2">
                  Optional password
                  <Input
                    name="password"
                    type="password"
                    minLength={8}
                    maxLength={128}
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
                  />
                </label>
                <PrivacyCheck
                  name="disableDownload"
                  title="Disable download"
                  detail="Keep the report view-only."
                />
                <PrivacyCheck
                  name="hideExactShotData"
                  title="Hide exact shot data"
                  detail="Raw evidence is omitted even if selected above."
                  defaultChecked
                />
                <PrivacyCheck
                  name="hideSocialInformation"
                  title="Hide social information"
                  detail="No friends, groups or feed information."
                  defaultChecked
                />
              </div>

              <Button type="submit" className="premium-action min-h-11 rounded-xl sm:w-fit">
                Generate private link
              </Button>
            </form>
          </CardContent>
        </Card>

        <aside className="grid content-start gap-4">
          <Card className="premium-card">
            <CardContent className="pt-5">
              <ShieldCheck className="size-6 text-primary" aria-hidden />
              <h2 className="mt-4 font-display text-xl font-semibold">
                The coach sees this report only
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                The link does not create an account role or grant access to sessions, settings,
                billing, social data, or future changes. It serves the frozen snapshot you chose.
              </p>
            </CardContent>
          </Card>
        </aside>
      </section>

      <section aria-labelledby="report-history-title" className="grid gap-3">
        <div>
          <h2 id="report-history-title" className="font-display text-2xl font-semibold">
            Report history
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Tokens are never stored in readable form, so old links cannot be shown again.
          </p>
        </div>
        {links.length > 0 ? (
          <div className="grid gap-3">
            {links.map((link) => {
              const access = parseCoachReportAccessConfig(link.renderConfig);
              const expired = Boolean(link.expiresAt && link.expiresAt <= now);
              const status = link.revokedAt ? "Revoked" : expired ? "Expired" : "Active";
              return (
                <Card key={link.id} className="premium-card">
                  <CardContent className="flex flex-col gap-3 pt-5 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold">{link.title ?? "Coach report"}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Created {formatDate(link.exportCreatedAt)} · {status}
                        {link.expiresAt ? ` · expires ${formatDate(link.expiresAt)}` : ""}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {access.passwordHash ? "Password protected" : "Token protected"} ·{" "}
                        {access.disableDownload ? "Download disabled" : "Download allowed"} ·{" "}
                        {access.accessHistory.length} recorded{" "}
                        {access.accessHistory.length === 1 ? "view" : "views"}
                        {access.accessHistory.at(-1)
                          ? ` · last ${formatDate(new Date(access.accessHistory.at(-1)!))}`
                          : ""}
                      </p>
                    </div>
                    {!link.revokedAt && !expired ? (
                      <form action={revokeCoachReportAction}>
                        <input type="hidden" name="shareLinkId" value={link.id} />
                        <Button type="submit" variant="outline" className="min-h-11 rounded-xl">
                          Revoke link
                        </Button>
                      </form>
                    ) : (
                      <StatusPill tone="slate">{status}</StatusPill>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
            No coach reports have been created yet.
          </div>
        )}
      </section>
    </PageShell>
  );
}

function PrivacyCheck({
  name,
  title,
  detail,
  defaultChecked = false,
}: {
  name: string;
  title: string;
  detail: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex items-start gap-3 rounded-xl bg-background p-3">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="mt-1 size-4 accent-primary"
      />
      <span>
        <span className="block font-semibold">{title}</span>
        <span className="mt-1 block text-xs font-normal leading-5 text-muted-foreground">
          {detail}
        </span>
      </span>
    </label>
  );
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(value);
}
