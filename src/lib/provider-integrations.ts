import "server-only";

import { desc, eq } from "drizzle-orm";

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

export async function getProviderIntegrationsPageData() {
  const userId = await requireCurrentUserId();
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
      .orderBy(desc(providerSessions.lastSeenAt))
      .limit(20),
    getDb()
      .select()
      .from(importJobs)
      .where(eq(importJobs.userId, userId))
      .orderBy(desc(importJobs.createdAt))
      .limit(20),
    getDb()
      .select()
      .from(importSourceFiles)
      .where(eq(importSourceFiles.userId, userId))
      .orderBy(desc(importSourceFiles.createdAt))
      .limit(20),
    getDb()
      .select()
      .from(importMappings)
      .where(eq(importMappings.userId, userId))
      .orderBy(desc(importMappings.updatedAt)),
  ]);

  return {
    providers: launchMonitorProviders.map((provider) => {
      const providerAccountsForKind = accounts.filter(
        (account) => account.providerKind === provider.providerKind,
      );
      const providerSessionsForKind = sessions.filter(
        (session) => session.providerKind === provider.providerKind,
      );
      const providerJobsForKind = jobs.filter((job) => job.providerKind === provider.providerKind);
      const providerFilesForKind = files.filter(
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
