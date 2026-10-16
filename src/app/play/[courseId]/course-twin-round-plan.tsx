"use client";
import { canUseFullRoundPlan } from "./round-plan-actions";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { CourseTwinManifest } from "@/lib/course-twin-contract";
import type { MobilePlanIntent } from "@/lib/course-twin-mobile-plan";
import type { RoundPlanHole } from "@/lib/course-twin-round-plan-model";
import { Button } from "@/components/ui/button";
import { ProTrialCard } from "@/app/billing/pro-trial-card";
import { recordProductImpression } from "@/app/product-events";
import { CourseTwinMobilePlan } from "./course-twin-mobile-plan";

type SavedPlan = {
  intent: MobilePlanIntent;
  holesJson: RoundPlanHole[];
  createdAt: string;
  manifestPackageVersion: number;
};
export function CourseTwinRoundPlan({
  manifest,
  pro,
  trialEligible,
  persistenceAvailable,
}: {
  manifest: CourseTwinManifest;
  pro: boolean;
  trialEligible: boolean;
  persistenceAvailable: boolean;
}) {
  const [canPlan, setCanPlan] = useState(pro);
  const [holeNumber, setHole] = useState(1);
  const [intent, setIntent] = useState<MobilePlanIntent>("normal");
  const [saved, setSaved] = useState<SavedPlan | null>(null);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [paywall, setPaywall] = useState(false);
  const hole = manifest.holes.find((h) => h.holeNumber === holeNumber);
  const endpoint = `/api/course-twins/${encodeURIComponent(manifest.course.id)}/round-plan`;
  useEffect(() => {
    void recordProductImpression("course_twin_plan_opened", manifest.course.id).catch(() => {});
  }, [manifest.course.id]);
  useEffect(() => {
    void recordProductImpression(
      "course_twin_plan_hole_viewed",
      `${manifest.course.id}:${holeNumber}`,
    ).catch(() => {});
  }, [manifest.course.id, holeNumber]);
  useEffect(() => {
    if (!canPlan || !persistenceAvailable) return;
    const controller = new AbortController();
    void fetch(endpoint, { cache: "no-store", signal: controller.signal })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error);
        if (data.plan) {
          setSaved(data.plan);
          setIntent(data.plan.intent);
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setMessage(e.message ?? "Saved plan unavailable.");
      });
    return () => controller.abort();
  }, [canPlan, endpoint, persistenceAvailable]);
  async function save() {
    setPending(true);
    setMessage("");
    try {
      const r = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setSaved(data.plan);
      setMessage("Round plan saved. Reopen this course before tee-off.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not save. Try again.");
    } finally {
      setPending(false);
    }
  }
  async function next() {
    const entitled = canPlan || (await canUseFullRoundPlan().catch(() => false));
    if (entitled) setCanPlan(true);
    if (!entitled) {
      setPaywall(true);
      void recordProductImpression("course_twin_plan_upgrade_shown", manifest.course.id).catch(
        () => {},
      );
    } else setHole((n) => Math.min(18, n + 1));
  }
  function exportPlan() {
    if (!saved) return;
    const lines = [
      `${manifest.course.name} — Round plan`,
      `Saved ${saved.createdAt}; package ${saved.manifestPackageVersion}; latest reliable bag`,
      ...saved.holesJson.map(
        (h) =>
          `Hole ${h.holeNumber}: ${h.status === "ready" ? `${h.clubType} ${h.carryMedianYd}y carry; modelled hazard ~${Math.round((h.hazardChance ?? 0) * 100)}%; ${h.intent}` : h.reason}. ${h.disclosure}`,
      ),
    ];
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "round-plan.txt";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <main id="main-content" className="grid w-full gap-4 p-4 pb-28">
      <header>
        <Link href={`/play/${manifest.course.id}`}>Back to Course Twin</Link>
        <h1 className="mt-3 text-3xl font-semibold">Round plan</h1>
        <p>{manifest.course.name} · evidence: latest reliable bag</p>
        <p className="text-sm text-muted-foreground">
          Options compare your simulated landings. They are not guaranteed on-course results.
        </p>
      </header>
      <div role="group" aria-label="Round plan intent" className="flex flex-wrap gap-2">
        {(["safe", "normal", "aggressive"] as const).map((value) => (
          <Button
            key={value}
            variant={intent === value ? "default" : "outline"}
            aria-pressed={intent === value}
            onClick={() => setIntent(value)}
          >
            {value[0].toUpperCase() + value.slice(1)}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" disabled={holeNumber === 1} onClick={() => setHole((n) => n - 1)}>
          Previous hole
        </Button>
        <span aria-live="polite">Hole {holeNumber} of 18</span>
        <Button variant="outline" disabled={holeNumber === 18} onClick={next}>
          Next hole
        </Button>
        <Link href="/bag">Bag confidence</Link>
        {canPlan ? (
          <>
            <Button onClick={save} disabled={pending || !persistenceAvailable}>
              {pending ? "Saving…" : "Save plan"}
            </Button>
            <Button variant="outline" onClick={exportPlan} disabled={!saved}>
              Export saved plan
            </Button>
          </>
        ) : null}
      </div>
      {canPlan && !persistenceAvailable ? (
        <p role="status">
          Saving round plans is temporarily unavailable. You can still use your measured plan.
        </p>
      ) : null}
      {message ? <p role="status">{message}</p> : null}
      {saved ? (
        <p className="text-sm text-muted-foreground">
          Saved {new Date(saved.createdAt).toLocaleDateString("en-GB")}. Current cards use your
          latest evidence. Export retains your saved snapshot
          {saved.manifestPackageVersion !== manifest.packageVersion
            ? "; the course package has changed since this save"
            : ""}
          .
        </p>
      ) : null}
      {saved?.holesJson[holeNumber - 1] ? (
        <section className="rounded-xl border p-4" aria-label="Saved hole plan">
          <h2 className="font-semibold">Saved plan · Hole {holeNumber}</h2>
          <p>
            {saved.holesJson[holeNumber - 1].status === "ready"
              ? `${saved.holesJson[holeNumber - 1].clubType} · ${Math.round(saved.holesJson[holeNumber - 1].carryMedianYd!)}y carry · ${saved.holesJson[holeNumber - 1].intent} · modelled hazard chance ~${Math.round((saved.holesJson[holeNumber - 1].hazardChance ?? 0) * 100)}%`
              : saved.holesJson[holeNumber - 1].reason}
          </p>
          <p className="text-sm text-muted-foreground">
            {saved.holesJson[holeNumber - 1].disclosure}
          </p>
        </section>
      ) : null}
      {paywall ? (
        <section className="rounded-xl border p-4">
          <h2 className="text-xl font-semibold">Hole 1 unlocked. Full 18 is Pro.</h2>
          <p className="my-2">
            You’ve seen how your bag maps to this hole. Pro unlocks the rest of the round plan, AI
            coach, and Data Chat.
          </p>
          {trialEligible ? <ProTrialCard /> : null}
          <Link href="/billing?required=pro&feature=course_twin_round_plan">Compare plans</Link>
          <Button variant="ghost" onClick={() => setPaywall(false)}>
            Back to Hole 1
          </Button>
        </section>
      ) : hole ? (
        <CourseTwinMobilePlan
          key={holeNumber}
          manifest={manifest}
          hole={hole}
          allowCustomClub={false}
          selectedIntent={intent}
          onIntentChange={setIntent}
        />
      ) : (
        <p role="status">
          Hole geometry unavailable. No club recommendation can be modelled for this hole.
        </p>
      )}
    </main>
  );
}
