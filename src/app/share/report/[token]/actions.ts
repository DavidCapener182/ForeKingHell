"use server";

import { randomUUID } from "node:crypto";

import { cookies } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import { and, eq, gt, isNull, or } from "drizzle-orm";

import { getDb } from "@/db/client";
import { contentExports, shareLinks } from "@/db/schema";
import {
  parseCoachReportAccessConfig,
  reportAccessCookieName,
  reportAccessGrant,
  verifyReportPassword,
} from "@/lib/coach-report-access";
import { hashShareToken } from "@/lib/share-links";

async function unlockCoachReport(token: string, formData: FormData, inlineError = false) {
  if (token.length < 20 || token.length > 256) redirect("/privacy");
  const tokenHash = hashShareToken(token);
  const [row] = await getDb()
    .select({ exportId: contentExports.id, config: contentExports.renderConfigJson })
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
        eq(shareLinks.tokenHash, tokenHash),
        eq(shareLinks.resourceType, "coach_report"),
        isNull(shareLinks.revokedAt),
        or(isNull(shareLinks.expiresAt), gt(shareLinks.expiresAt, new Date())),
      ),
    )
    .limit(1);
  if (!row) redirect("/privacy");
  const access = parseCoachReportAccessConfig(row.config);
  const password = String(formData.get("password") ?? "");
  if (!access.passwordHash || !verifyReportPassword(password, access.passwordHash)) {
    if (inlineError) return { error: "That password did not unlock this report. Try again." };
    const query = new URLSearchParams({ error: "password", attempt: randomUUID() });
    redirect(`/share/report/${encodeURIComponent(token)}?${query.toString()}`);
  }
  const store = await cookies();
  store.set(
    reportAccessCookieName(row.exportId),
    reportAccessGrant(tokenHash, access.passwordHash),
    {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: `/share/report/${token}`,
      maxAge: 60 * 60 * 12,
    },
  );
  redirect(`/share/report/${encodeURIComponent(token)}`);
}

export async function unlockCoachReportAction(token: string, formData: FormData) {
  await unlockCoachReport(token, formData);
}

export async function unlockCoachReportStateAction(
  token: string,
  previous: { error?: string },
  formData: FormData,
): Promise<{ error?: string }> {
  void previous;
  try {
    return await unlockCoachReport(token, formData, true);
  } catch (error) {
    unstable_rethrow(error);
    return { error: "This report could not be unlocked. Try again later." };
  }
}
