"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { DraftForm } from "@/components/untitled-ui/draft-form";
import { Input } from "@/components/ui/input";
import { saveGoalProjectWithStateAction } from "./actions";
import type { GoalImprovementProjectData } from "@/lib/goal-improvement-project";
const stages = {
  choose_baseline: "Choose a baseline",
  choose_practice: "Choose practice",
  practise: "Complete the selected practice",
  awaiting_evidence: "Record subsequent measurements",
  review_ready: "Review measured change",
};
export function GoalProjectPanel({ data }: { data: GoalImprovementProjectData }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  return (
    <section
      className="grid min-w-0 gap-4 rounded-xl border p-4"
      aria-label="Goal improvement projects"
    >
      <h2 className="text-xl font-semibold">Connect practice to each goal</h2>
      <p className="text-sm text-muted-foreground">
        Choose a dated baseline and saved practice. Completion records activity; qualifying later
        measurements provide the comparison. Saved goal values are not overwritten.
      </p>
      {!data.projects.length && <p>Add a goal above to connect its evidence.</p>}
      {data.projects.map((project) => (
        <article key={project.goalId} className="grid min-w-0 gap-3 rounded-lg border p-4">
          <h3 className="break-words text-lg font-semibold">{project.title}</h3>
          <p className="text-sm font-medium">
            Next: {stages[project.status as keyof typeof stages]}
          </p>
          <ol className="grid gap-2 text-sm">
            <li>
              1. Baseline:{" "}
              {project.baseline ? (
                <a href={project.baseline.href} className="underline">
                  {project.baseline.label} · {project.baseline.date.slice(0, 10)} ·{" "}
                  {project.baseline.eligibleMeasuredShots} eligible measured shots
                </a>
              ) : (
                "Not selected"
              )}
            </li>
            <li>2. Practice: {project.plans.length} linked saved plans</li>
            <li>
              3. Evidence: {project.plans.reduce((n, p) => n + p.evidence.length, 0)} qualifying
              linked records · review below
            </li>
          </ol>
          {project.missingBaseline && (
            <p role="status">
              The saved baseline is no longer available. Choose another owned session.
            </p>
          )}
          {project.unavailablePlanCount > 0 && (
            <p>{project.unavailablePlanCount} saved plan references are unavailable.</p>
          )}
          <details>
            <summary className="min-h-11 cursor-pointer py-3 font-medium">
              Edit baseline and practice links
            </summary>
            <DraftForm
              action={saveGoalProjectWithStateAction}
              submitLabel="Save project links"
              onSuccess={() => router.refresh()}
              gridClassName="grid gap-4"
            >
              <input type="hidden" name="goalId" value={project.goalId} />
              <label className="grid gap-2 text-sm">
                Baseline session
                <select
                  name="baselineSessionId"
                  defaultValue={project.baseline?.id ?? ""}
                  className="min-h-11 w-full min-w-0 rounded-lg border bg-background px-3"
                >
                  <option value="">No baseline selected</option>
                  {data.sessionOptions.map((session) => (
                    <option key={session.id} value={session.id}>
                      {session.date.slice(0, 10)} · {session.label} ·{" "}
                      {session.eligibleMeasuredShots} eligible
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-xs text-muted-foreground">
                Latest 100 sessions plus saved references. A baseline with no eligible measurements
                cannot support measured comparison.
              </p>
              <label className="grid gap-2 text-sm">
                Find saved practice
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search plan titles"
                />
              </label>
              <fieldset className="max-h-72 overflow-y-auto rounded-lg border p-3">
                <legend className="px-2 text-sm">Saved practice plans</legend>
                {data.practiceOptions.map((plan) => (
                  <label
                    key={plan.id}
                    hidden={!plan.title.toLowerCase().includes(query.toLowerCase())}
                    className="min-h-12 items-center gap-3 py-2 text-sm"
                    style={{
                      display: plan.title.toLowerCase().includes(query.toLowerCase())
                        ? "flex"
                        : "none",
                    }}
                  >
                    <input
                      type="checkbox"
                      name="practicePlanId"
                      value={plan.id}
                      defaultChecked={project.practicePlanIds.includes(plan.id)}
                      className="size-5 shrink-0"
                    />
                    <span>
                      {plan.title} · {plan.status} · {plan.plannedAt.slice(0, 10)}
                    </span>
                  </label>
                ))}
                {!data.practiceOptions.length && <p>No saved practice plans yet.</p>}
              </fieldset>
            </DraftForm>
          </details>
          <a
            href={project.practiceFromBaselineHref}
            className="inline-flex min-h-11 items-center font-medium text-primary underline"
          >
            Plan practice for this goal
          </a>
          {project.plans.map((plan) => (
            <details key={plan.id} className="rounded-lg border p-3">
              <summary className="min-h-11 cursor-pointer font-medium">
                {plan.title} · {plan.status}
              </summary>
              <p className="text-sm">
                Planned {plan.plannedAt.slice(0, 10)} ·{" "}
                {plan.completedAt
                  ? `Completed ${plan.completedAt.slice(0, 10)}`
                  : "Completion not recorded"}
              </p>
              <ol className="grid gap-3 py-3">
                {plan.drills.map((drill) => (
                  <li key={drill.id} className="text-sm">
                    <strong>{drill.title}</strong>
                    <p>{drill.drill}</p>
                    <p>
                      Clubs: {drill.clubs.join(", ")} · Target: {drill.successCriteria}
                    </p>
                  </li>
                ))}
              </ol>
              <div className="flex flex-wrap gap-4">
                <a href={plan.href} className="min-h-11 text-primary underline">
                  Open practice
                </a>
                <a href={plan.importHref} className="min-h-11 text-primary underline">
                  Record practice evidence
                </a>
              </div>
              {plan.review && (
                <p className="text-sm">
                  Saved review: {plan.review.verdict} · {plan.review.nextAction}
                </p>
              )}
              {!plan.evidence.length && (
                <p className="text-sm">
                  {plan.evidenceNeedsReview
                    ? "Linked records need review before they qualify."
                    : "No qualifying subsequent measured evidence yet."}
                </p>
              )}
              {plan.evidence.map((evidence) => (
                <div key={evidence.id} className="grid gap-2 border-t py-3 text-sm">
                  <a href={evidence.href} className="underline">
                    {evidence.label} · {evidence.date.slice(0, 10)} · {evidence.source} ·{" "}
                    {evidence.eligibleMeasuredShots} eligible shots
                  </a>
                  {evidence.compareHref ? (
                    <a href={evidence.compareHref} className="min-h-11 text-primary underline">
                      Compare with this goal’s baseline
                    </a>
                  ) : (
                    <p>Baseline needs eligible measurements before comparison.</p>
                  )}
                </div>
              ))}
            </details>
          ))}
        </article>
      ))}
    </section>
  );
}
