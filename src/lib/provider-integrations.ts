import "server-only";

import { count, desc, eq } from "drizzle-orm";

import {
  importJobs,
  importMappings,
  importSourceFiles,
  providerAccounts,
  providerSessions,
} from "@/db/schema";
import { getDb } from "@/db/client";
import { requireCurrentUserId } from "@/lib/current-user";
import { launchMonitorProviders } from "@/lib/imports/providers";
import { safeProviderFailureMessage } from "@/lib/provider-failure-message";

export async function getProviderIntegrationsPageData(
  requested: { sessionsPage?: number; jobsPage?: number; filesPage?: number } = {},
) {
  const userId = await requireCurrentUserId();
  const db = getDb();
  const [sessionTotal, jobTotal, fileTotal] = await Promise.all([
    db.select({ total: count() }).from(providerSessions).where(eq(providerSessions.userId, userId)),
    db.select({ total: count() }).from(importJobs).where(eq(importJobs.userId, userId)),
    db
      .select({ total: count() })
      .from(importSourceFiles)
      .where(eq(importSourceFiles.userId, userId)),
  ]);
  function paging(value: number | undefined, total: number) {
    const pages = Math.max(1, Math.ceil(total / 20));
    const page = Math.min(pages, Number.isSafeInteger(value) && value! > 0 ? value! : 1);
    return { page, pages, total, offset: (page - 1) * 20 };
  }
  const pagination = {
    sessions: paging(requested.sessionsPage, sessionTotal[0].total),
    jobs: paging(requested.jobsPage, jobTotal[0].total),
    files: paging(requested.filesPage, fileTotal[0].total),
  };
  const [accounts, sessions, jobs, files, mappings] = await Promise.all([
    getDb()
      .select()
      .from(providerAccounts)
      .where(eq(providerAccounts.userId, userId))
      .orderBy(desc(providerAccounts.updatedAt)),
    getDb()
      .select()
      .from(providerSessions)
      .where(eq(providerSessions.userId, userId))
      .orderBy(desc(providerSessions.lastSeenAt), desc(providerSessions.id))
      .limit(20)
      .offset(pagination.sessions.offset),
    getDb()
      .select()
      .from(importJobs)
      .where(eq(importJobs.userId, userId))
      .orderBy(desc(importJobs.createdAt), desc(importJobs.id))
      .limit(20)
      .offset(pagination.jobs.offset),
    getDb()
      .select()
      .from(importSourceFiles)
      .where(eq(importSourceFiles.userId, userId))
      .orderBy(desc(importSourceFiles.createdAt), desc(importSourceFiles.id))
      .limit(20)
      .offset(pagination.files.offset),
    getDb()
      .select()
      .from(importMappings)
      .where(eq(importMappings.userId, userId))
      .orderBy(desc(importMappings.updatedAt)),
  ]);

  // Browsing old evidence must not turn the health cards into old connection state.
  const [recentSessions, recentJobs, recentFiles] = await Promise.all([
    pagination.sessions.page === 1
      ? sessions
      : db
          .select()
          .from(providerSessions)
          .where(eq(providerSessions.userId, userId))
          .orderBy(desc(providerSessions.lastSeenAt), desc(providerSessions.id))
          .limit(20),
    pagination.jobs.page === 1
      ? jobs
      : db
          .select()
          .from(importJobs)
          .where(eq(importJobs.userId, userId))
          .orderBy(desc(importJobs.createdAt), desc(importJobs.id))
          .limit(20),
    pagination.files.page === 1
      ? files
      : db
          .select()
          .from(importSourceFiles)
          .where(eq(importSourceFiles.userId, userId))
          .orderBy(desc(importSourceFiles.createdAt), desc(importSourceFiles.id))
          .limit(20),
  ]);
  return {
    pagination,
    latestJobs: recentJobs.map((job) => ({
      ...job,
      errorMessage: safeProviderFailureMessage(job.errorMessage),
    })),
    providers: launchMonitorProviders.map((provider) => {
      const providerAccountsForKind = accounts.filter(
        (account) => account.providerKind === provider.providerKind,
      );
      const providerSessionsForKind = recentSessions.filter(
        (session) => session.providerKind === provider.providerKind,
      );
      const providerJobsForKind = recentJobs.filter(
        (job) => job.providerKind === provider.providerKind,
      );
      const providerFilesForKind = recentFiles.filter(
        (file) => file.providerKind === provider.providerKind,
      );
      const failedJobs = providerJobsForKind.filter(
        (job) => job.status === "failed" || Boolean(job.errorMessage),
      );

      return {
        providerKind: provider.providerKind,
        label: provider.label,
        status: provider.status,
        accountCount: providerAccountsForKind.length,
        sessionCount: providerSessionsForKind.length,
        jobCount: providerJobsForKind.length,
        fileCount: providerFilesForKind.length,
        mappingCount: mappings.filter((mapping) => mapping.providerKind === provider.providerKind)
          .length,
        lastSyncAt: latestDate([
          ...providerAccountsForKind.map((account) => account.updatedAt),
          ...providerSessionsForKind.flatMap((session) => [
            session.importedAt,
            session.lastSeenAt,
            session.updatedAt,
          ]),
          ...providerJobsForKind.map((job) => job.updatedAt),
          ...providerFilesForKind.map((file) => file.updatedAt),
        ]),
        failureCount: failedJobs.length,
        latestFailureMessage: safeProviderFailureMessage(failedJobs[0]?.errorMessage),
      };
    }),
    accounts,
    sessions,
    jobs: jobs.map((job) => ({
      ...job,
      errorMessage: safeProviderFailureMessage(job.errorMessage),
    })),
    files,
    mappings,
  };
}

function latestDate(values: Array<Date | null>) {
  const timestamps = values
    .filter((value): value is Date => value instanceof Date)
    .map((value) => value.getTime());

  if (timestamps.length === 0) {
    return null;
  }

  return new Date(Math.max(...timestamps));
}
