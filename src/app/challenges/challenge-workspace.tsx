"use client";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { useRouter, unstable_rethrow } from "next/navigation";
import type { ChallengeListItem } from "@/lib/challenges";
import { createChallengeAction, joinChallengeAction } from "@/app/challenges/actions";
import { UntitledTabs } from "@/components/untitled-ui/tabs";
import { ResponsiveDetailPanel } from "@/components/app/responsive-detail-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useClientReady } from "@/hooks/use-client-ready";
type Template = {
  id: string;
  name: string;
  description: string;
  scoringDirection: string;
  rulesJson: Record<string, unknown>;
};
const date = (value: Date | string | null) =>
  value
    ? new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(value))
    : "Open ended";
function finished(c: ChallengeListItem) {
  return (
    ["completed", "closed", "expired", "cancelled"].includes(c.status) ||
    Boolean(c.endsAt && new Date(c.endsAt).getTime() <= Date.now())
  );
}
export function ChallengeWorkspace({
  challenges,
  templates,
  freePlan,
  initialTab,
  initialQuery,
}: {
  challenges: ChallengeListItem[];
  templates: Template[];
  freePlan: boolean;
  initialTab: string;
  initialQuery: string;
}) {
  const router = useRouter();
  const ready = useClientReady();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState(initialQuery);
  const [rules, setRules] = useState<ChallengeListItem | null>(null);
  const rulesTrigger = useRef<HTMLButtonElement | null>(null);
  const closeRules = () => {
    setRules(null);
    setTimeout(() => rulesTrigger.current?.focus(), 0);
  };
  const active = ["active", "available", "completed", "closed"].includes(initialTab)
    ? initialTab
    : "active";
  const [previousQuery, setPreviousQuery] = useState(initialQuery);
  if (previousQuery !== initialQuery) {
    setPreviousQuery(initialQuery);
    setQuery(initialQuery);
  }
  const groups = {
    active: challenges.filter((c) => c.viewerJoined && !finished(c)),
    available: challenges.filter((c) => !c.viewerJoined && c.status === "open" && !finished(c)),
    closed: challenges.filter((c) => !c.viewerJoined && (c.status !== "open" || finished(c))),
    completed: challenges
      .filter((c) => c.viewerJoined && finished(c))
      .sort(
        (a, b) =>
          new Date(b.endsAt ?? b.startsAt).getTime() - new Date(a.endsAt ?? a.startsAt).getTime(),
      ),
  };
  const navigate = (tab: string, q = query) =>
    startTransition(() => {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", tab);
      if (q) url.searchParams.set("q", q);
      else url.searchParams.delete("q");
      router.push(url.pathname + url.search, { scroll: false });
    });
  return (
    <section className="grid min-w-0 gap-4" data-challenge-workspace>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <form
          className="flex min-w-0 flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            navigate(active);
          }}
        >
          <label className="grid gap-1 text-sm font-medium">
            Search challenges
            <Input
              aria-label="Search challenges"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="min-h-11"
            />
          </label>
          <Button type="submit" disabled={!ready || pending} className="min-h-11">
            Search
          </Button>
          {query ? (
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => {
                setQuery("");
                navigate(active, "");
              }}
            >
              Clear search
            </Button>
          ) : null}
        </form>
        <CreateChallenge templates={templates} freePlan={freePlan} />
      </div>
      <p className="text-sm text-muted-foreground">
        Loaded {challenges.length} challenges (latest 80 maximum). Swipe the status strip for more
        views. Joining alone does not count as qualifying evidence.
      </p>
      <UntitledTabs
        label="Challenge status"
        selectedKey={active}
        disabled={!ready || pending}
        onSelectionChange={(key) => navigate(key)}
        items={Object.entries(groups).map(([key, items]) => ({
          id: key,
          label: `${key === "closed" ? "Closed to entry" : key[0].toUpperCase() + key.slice(1)} (${items.length})`,
          content:
            key === active ? (
              <div className="grid gap-3">
                {items.filter((c) =>
                  `${c.title} ${c.templateName}`.toLowerCase().includes(initialQuery.toLowerCase()),
                ).length ? (
                  items
                    .filter((c) =>
                      `${c.title} ${c.templateName}`
                        .toLowerCase()
                        .includes(initialQuery.toLowerCase()),
                    )
                    .map((c, i) => (
                      <article
                        key={c.id}
                        className="grid min-w-0 gap-3 rounded-xl border bg-card p-4"
                        data-challenge-row
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm text-muted-foreground">
                              {key === "active" && i === 0 ? "Current challenge · " : ""}
                              {c.templateName} · {finished(c) ? "Ended" : c.status}
                            </p>
                            <h2 className="break-words text-lg font-semibold">{c.title}</h2>
                          </div>
                          <Button
                            variant="outline"
                            disabled={!ready}
                            className="min-h-11"
                            onClick={(event) => {
                              rulesTrigger.current = event.currentTarget;
                              setRules(c);
                            }}
                          >
                            Rules
                          </Button>
                        </div>
                        <p className="break-words text-sm">{c.description ?? c.rulesSummary}</p>
                        <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                          <Fact
                            label="Evidence"
                            value={`${c.viewerEvidenceCount} / ${c.evidenceTargetCount} qualifying shots`}
                          />
                          <Fact
                            label={
                              finished(c)
                                ? "Recorded result after close"
                                : "Current qualifying result"
                            }
                            value={c.viewerScoreLabel ?? "No qualifying result"}
                          />
                          <Fact
                            label={finished(c) ? "Recorded rank" : "Provisional rank"}
                            value={c.viewerRank ? `#${c.viewerRank}` : "Not ranked"}
                          />
                          <Fact
                            label="Proof"
                            value={c.viewerVerificationLabel ?? c.evidenceRequirement}
                          />
                          <Fact
                            label="Window (UTC)"
                            value={`${date(c.startsAt)} — ${date(c.endsAt)}`}
                          />
                          <Fact
                            label="Target to beat"
                            value={
                              c.leader
                                ? `${c.leader.scoreLabel} · ${c.leader.displayName}`
                                : "Set the first qualifying result"
                            }
                          />
                          <Fact label="Visibility" value={c.visibility} />
                          <Fact
                            label="Scoring"
                            value={`${c.scoringDirection === "asc" ? "Lower" : "Higher"} qualifying result wins`}
                          />
                          <Fact label="Field" value={`${c.participantCount} players`} />
                        </dl>
                        {key === "active" ? (
                          <div>
                            <label className="text-sm" htmlFor={`evidence-${c.id}`}>
                              Qualifying evidence collected
                            </label>
                            <progress
                              id={`evidence-${c.id}`}
                              className="block h-3 w-full"
                              max={Math.max(1, c.evidenceTargetCount)}
                              value={Math.min(
                                Math.max(1, c.evidenceTargetCount),
                                c.viewerEvidenceCount,
                              )}
                            />
                          </div>
                        ) : null}
                        <div className="flex flex-wrap gap-2">
                          {key === "available" || key === "closed" ? (
                            <JoinChallenge challenge={c} />
                          ) : key === "active" ? (
                            <Button asChild className="min-h-11">
                              <Link href={`/import?challengeId=${c.id}`}>
                                Import qualifying evidence
                              </Link>
                            </Button>
                          ) : null}
                          <Button asChild variant="outline" className="min-h-11">
                            <Link href={`/challenges/${c.id}`}>
                              {finished(c)
                                ? "View recorded results and evidence"
                                : "View attempts and evidence"}
                            </Link>
                          </Button>
                        </div>
                      </article>
                    ))
                ) : (
                  <p role="status" className="rounded-xl border p-5">
                    No {key} challenges match this view.{" "}
                    {initialQuery
                      ? "Clear the search to see all loaded challenges."
                      : "Choose another status or create a challenge."}
                  </p>
                )}
              </div>
            ) : null,
        }))}
      />
      {pending ? <p role="status">Loading challenge view…</p> : null}
      <ResponsiveDetailPanel
        open={!!rules}
        onOpenChange={(open) => {
          if (!open) closeRules();
        }}
        title={rules?.title ?? "Challenge rules"}
        description={rules?.rulesSummary}
        footer={
          <Button className="min-h-11" onClick={closeRules}>
            Close rules
          </Button>
        }
      >
        {rules ? (
          <div className="grid gap-4">
            <dl className="grid gap-3 text-sm">
              <Fact
                label="Scoring"
                value={`${rules.scoringDirection === "asc" ? "Lower" : "Higher"} qualifying result wins`}
              />
              <Fact label="Evidence" value={rules.evidenceRequirement} />
              <Fact
                label="Window (UTC)"
                value={`${date(rules.startsAt)} — ${date(rules.endsAt)}`}
              />
              <Fact label="Visibility" value={rules.visibility} />
            </dl>
            <ol className="list-decimal space-y-3 pl-5">
              {rules.rulesBullets.map((rule, i) => (
                <li key={i}>{rule}</li>
              ))}
            </ol>
            <p className="text-sm">
              Only evidence meeting these rules counts. A joined entry is not a completed result.
            </p>
          </div>
        ) : null}
      </ResponsiveDetailPanel>
    </section>
  );
}
function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="break-words font-medium">{value}</dd>
    </div>
  );
}
function JoinChallenge({ challenge }: { challenge: ChallengeListItem }) {
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const ready = useClientReady();
  const unavailable = finished(challenge) || challenge.status !== "open";
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        setError("");
        start(async () => {
          try {
            await joinChallengeAction(data);
          } catch (error) {
            unstable_rethrow(error);
            setError(error instanceof Error ? error.message : "Could not join. Try again.");
          }
        });
      }}
    >
      <input type="hidden" name="challengeId" value={challenge.id} />
      <Button disabled={unavailable || pending || !ready} className="min-h-11">
        {pending ? "Joining…" : unavailable ? "Joining unavailable" : "Join challenge"}
      </Button>
      {unavailable ? (
        <p className="mt-1 text-sm">
          This challenge is {finished(challenge) ? "ended" : challenge.status}; joining is closed.
        </p>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
    </form>
  );
}
function CreateChallenge({ templates, freePlan }: { templates: Template[]; freePlan: boolean }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const busy = useRef(false);
  const ready = useClientReady();
  const [draft, setDraft] = useState({
    templateId: templates[0]?.id ?? "",
    title: "",
    description: "",
    visibility: freePlan ? "public" : "friends",
    startsAt: "",
    endsAt: "",
  });
  const template = templates.find((t) => t.id === draft.templateId);
  const update = (key: keyof typeof draft, value: string) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setError("");
  };
  const advance = () => {
    if (!draft.templateId || !draft.title.trim()) {
      setError("Choose an objective and enter a challenge name.");
      return;
    }
    if (draft.endsAt && draft.endsAt <= (draft.startsAt || new Date().toISOString().slice(0, 10))) {
      setError("End date must be after the start date.");
      return;
    }
    setError("");
    setStep(1);
  };
  return (
    <ResponsiveDetailPanel
      open={open}
      onOpenChange={(value) => {
        if (!pending) setOpen(value);
      }}
      title="Create a challenge"
      description={
        step
          ? "Review objective, dates and privacy before saving."
          : "Set the objective and evidence window. Draft values stay here when you close."
      }
      trigger={
        <Button disabled={!ready} className="min-h-11">
          Create challenge
        </Button>
      }
      footer={
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={pending}
            className="min-h-11"
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          {step ? (
            <>
              <Button
                variant="outline"
                disabled={pending}
                className="min-h-11"
                onClick={() => setStep(0)}
              >
                Edit details
              </Button>
              <Button
                form="create-challenge-form"
                type="submit"
                disabled={pending}
                className="min-h-11"
              >
                {pending ? "Saving…" : "Create reviewed challenge"}
              </Button>
            </>
          ) : (
            <Button disabled={!templates.length} className="min-h-11" onClick={advance}>
              Review challenge
            </Button>
          )}
        </div>
      }
    >
      <form
        id="create-challenge-form"
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!step || busy.current) return;
          busy.current = true;
          setError("");
          const data = new FormData();
          Object.entries(draft).forEach(([k, v]) => data.set(k, v));
          start(async () => {
            try {
              await createChallengeAction(data);
            } catch (error) {
              unstable_rethrow(error);
              setError(
                error instanceof Error ? error.message : "Could not save. Your draft remains here.",
              );
            } finally {
              busy.current = false;
            }
          });
        }}
      >
        {!step ? (
          <fieldset disabled={pending} className="grid min-w-0 gap-4">
            <label className="grid gap-1 text-sm font-medium">
              Objective
              <select
                aria-label="Challenge objective"
                className="min-h-11 w-full rounded-md border bg-background px-2"
                value={draft.templateId}
                onChange={(e) => update("templateId", e.target.value)}
              >
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-sm">
              {template?.description ?? "No active objective templates available."}{" "}
              {template
                ? `${template.scoringDirection === "asc" ? "Lower" : "Higher"} qualifying result wins.`
                : ""}
            </p>
            <label className="grid gap-1 text-sm font-medium">
              Challenge name
              <Input
                value={draft.title}
                onChange={(e) => update("title", e.target.value)}
                maxLength={180}
                required
                className="min-h-11"
              />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Short note (optional)
              <Textarea
                value={draft.description}
                onChange={(e) => update("description", e.target.value)}
                rows={3}
              />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Who can join
              <select
                aria-label="Challenge visibility"
                className="min-h-11 w-full rounded-md border bg-background px-2"
                value={draft.visibility}
                onChange={(e) => update("visibility", e.target.value)}
              >
                {["public", "friends", "private"].map((v) => (
                  <option key={v} value={v} disabled={freePlan && v !== "public"}>
                    {v}
                    {freePlan && v !== "public" ? " (Plus required)" : ""}
                  </option>
                ))}
              </select>
            </label>
            {freePlan ? (
              <p className="text-sm">
                Public creation is available. Friend and private challenges require Plus or above.
              </p>
            ) : null}
            <label className="grid gap-1 text-sm font-medium">
              Starts (UTC)
              <Input
                type="date"
                value={draft.startsAt}
                onChange={(e) => update("startsAt", e.target.value)}
                className="min-h-11"
              />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Ends (UTC)
              <Input
                type="date"
                value={draft.endsAt}
                onChange={(e) => update("endsAt", e.target.value)}
                className="min-h-11"
              />
            </label>
          </fieldset>
        ) : (
          <dl className="grid gap-3 text-sm">
            <Fact label="Name" value={draft.title} />
            <Fact label="Objective" value={template?.name ?? "Unavailable"} />
            <Fact label="Scoring" value={template?.description ?? ""} />
            <Fact label="Note" value={draft.description || "None"} />
            <Fact label="Visibility" value={draft.visibility} />
            <Fact label="Starts" value={draft.startsAt || "When created"} />
            <Fact label="Ends" value={draft.endsAt || "30 days after creation"} />
          </dl>
        )}
        <p className="text-sm">
          Opening or reviewing this form sends no invitations. Scoring uses the selected objective’s
          existing rules.
        </p>
        {error ? (
          <p role="alert" className="rounded-lg border border-destructive p-3 text-sm">
            {error}
          </p>
        ) : null}
      </form>
    </ResponsiveDetailPanel>
  );
}
