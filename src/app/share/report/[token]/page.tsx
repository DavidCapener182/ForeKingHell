import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { and, eq, gt, isNull, or } from "drizzle-orm";

import { getDb } from "@/db/client";
import { contentExports, shareLinks } from "@/db/schema";
import { getRequestAppSurface } from "@/lib/app-surface-server";
import type { AppSurface } from "@/lib/app-surface";
import { isCoachReportSnapshot, type CoachReportSnapshot } from "@/lib/coach-report";
import {
  parseCoachReportAccessConfig,
  reportAccessCookieName,
  reportAccessGrant,
} from "@/lib/coach-report-access";
import { hashShareToken } from "@/lib/share-links";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Shared coach report",
  robots: { index: false, follow: false },
};

export default async function SharedCoachReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams?: Promise<{ error?: string }>;
}) {
  const [{ token }, query, surface] = await Promise.all([
    params,
    searchParams,
    getRequestAppSurface(),
  ]);
  if (token.length < 20 || token.length > 256) notFound();

  const now = new Date();
  const [row] = await getDb()
    .select({
      exportId: contentExports.id,
      title: shareLinks.title,
      expiresAt: shareLinks.expiresAt,
      snapshot: contentExports.snapshotJson,
      renderConfig: contentExports.renderConfigJson,
      tokenHash: shareLinks.tokenHash,
    })
    .from(shareLinks)
    .innerJoin(
      contentExports,
      and(
        eq(contentExports.id, shareLinks.resourceId),
        eq(contentExports.userId, shareLinks.userId),
        eq(contentExports.sourceType, "coach_report"),
        eq(contentExports.status, "ready"),
      ),
    )
    .where(
      and(
        eq(shareLinks.tokenHash, hashShareToken(token)),
        eq(shareLinks.resourceType, "coach_report"),
        isNull(shareLinks.revokedAt),
        or(isNull(shareLinks.expiresAt), gt(shareLinks.expiresAt, now)),
      ),
    )
    .limit(1);

  if (!row || !isCoachReportSnapshot(row.snapshot)) notFound();
  const report = row.snapshot;
  const access = parseCoachReportAccessConfig(row.renderConfig);
  if (access.passwordHash) {
    const store = await cookies();
    const granted = store.get(reportAccessCookieName(row.exportId))?.value;
    if (granted !== reportAccessGrant(row.tokenHash, access.passwordHash)) {
      return renderPasswordGate(surface, token, query?.error === "password");
    }
  }

  const viewedAt = new Date().toISOString();
  await getDb()
    .update(contentExports)
    .set({
      renderConfigJson: {
        ...row.renderConfig,
        accessHistory: [...access.accessHistory, viewedAt].slice(-50),
      },
      updatedAt: new Date(),
    })
    .where(eq(contentExports.id, row.exportId));

  return renderReport(surface, {
    report,
    title: row.title ?? report.title,
    expiresAt: row.expiresAt,
    passwordProtected: Boolean(access.passwordHash),
    disableDownload: access.disableDownload,
  });
}

async function renderPasswordGate(surface: AppSurface, token: string, invalid: boolean) {
  if (surface === "companion") {
    const { SharedCoachReportPasswordGate } = await import("./shared-coach-report-companion");
    return <SharedCoachReportPasswordGate token={token} invalid={invalid} />;
  }

  const { SharedCoachReportPasswordGate } = await import("./shared-coach-report-workbench");
  return <SharedCoachReportPasswordGate token={token} invalid={invalid} />;
}

async function renderReport(
  surface: AppSurface,
  props: {
    report: CoachReportSnapshot;
    title: string;
    expiresAt: Date | null;
    passwordProtected: boolean;
    disableDownload: boolean;
  },
) {
  if (surface === "companion") {
    const { SharedCoachReportView } = await import("./shared-coach-report-companion");
    return <SharedCoachReportView {...props} />;
  }

  const { SharedCoachReportView } = await import("./shared-coach-report-workbench");
  return <SharedCoachReportView {...props} />;
}
