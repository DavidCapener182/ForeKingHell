import Link from "next/link";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { and, count, eq, sql } from "drizzle-orm";
import { CheckCircle2, Crosshair, Database, ShieldCheck, Target, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { DataPanel, PageHeader, PageShell, SectionHeader, StatusPill } from "@/components/premium";
import { clubs, importRows, sessions, shots } from "@/db/schema";
import { getDb } from "@/db/client";
import { requireCurrentUserId } from "@/lib/current-user";
import { getFeatureIdeasData, type FeatureIdeasData } from "@/lib/feature-ideas";

export const dynamic = "force-dynamic";

type ImportResultPageProps = {
  searchParams?: Promise<{
    sessionId?: string;
  }>;
};

const integerFormatter = new Intl.NumberFormat("en-GB");
const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export default async function ImportResultPage({ searchParams }: ImportResultPageProps) {
  const params = await searchParams;
  const sessionId = params?.sessionId;

  if (!sessionId) {
    notFound();
  }

  const [result, featureData] = await Promise.all([
    getImportResultData(sessionId),
    getFeatureIdeasData(),
  ]);

  return (
    <PageShell>
      <PageHeader
        eyebrow={<StatusPill tone="green">Import saved</StatusPill>}
        title={`${integerFormatter.format(result.shotCount)} shots imported`}
        description={`${result.fileName ?? "CSV import"} saved on ${dateFormatter.format(result.date)} with raw rows preserved for audit.`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild className="rounded-lg bg-[#0B7A3B] text-white hover:bg-[#064E3B]">
              <Link href={`/rounds/${result.id}`} prefetch={false}>
                <CheckCircle2 className="size-4" />
                Open session
              </Link>
            </Button>
            <Button asChild variant="outline" className="rounded-lg">
              <Link href="/import" prefetch={false}>
                <Upload className="size-4" />
                Import another
              </Link>
            </Button>
          </div>
        }
      />

      <section className="grid gap-4 md:grid-cols-4">
        <ResultMetric label="Shots imported" value={result.shotCount} detail="Accepted shot rows" />
        <ResultMetric label="Raw rows preserved" value={result.rawRowCount} detail="Audit trail" />
        <ResultMetric label="Clubs updated" value={result.clubCount} detail="Bag map links" />
        <ResultMetric
          label="Questionable rows"
          value={result.questionableRowCount}
          detail="Stored as unknown rows"
        />
      </section>

      <DataPanel>
        <SectionHeader
          title="Data trust score"
          description="Plain-English confidence after this import."
          action={
            <StatusPill tone={featureData.dataHealth.tone}>
              {featureData.dataHealth.metric}
            </StatusPill>
          }
        />
        <CardContent className="grid gap-4 lg:grid-cols-[0.75fr_1.25fr]">
          <div className="rounded-lg border bg-[#F5F6F4] p-4">
            <p className="text-4xl font-semibold tracking-normal">
              {featureData.dataHealth.score}/100
            </p>
            <p className="mt-2 text-sm font-medium">{featureData.dataHealth.status}</p>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {featureData.dataHealth.detail}
            </p>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {featureData.dataHealth.checks.slice(0, 4).map((check) => (
              <Link
                key={check.title}
                href={check.href ?? "/settings"}
                prefetch={false}
                className="rounded-lg border bg-white px-3 py-2 transition-colors hover:border-[#0B7A3B]"
              >
                <p className="text-xs text-muted-foreground">{check.title}</p>
                <p className="mt-1 text-sm font-semibold">{check.metric}</p>
                <p className="mt-2 text-sm leading-5 text-muted-foreground">{check.detail}</p>
              </Link>
            ))}
          </div>
        </CardContent>
      </DataPanel>

      {featureData.practicePlan[0] ? (
        <PracticePrescriptionCard plan={featureData.practicePlan[0]} />
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        <ResultAction
          href="/bag"
          icon={<Target className="size-4" />}
          title="Review bag confidence"
          detail="See carry numbers, trust percentages and gaps after the import."
        />
        <ResultAction
          href="/shots"
          icon={<Database className="size-4" />}
          title="Audit shot rows"
          detail="Inspect normalized shots and preserved raw import rows."
        />
        <ResultAction
          href="/settings#offline-storage"
          icon={<ShieldCheck className="size-4" />}
          title="Offline storage controls"
          detail="Review queued imports and clear temporary device storage."
        />
      </section>
    </PageShell>
  );
}

function PracticePrescriptionCard({ plan }: { plan: FeatureIdeasData["practicePlan"][number] }) {
  return (
    <DataPanel>
      <SectionHeader
        title="Next practice"
        description="One measurable job to run after this import."
        action={
          <StatusPill tone={plan.status === "complete" ? "green" : "amber"}>
            {plan.targetShots} balls
          </StatusPill>
        }
      />
      <CardContent className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 p-4">
          <p className="text-sm font-semibold text-emerald-900">Prescription</p>
          <p className="mt-2 text-2xl font-semibold tracking-normal text-[#111611]">{plan.title}</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{plan.detail}</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <ResultMetric label="Target balls" value={plan.targetShots} detail="Count every shot" />
            <div className="rounded-lg border bg-white p-4">
              <p className="text-sm text-muted-foreground">Goal</p>
              <p className="mt-2 text-lg font-semibold tracking-normal">Stock window</p>
              <p className="mt-1 text-sm text-muted-foreground">Retest next session</p>
            </div>
            <div className="rounded-lg border bg-white p-4">
              <p className="text-sm text-muted-foreground">Focus</p>
              <p className="mt-2 text-lg font-semibold tracking-normal">
                {plan.focusArea.replace(/-/g, " ")}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">Keep it measurable</p>
            </div>
          </div>
        </div>
        <Button asChild className="rounded-lg bg-[#0B7A3B] text-white hover:bg-[#064E3B]">
          <Link href={plan.clubId ? `/bag/${plan.clubId}/analytics` : "/coach"} prefetch={false}>
            <Crosshair className="size-4" />
            Open practice
          </Link>
        </Button>
      </CardContent>
    </DataPanel>
  );
}

async function getImportResultData(sessionId: string) {
  const userId = await requireCurrentUserId();
  const db = getDb();
  const [session] = await db
    .select({
      id: sessions.id,
      date: sessions.date,
      fileName: sessions.fileName,
    })
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))
    .limit(1);

  if (!session) {
    notFound();
  }

  const [shotStats, rowStats] = await Promise.all([
    db
      .select({
        shotCount: count(shots.id),
        clubCount: sql<number>`count(distinct ${clubs.id})::int`,
      })
      .from(shots)
      .leftJoin(clubs, eq(clubs.id, shots.clubId))
      .where(and(eq(shots.sessionId, session.id), eq(shots.userId, userId))),
    db
      .select({
        rawRowCount: count(importRows.id),
        questionableRowCount: sql<number>`count(*) filter (where ${importRows.rowType} = 'unknown')::int`,
      })
      .from(importRows)
      .where(and(eq(importRows.sessionId, session.id), eq(importRows.userId, userId))),
  ]);

  return {
    ...session,
    shotCount: Number(shotStats[0]?.shotCount ?? 0),
    clubCount: Number(shotStats[0]?.clubCount ?? 0),
    rawRowCount: Number(rowStats[0]?.rawRowCount ?? 0),
    questionableRowCount: Number(rowStats[0]?.questionableRowCount ?? 0),
  };
}

function ResultMetric({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-normal">
        {integerFormatter.format(value)}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
    </div>
  );
}

function ResultAction({
  href,
  icon,
  title,
  detail,
}: {
  href: string;
  icon: ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      className="rounded-lg border bg-white p-4 transition-colors hover:border-[#0B7A3B]"
    >
      <span className="grid size-9 place-items-center rounded-lg bg-emerald-50 text-emerald-700">
        {icon}
      </span>
      <p className="mt-3 font-semibold">{title}</p>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">{detail}</p>
    </Link>
  );
}
