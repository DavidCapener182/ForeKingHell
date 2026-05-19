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
    providers: launchMonitorProviders.map((provider) => ({
      providerKind: provider.providerKind,
      label: provider.label,
      status: provider.status,
      accountCount: accounts.filter((account) => account.providerKind === provider.providerKind)
        .length,
      sessionCount: sessions.filter((session) => session.providerKind === provider.providerKind)
        .length,
      jobCount: jobs.filter((job) => job.providerKind === provider.providerKind).length,
      mappingCount: mappings.filter((mapping) => mapping.providerKind === provider.providerKind)
        .length,
    })),
    accounts,
    sessions,
    jobs,
    files,
    mappings,
  };
}
