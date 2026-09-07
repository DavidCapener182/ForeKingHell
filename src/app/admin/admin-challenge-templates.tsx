"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveAdminChallengeTemplateAction } from "@/app/admin/admin-challenge-template-actions";
import { ResponsiveDetailPanel } from "@/components/app/responsive-detail-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useClientReady } from "@/hooks/use-client-ready";
export type AdminTemplate = {
  id: string;
  slug: string;
  name: string;
  description: string;
  challengeType: string;
  rulesJson: Record<string, unknown>;
  scoringDirection: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  referenceCount?: number;
};
const kinds = [
  "longest_drive",
  "straightest_drive",
  "wedge_ladder",
  "wedge_window",
  "consistency",
  "closest_to_pin",
  "practice_streak",
];
export function AdminChallengeTemplates({ templates }: { templates: AdminTemplate[] }) {
  const ready = useClientReady();
  const [query, setQuery] = useState("");
  const [edit, setEdit] = useState<{ template: AdminTemplate | null; copy: boolean } | null>(null);
  const shown = templates.filter((t) =>
    `${t.name} ${t.slug} ${t.description} ${t.challengeType}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <section id="templates" className="grid min-w-0 gap-3" aria-label="Challenge templates">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Challenge templates</h2>
        <Button disabled={!ready} onClick={() => setEdit({ template: null, copy: false })}>
          Create template
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Template scoring changes are protected once a board uses them. Create a copy for a different
        scoring format. Visibility is chosen for each board.
      </p>
      <label className="grid gap-1 text-sm">
        Search templates
        <Input disabled={!ready} value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>
      <p role="status" className="text-sm">
        {shown.length} of {templates.length} templates
      </p>
      <div className="grid gap-3 xl:grid-cols-2">
        {shown.map((t) => (
          <article key={t.id} className="grid min-w-0 gap-3 rounded-xl border p-4">
            <h3 className="break-words font-semibold">{t.name}</h3>
            <p className="whitespace-pre-wrap break-words text-sm">{t.description}</p>
            <p className="text-sm">
              {t.challengeType.replaceAll("_", " ")} ·{" "}
              {t.active ? "Available for new boards" : "Unavailable for new boards"} ·{" "}
              {t.scoringDirection === "asc" ? "Lower score first" : "Higher score first"}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={!ready}
                onClick={() => setEdit({ template: t, copy: false })}
                aria-label={`Edit ${t.name}`}
              >
                Inspect / edit
              </Button>
              <Button
                variant="outline"
                disabled={!ready}
                onClick={() => setEdit({ template: t, copy: true })}
                aria-label={`Copy ${t.name}`}
              >
                Create copy
              </Button>
            </div>
          </article>
        ))}
      </div>
      {!shown.length ? <p>No templates match this view.</p> : null}
      <ResponsiveDetailPanel
        open={edit !== null}
        onOpenChange={(open) => {
          if (!open) setEdit(null);
        }}
        title={
          edit?.template
            ? `${edit.copy ? "Copy" : "Edit"} ${edit.template.name}`
            : "Create challenge template"
        }
        description="Review the exact template and supported settings before saving. Existing board scoring stays protected."
      >
        {edit ? (
          <TemplateForm
            key={`${edit.template?.id ?? "new"}-${edit.copy}`}
            template={edit.template}
            copy={edit.copy}
          />
        ) : null}
      </ResponsiveDetailPanel>
    </section>
  );
}
function TemplateForm({ template, copy }: { template: AdminTemplate | null; copy: boolean }) {
  const ready = useClientReady();
  const router = useRouter();
  const [review, setReview] = useState<FormData | null>(null);
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [pending, start] = useTransition();
  const busy = useRef(false);
  const updating = Boolean(template && !copy);
  return (
    <form
      aria-label="Template settings"
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        setError(undefined);
        setMessage(undefined);
        const data = new FormData(event.currentTarget);
        try {
          const rules = JSON.parse(String(data.get("rulesJson")));
          if (!rules || Array.isArray(rules) || typeof rules !== "object") throw new Error();
        } catch {
          setError("Scoring rules must be a valid JSON object. Your draft has been retained.");
          return;
        }
        setReview(data);
      }}
    >
      <fieldset disabled={!ready || pending || review !== null} className="grid min-w-0 gap-3">
        {updating ? (
          <>
            <input type="hidden" name="id" value={template!.id} />
            <input type="hidden" name="expectedUpdatedAt" value={template!.updatedAt} />
            <p className="break-all text-sm">Template ID: {template!.id}</p>
          </>
        ) : null}
        <label className="grid gap-1 text-sm">
          Template name
          <Input
            name="name"
            required
            maxLength={160}
            defaultValue={template ? `${template.name}${copy ? " copy" : ""}` : ""}
          />
        </label>
        <label className="grid gap-1 text-sm">
          Unique template key
          <Input
            name="slug"
            required
            maxLength={80}
            pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
            readOnly={updating}
            defaultValue={template ? `${template.slug}${copy ? "-copy" : ""}` : ""}
          />
          <span className="text-muted-foreground">
            Lowercase words separated by hyphens. Existing keys stay fixed.
          </span>
        </label>
        <label className="grid gap-1 text-sm">
          Description
          <Textarea
            name="description"
            maxLength={5000}
            required
            defaultValue={template?.description ?? ""}
          />
        </label>
        <label className="grid gap-1 text-sm">
          Scoring format
          <select
            name="challengeType"
            className="min-h-11 rounded-lg border bg-background px-3"
            defaultValue={template?.challengeType ?? "longest_drive"}
          >
            {Array.from(new Set([...kinds, ...(template ? [template.challengeType] : [])])).map(
              (k) => (
                <option key={k} value={k}>
                  {k.replaceAll("_", " ")}
                </option>
              ),
            )}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Score order
          <select
            name="scoringDirection"
            className="min-h-11 rounded-lg border bg-background px-3"
            defaultValue={template?.scoringDirection ?? "desc"}
          >
            <option value="desc">Higher score first</option>
            <option value="asc">Lower score first</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Scoring rules (JSON)
          <Textarea
            name="rulesJson"
            required
            rows={8}
            spellCheck={false}
            className="font-mono text-sm"
            defaultValue={JSON.stringify(template?.rulesJson ?? {}, null, 2)}
          />
          <span className="text-muted-foreground">
            Use the supported scoring shot count, club types, metric and target rules. Values are
            validated before saving; arbitrary scoring expressions are not supported.
          </span>
        </label>
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input
            type="checkbox"
            name="active"
            defaultChecked={template?.active ?? true}
            className="size-5"
          />
          Available for new boards
        </label>
        <p className="text-sm">
          Disabling availability prevents new boards using this template. It does not close existing
          boards or remove their results. Scoring edits are rejected if a board already references
          this template; use Create copy instead.
        </p>
      </fieldset>
      {review ? (
        <div className="grid gap-3 rounded-xl border p-4">
          <h3 className="font-semibold">Review {String(review.get("name"))}</h3>
          <p className="text-sm">
            {updating ? "Update this exact template" : "Create a new template"}. No existing board
            visibility or recorded result will be changed.
          </p>
          <dl className="grid gap-2 text-sm">
            {Array.from(review.entries())
              .filter(([key]) => key !== "expectedUpdatedAt")
              .map(([key, value]) => (
                <div key={key}>
                  <dt className="text-muted-foreground">{key}</dt>
                  <dd className="whitespace-pre-wrap break-all">{String(value)}</dd>
                </div>
              ))}
            <div>
              <dt>New board availability</dt>
              <dd>{review.has("active") ? "Available" : "Unavailable"}</dd>
            </div>
          </dl>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => setReview(null)}
          >
            Cancel review
          </Button>
          <Button
            type="button"
            disabled={pending}
            onClick={() => {
              if (busy.current) return;
              busy.current = true;
              setError(undefined);
              start(async () => {
                try {
                  const result = await saveAdminChallengeTemplateAction({ ok: false }, review);
                  if (!result.ok) {
                    setError(result.error ?? "The template could not be saved.");
                    return;
                  }
                  setMessage(result.message ?? "Template saved.");
                  setReview(null);
                  router.refresh();
                } catch {
                  setError(
                    "The save could not be confirmed. Your draft is retained; check the template before retrying.",
                  );
                } finally {
                  busy.current = false;
                }
              });
            }}
          >
            {pending ? "Saving…" : "Confirm template save"}
          </Button>
        </div>
      ) : (
        <Button disabled={!ready || pending}>Review template save</Button>
      )}
      {error ? (
        <p role="alert" className="text-sm">
          {error}
        </p>
      ) : null}
      {message ? (
        <p role="status" className="text-sm">
          {message}
        </p>
      ) : null}
    </form>
  );
}
