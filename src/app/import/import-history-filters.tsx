"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { useClientReady } from "@/hooks/use-client-ready";
import { Button } from "@/components/ui/button";
import type { ImportHistoryQuery } from "@/lib/import-history-query";
export function ImportHistoryFilters({
  query,
  statuses,
  sources,
}: {
  query: ImportHistoryQuery;
  statuses: string[];
  sources: string[];
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(query);
  const scopeKey = JSON.stringify(query);
  const [previousScope, setPreviousScope] = useState(scopeKey);
  if (scopeKey !== previousScope) {
    setPreviousScope(scopeKey);
    setDraft(query);
  }
  const params = useSearchParams();
  const ready = useClientReady();
  const [pending, start] = useTransition();
  const navigate = (form?: FormData) => {
    const next = new URLSearchParams(params.toString());
    for (const key of ["importQ", "importStatus", "importSource", "importOrder"]) {
      const value = form?.get(key)?.toString().trim();
      if (value) next.set(key, value);
      else next.delete(key);
    }
    next.delete("importPage");
    start(() => router.push(`/import?${next}#import-library`, { scroll: false }));
  };
  return (
    <form
      className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5"
      onSubmit={(event) => {
        event.preventDefault();
        navigate(new FormData(event.currentTarget));
      }}
      aria-label="Filter import history"
    >
      <label className="grid min-w-0 gap-1 text-sm">
        Search all files
        <input
          disabled={!ready || pending}
          name="importQ"
          value={draft.q}
          onChange={(event) => setDraft({ ...draft, q: event.target.value })}
          placeholder="File, fingerprint or parser"
          className="min-h-11 min-w-0 rounded-lg border bg-background px-3"
        />
      </label>
      <label className="grid min-w-0 gap-1 text-sm">
        Import outcome
        <select
          disabled={!ready || pending}
          name="importStatus"
          value={draft.status}
          onChange={(event) => setDraft({ ...draft, status: event.target.value })}
          className="min-h-11 min-w-0 rounded-lg border bg-background px-3"
        >
          <option value="active">Active files</option>
          <option value="all">All outcomes</option>
          {[
            ...new Set([
              ...statuses,
              ...(query.status !== "active" && query.status !== "all" ? [query.status] : []),
            ]),
          ].map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
      <label className="grid min-w-0 gap-1 text-sm">
        Import source
        <select
          disabled={!ready || pending}
          name="importSource"
          value={draft.source}
          onChange={(event) => setDraft({ ...draft, source: event.target.value })}
          className="min-h-11 min-w-0 rounded-lg border bg-background px-3"
        >
          <option value="">All sources</option>
          {[...new Set([...sources, ...(query.source ? [query.source] : [])])].map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
      <label className="grid min-w-0 gap-1 text-sm">
        Import order
        <select
          disabled={!ready || pending}
          name="importOrder"
          value={draft.order}
          onChange={(event) =>
            setDraft({ ...draft, order: event.target.value as "newest" | "oldest" })
          }
          className="min-h-11 min-w-0 rounded-lg border bg-background px-3"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>
      </label>
      <div className="flex flex-wrap items-end gap-2">
        <Button type="submit" disabled={!ready || pending}>
          Apply history filters
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={!ready || pending}
          onClick={() => navigate()}
        >
          Clear history filters
        </Button>
      </div>
      {pending ? <p role="status">Loading matching files…</p> : null}
    </form>
  );
}
