import { AdminNav, formatDateTime, label } from "@/app/admin/admin-components";
import { AdminLifetimeGrant } from "@/app/admin/admin-lifetime-grant";
import { AdminBillingLedger } from "@/app/admin/admin-billing-ledger";
import { PageHeader, PageShell } from "@/components/premium";
import { getAdminBillingData, requireAdminUser } from "@/lib/admin";
export const dynamic = "force-dynamic";
export default async function AdminBillingPage({
  searchParams,
}: {
  searchParams?: Promise<{ sort?: string; dir?: string }>;
}) {
  const params = await searchParams;
  const [actor, data] = await Promise.all([requireAdminUser(), getAdminBillingData()]);
  const active = data.subscriptions.filter((row) =>
    ["active", "trialing"].includes(row.status),
  ).length;
  const full = data.entitlements.filter(
    (row) => row.entitlementKey === "lifetime_full" && row.valueJson.value === true,
  ).length;
  const limits = data.planLimits.filter((row) => row.planKey === "full");
  return (
    <PageShell>
      <div className="grid min-w-0 gap-5 pb-28">
        <AdminNav active="/admin/billing" />
        <PageHeader
          title="Billing and entitlements"
          description="Inspect saved subscription states and app access independently. This overview does not check live provider availability."
        />
        <p className="text-sm text-muted-foreground">
          Database snapshot: {formatDateTime(new Date())}. Counts below describe the loaded records.
        </p>
        <dl className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Loaded subscriptions", data.subscriptions.length],
            ["Active / trialing in loaded list", active],
            ["Lifetime grants in loaded entitlements", full],
            ["Configured plan limits", data.planLimits.length],
          ].map(([key, value]) => (
            <div key={key}>
              <dt className="text-sm text-muted-foreground">{key}</dt>
              <dd className="text-2xl font-semibold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
        {actor.role === "owner" ? (
          <AdminLifetimeGrant />
        ) : (
          <p className="rounded-xl border p-4">
            Only an owner can grant lifetime access. Account and billing records remain available
            for review.
          </p>
        )}
        <section className="grid gap-3">
          <h2 className="text-xl font-semibold">Configured Full limits</h2>
          <dl className="grid gap-3 sm:grid-cols-2">
            {limits.map((row) => (
              <div key={row.id} className="rounded-xl border p-4">
                <dt className="font-medium">{label(row.limitKey)}</dt>
                <dd className="mt-2 whitespace-pre-wrap break-all text-sm">
                  {JSON.stringify(row.limitValueJson, null, 2)}
                </dd>
              </div>
            ))}
          </dl>
          {!limits.length ? (
            <p>
              No Full plan limit rows are configured in this snapshot. No allowance is inferred from
              missing data.
            </p>
          ) : null}
        </section>
        <AdminBillingLedger
          scope="admin-billing-subscriptions"
          title="Subscriptions"
          description="Latest 80 subscription records at most. Saved provider status does not by itself describe the account’s current app entitlements."
          initialSort={params?.sort}
          initialDir={params?.dir}
          rows={data.subscriptions.map((row) => ({
            id: row.id,
            title: row.displayName,
            email: row.email,
            userId: row.userId,
            date: row.createdAt.toISOString().slice(0, 10),
            summary: `${row.planKey} · ${row.status}`,
            fields: {
              Plan: row.planKey,
              Status: row.status,
              "Period end": row.currentPeriodEnd?.toISOString() ?? "Not recorded",
              Cancellation: row.cancelAtPeriodEnd
                ? "Scheduled at period end"
                : row.status === "canceled"
                  ? "Already cancelled"
                  : "No cancellation scheduled",
              Created: formatDateTime(row.createdAt),
            },
          }))}
        />
        <AdminBillingLedger
          scope="admin-billing-entitlements"
          title="Current entitlements"
          description="Latest 120 current entitlement rows at most. Updated dates describe these saved records; they do not prove a grant, change or revocation event."
          rows={data.entitlements.map((row) => ({
            id: row.id,
            title: row.displayName,
            email: row.email,
            userId: row.userId,
            date: row.updatedAt.toISOString().slice(0, 10),
            summary: `${label(row.entitlementKey)} · ${row.source}`,
            fields: {
              Entitlement: row.entitlementKey,
              Source: row.source,
              Value: JSON.stringify(row.valueJson, null, 2),
              Expiry: row.expiresAt?.toISOString() ?? "No expiry recorded",
              Updated: formatDateTime(row.updatedAt),
            },
          }))}
        />
        <section className="grid gap-3">
          <h2 className="text-xl font-semibold">Recorded lifetime grant decisions</h2>
          <p className="text-sm text-muted-foreground">
            Latest {data.auditRows.length} recorded lifetime grants, up to 80. Provider changes and
            unrecorded revocations are not reconstructed here.
          </p>
          <ol className="grid gap-3">
            {data.auditRows.map((row) => (
              <li key={row.id}>
                <details className="rounded-xl border p-4">
                  <summary className="min-h-11 cursor-pointer">
                    <span className="font-medium">Lifetime Full granted</span>
                    <span className="mt-1 block text-xs">
                      {formatDateTime(row.createdAt)} ·{" "}
                      {row.actorEmail ?? row.actorUserId ?? "Unknown actor"}
                    </span>
                  </summary>
                  <dl className="mt-3 grid gap-3 text-sm">
                    {Object.entries({
                      Actor: row.actorEmail ?? row.actorUserId ?? "Not recorded",
                      Action: row.action,
                      "Target type": row.targetType ?? "Not recorded",
                      Target: row.targetId ?? "Not recorded",
                      Outcome:
                        typeof row.metadataJson.outcome === "string"
                          ? row.metadataJson.outcome
                          : "Grant recorded; no separate outcome field",
                      Metadata: JSON.stringify(row.metadataJson, null, 2),
                    }).map(([key, value]) => (
                      <div key={key}>
                        <dt className="text-muted-foreground">{key}</dt>
                        <dd className="whitespace-pre-wrap break-all">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </details>
              </li>
            ))}
          </ol>
          {!data.auditRows.length ? (
            <p>No lifetime grant decisions are recorded in this audit source.</p>
          ) : null}
        </section>
      </div>
    </PageShell>
  );
}
