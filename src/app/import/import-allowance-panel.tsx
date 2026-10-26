"use client";
import { billingPlans } from "@/lib/billing-plan-catalog";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { getImportUpgradeState, type ImportUpgradeState } from "./import-upgrade-actions";
import { ProTrialCard } from "@/app/billing/pro-trial-card";
import { recordProductImpression } from "@/app/product-events";

export function useImportAllowance() {
  const [state, setState] = useState<ImportUpgradeState | null>(null);
  const [error, setError] = useState(false);
  async function refresh() {
    try {
      setState(await getImportUpgradeState());
      setError(false);
    } catch {
      setError(true);
    }
  }
  useEffect(() => {
    let active = true;
    void getImportUpgradeState()
      .then((s) => {
        if (active) setState(s);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, []);
  return { state, error, refresh };
}
export function ImportAllowancePanel({
  state,
  error = false,
}: {
  state: ImportUpgradeState | null;
  error?: boolean;
}) {
  const tracked = useRef("");
  useEffect(() => {
    if (!state) return;
    const event =
      state.limit !== null && state.used >= 5
        ? "import_limit_reached"
        : state.limit !== null && state.used === 4
          ? "import_limit_warning_shown"
          : "";
    const key = `${event}:${state.resetsAt}`;
    if (event && tracked.current !== key) {
      tracked.current = key;
      void recordProductImpression(event, "import").catch(() => {});
    }
  }, [state]);
  if (!state)
    return error ? (
      <p role="status">
        Import allowance could not be loaded. Retry this page; your saved sessions remain available.
      </p>
    ) : (
      <p role="status">Checking import allowance…</p>
    );
  const reset = new Date(state.resetsAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
  return (
    <section className="grid gap-3 rounded-xl border p-4" aria-label="Import allowance">
      {state.limit !== null ? (
        <p role="status">
          {state.used} of {state.limit} imports used this month · {state.remaining} remaining.
          Resets {reset} (UTC).
        </p>
      ) : (
        <p>Unlimited imports on your plan.</p>
      )}
      {state.limit !== null && state.used === 4 ? (
        <p>You have one Free import left this month. Plus gives you unlimited imports.</p>
      ) : null}
      {!state.allowed ? (
        <>
          <h2 className="text-lg font-semibold">Pause here — your evidence is safe</h2>
          <p>
            You’ve used this month’s 5 free imports. Your sessions and this draft are safe. Upgrade
            or return after {reset} (UTC) to save another import.
          </p>
          <Link
            className="font-semibold underline"
            href="/billing?required=plus&feature=unlimited_imports"
            onClick={() => {
              void recordProductImpression("import_upgrade_cta_clicked", "plus").catch(() => {});
            }}
          >
            Upgrade to Plus — unlimited imports
          </Link>
          <PlusBenefits />
          <Link href="/import#import-library">Open import history</Link>
        </>
      ) : null}
      <p className="text-sm text-muted-foreground">
        {state.savedSessions} sessions imported this month · {state.stockClubs} clubs with stock
        distances
        {state.lastImportAt
          ? ` · last import ${new Date(state.lastImportAt).toLocaleDateString("en-GB")}`
          : ""}
      </p>
      {state.trialEligible ? <ProTrialCard /> : null}
    </section>
  );
}
export function ImportAllowanceSummary() {
  const allowance = useImportAllowance();
  return <ImportAllowancePanel state={allowance.state} error={allowance.error} />;
}

export function ImportLimitNotice({
  details,
}: {
  details: import("@/lib/imports/import-usage").ImportLimitDetails;
}) {
  return (
    <section role="status" className="rounded-xl border p-4">
      <h2 className="font-semibold">Pause here — your evidence is safe</h2>
      <p>
        {details.used} of {details.limit} imports used. Resets{" "}
        {new Date(details.resetsAt).toLocaleDateString("en-GB", { timeZone: "UTC" })} (UTC). Your
        files and mapping stay here.
      </p>
      <Link className="underline" href={details.upgrade.plus}>
        Upgrade to Plus — unlimited imports
      </Link>
      <p>
        <Link href="/import#import-library">Open import history</Link>
      </p>
      <PlusBenefits />
      {details.upgrade.trialEligible ? <ProTrialCard /> : null}
    </section>
  );
}

function PlusBenefits() {
  const features = billingPlans.find((plan) => plan.key === "plus")!.features;
  return (
    <div>
      <h3 className="font-semibold">Why upgrade</h3>
      <ul className="list-disc pl-5 text-sm">
        {features
          .filter((feature) =>
            /Unlimited imports|Detailed club analytics|Portrait share-card/.test(feature),
          )
          .map((feature) => (
            <li key={feature}>{feature}</li>
          ))}
      </ul>
    </div>
  );
}
