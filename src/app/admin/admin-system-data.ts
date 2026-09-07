import type { getAdminOperationsSnapshot } from "@/lib/admin";
type HealthState = "failure" | "attention" | "quiet" | "unverified";

type HealthSummaryRow = {
  id: string;
  label: string;
  status: string;
  state: HealthState;
  verified: boolean;
  lastCheck: string;
  impact: string;
  href?: string;
  action?: string;
};

type SystemCheckTableRow = {
  id: string;
  label: string;
  detail: string;
  area: string;
  status: string;
  state: HealthState;
  lastCheck: string;
  evidence: string;
  impact: string;
  href?: string;
  action?: string;
};

export function buildHealthRows(
  operations: Awaited<ReturnType<typeof getAdminOperationsSnapshot>>,
): HealthSummaryRow[] {
  const importStatus = importHealthState(operations);

  return [
    {
      id: "provider",
      label: "Provider",
      status: operations.providerAccounts > 0 ? "Unverified" : "Needs attention",
      state: operations.providerAccounts > 0 ? "unverified" : "attention",
      verified: false,
      lastCheck: "Registry only",
      impact:
        operations.providerAccounts > 0
          ? `${operations.providerAccounts.toLocaleString("en-GB")} provider accounts exist, but live availability was not checked.`
          : "No provider identities are available for sync.",
      href: "/providers?tab=diagnostics#provider-health",
      action: "Inspect",
    },
    {
      id: "imports",
      label: "Imports",
      status: importStatus.status,
      state: importStatus.state,
      verified: importStatus.verified,
      lastCheck: importStatus.verified ? "Current snapshot" : "No job evidence",
      impact:
        operations.providerImportFailures > 0
          ? "Fresh launch-monitor data may be incomplete until failed jobs are resolved."
          : operations.importJobs > 0
            ? `${operations.importJobs.toLocaleString("en-GB")} jobs checked; no recorded failures found.`
            : "There are no tracked jobs from which to judge import health.",
      href: "/providers?tab=diagnostics#provider-jobs",
      action: "Review jobs",
    },
    {
      id: "billing",
      label: "Billing",
      status:
        operations.billingFailures > 0
          ? `${operations.billingFailures.toLocaleString("en-GB")} failures flagged`
          : "No failures flagged",
      state: operations.billingFailures > 0 ? "failure" : "quiet",
      verified: true,
      lastCheck: "Current snapshot",
      impact:
        operations.billingFailures > 0
          ? "Subscription access or support cases may be affected."
          : "No failed billing rows are currently recorded.",
      href: "/admin/billing",
      action: "Inspect",
    },
    {
      id: "auth",
      label: "Auth",
      status: "Unverified",
      state: "unverified",
      verified: false,
      lastCheck: "Not checked",
      impact: "Sign-in and session availability are unknown from this snapshot.",
    },
    {
      id: "rls",
      label: "RLS",
      status: "Unverified",
      state: "unverified",
      verified: false,
      lastCheck: "Not checked",
      impact: "Database access-policy enforcement has no live result here.",
    },
    {
      id: "ai",
      label: "AI",
      status: "Unverified",
      state: "unverified",
      verified: false,
      lastCheck: "Stored rows only",
      impact: `${operations.aiSummaries.toLocaleString("en-GB")} stored summaries do not prove model availability or output quality.`,
      href: "/data-chat",
      action: "Inspect evidence",
    },
    {
      id: "storage",
      label: "Storage",
      status: "Unverified",
      state: "unverified",
      verified: false,
      lastCheck: "Not checked",
      impact: "Upload, download, capacity, and object access are unknown.",
    },
    {
      id: "external-connections",
      label: "External connections",
      status: "Unverified",
      state: "unverified",
      verified: false,
      lastCheck: "Not checked",
      impact: "Third-party reachability and credentials were not probed.",
      href: "/providers?tab=diagnostics#provider-health",
      action: "Inspect",
    },
  ];
}

export function buildSystemCheckRows(
  operations: Awaited<ReturnType<typeof getAdminOperationsSnapshot>>,
): SystemCheckTableRow[] {
  const importStatus = importHealthState(operations);

  return [
    {
      id: "provider-accounts",
      label: "Provider account registry",
      detail: "Connected provider identities available to the import system.",
      area: "Provider",
      status: operations.providerAccounts > 0 ? "Unverified" : "Needs attention",
      state: operations.providerAccounts > 0 ? "unverified" : "attention",
      lastCheck: "Registry only",
      evidence: `${operations.providerAccounts.toLocaleString("en-GB")} accounts`,
      impact:
        operations.providerAccounts > 0
          ? "Account presence does not prove provider availability."
          : "No provider identity is available for sync.",
      href: "/providers?tab=diagnostics#provider-health",
      action: "Provider console",
    },
    {
      id: "import-jobs",
      label: "Tracked import jobs",
      detail: "Provider and source-file imports recorded by the platform.",
      area: "Imports",
      status: importStatus.status,
      state: importStatus.state,
      lastCheck: importStatus.verified ? "Current snapshot" : "No job evidence",
      evidence: `${operations.importJobs.toLocaleString("en-GB")} jobs`,
      impact:
        operations.importJobs > 0
          ? "The failure register can be judged against tracked job volume."
          : "Import health cannot be judged without tracked jobs.",
      href: "/providers?tab=diagnostics#provider-jobs",
      action: "Review jobs",
    },
    {
      id: "provider-failures",
      label: "Provider import failures",
      detail: "Recorded provider imports that need operator review.",
      area: "Imports",
      status:
        operations.providerImportFailures > 0
          ? `${operations.providerImportFailures.toLocaleString("en-GB")} failures flagged`
          : "No failures flagged",
      state: operations.providerImportFailures > 0 ? "failure" : "quiet",
      lastCheck: "Current snapshot",
      evidence: `${operations.providerImportFailures.toLocaleString("en-GB")} failures`,
      impact:
        operations.providerImportFailures > 0
          ? "Treat recent provider data as lower confidence until resolved."
          : "No provider failure rows are currently recorded.",
      href: "/providers?tab=diagnostics#provider-jobs",
      action: "Open failures",
    },
    {
      id: "billing-failures",
      label: "Billing failure register",
      detail: "Subscription rows that may affect access or support.",
      area: "Billing",
      status:
        operations.billingFailures > 0
          ? `${operations.billingFailures.toLocaleString("en-GB")} failures flagged`
          : "No failures flagged",
      state: operations.billingFailures > 0 ? "failure" : "quiet",
      lastCheck: "Current snapshot",
      evidence: `${operations.billingFailures.toLocaleString("en-GB")} failures`,
      impact:
        operations.billingFailures > 0
          ? "Inspect subscriptions before escalating access issues."
          : "No failed billing rows are currently recorded.",
      href: "/admin/billing",
      action: "Inspect billing",
    },
    ...unverifiedSystemRows(operations),
  ];
}

function importHealthState(
  operations: Awaited<ReturnType<typeof getAdminOperationsSnapshot>>,
): Pick<HealthSummaryRow, "status" | "state" | "verified"> {
  if (operations.providerImportFailures > 0) {
    return {
      status: `${operations.providerImportFailures.toLocaleString("en-GB")} failures flagged`,
      state: "failure",
      verified: true,
    };
  }

  if (operations.importJobs > 0) {
    return { status: "No failures flagged", state: "quiet", verified: true };
  }

  return { status: "Unverified", state: "unverified", verified: false };
}

function unverifiedSystemRows(
  operations: Awaited<ReturnType<typeof getAdminOperationsSnapshot>>,
): SystemCheckTableRow[] {
  return [
    {
      id: "auth-live-check",
      label: "Authentication availability",
      detail: "Live sign-in, provider enablement, and session checks.",
      area: "Auth",
      status: "No live verification result",
      state: "unverified",
      lastCheck: "Not checked",
      evidence: "--",
      impact: "Authentication availability is unknown from this snapshot.",
    },
    {
      id: "rls-live-check",
      label: "RLS policy enforcement",
      detail: "Database persona and access-policy verification.",
      area: "RLS",
      status: "No live verification result",
      state: "unverified",
      lastCheck: "Not checked",
      evidence: "--",
      impact: "Use current database-check evidence before changing access controls.",
    },
    {
      id: "ai-live-check",
      label: "AI service availability",
      detail: "Live model response and evidence-quality verification.",
      area: "AI",
      status: "No live verification result",
      state: "unverified",
      lastCheck: "Stored rows only",
      evidence: `${operations.aiSummaries.toLocaleString("en-GB")} summaries`,
      impact: "Stored summaries do not prove current model availability or output quality.",
      href: "/data-chat",
      action: "Inspect evidence",
    },
    {
      id: "storage-live-check",
      label: "Storage availability",
      detail: "Upload, download, object access, and capacity verification.",
      area: "Storage",
      status: "No live verification result",
      state: "unverified",
      lastCheck: "Not checked",
      evidence: "--",
      impact: "Storage reachability and object access are unknown.",
    },
    {
      id: "external-live-check",
      label: "External connection reachability",
      detail: "Third-party network reachability and credential verification.",
      area: "External connections",
      status: "No live verification result",
      state: "unverified",
      lastCheck: "Not checked",
      evidence: "--",
      impact: "No third-party connection was actively probed by this snapshot.",
      href: "/providers?tab=diagnostics#provider-health",
      action: "Provider console",
    },
  ];
}
