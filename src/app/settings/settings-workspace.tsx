"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useClientReady } from "@/hooks/use-client-ready";
import styles from "./settings-workspace.module.css";
export function SettingsWorkspace({
  initialSection,
  items,
}: {
  initialSection: string | null;
  items: Array<{ id: string; label: string; description: string; content: ReactNode }>;
}) {
  const ready = useClientReady();
  const [active, setActive] = useState<string | null>(initialSection);
  const [q, setQ] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const focusSelection = useRef(false);
  const query = q.trim().toLowerCase();
  const matchingItems = items.filter((item) =>
    `${item.label} ${item.description}`.toLowerCase().includes(query),
  );
  useEffect(() => {
    if (!focusSelection.current) return;
    focusSelection.current = false;
    if (active) document.getElementById(`settings-heading-${active}`)?.focus();
    else searchRef.current?.focus();
  }, [active]);
  useEffect(() => {
    const sync = (event?: PopStateEvent) => {
      if (event) focusSelection.current = true;
      const key = new URL(location.href).searchParams.get("section");
      setActive(
        items.some((i) => i.id === key)
          ? key
          : matchMedia("(min-width:1024px)").matches
            ? "general"
            : null,
      );
    };
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, [items]);
  const select = (key: string | null) => {
    if (key === active) {
      if (key) document.getElementById(`settings-heading-${key}`)?.focus();
      else searchRef.current?.focus();
    } else {
      focusSelection.current = true;
      setActive(key);
    }
    const url = new URL(location.href);
    if (key) url.searchParams.set("section", key);
    else url.searchParams.delete("section");
    for (const flag of ["saved", "invite", "inviteAccepted", "inviteCancelled", "memberRemoved"])
      url.searchParams.delete(flag);
    history.pushState(null, "", url.pathname + url.search);
  };
  return (
    <div className={styles.workspace} data-has-selection={!!active}>
      <nav className={styles.navigation} aria-label="Settings sections">
        <label className="grid gap-2 text-sm">
          Find a settings section
          <input
            ref={searchRef}
            type="search"
            aria-describedby="settings-search-results"
            className="min-h-11 rounded-lg border bg-background px-3"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
        <div className="mt-3 grid gap-2">
          {matchingItems.map((i) => (
            <Button
              key={i.id}
              disabled={!ready}
              variant={active === i.id ? "secondary" : "outline"}
              className="min-h-11 h-auto justify-start whitespace-normal text-left"
              aria-current={active === i.id ? "page" : undefined}
              onClick={() => select(i.id)}
            >
              {i.label}
            </Button>
          ))}
        </div>
        <p
          id="settings-search-results"
          role="status"
          className="mt-3 text-sm text-muted-foreground"
        >
          {matchingItems.length === 0
            ? "No settings sections match. Try account, privacy, notifications or billing."
            : query
              ? `${matchingItems.length} settings sections match.`
              : ""}
        </p>
        {q ? (
          <Button
            type="button"
            variant="ghost"
            className="mt-2 min-h-11 justify-self-start"
            onClick={() => {
              setQ("");
              searchRef.current?.focus();
            }}
          >
            Clear search
          </Button>
        ) : null}
      </nav>
      <div className="min-w-0">
        {active ? (
          <Button variant="outline" className={styles.back} onClick={() => select(null)}>
            All settings sections
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">
            Choose a section. Unsaved changes stay on this page when you move between sections.
          </p>
        )}
        {items.map((i) => (
          <section
            key={i.id}
            style={{ display: active === i.id ? "block" : "none" }}
            aria-label={i.label}
          >
            <header className="mb-5 border-b pb-4">
              <h2
                id={`settings-heading-${i.id}`}
                tabIndex={-1}
                className="text-xl font-semibold outline-none focus-visible:underline"
              >
                {i.label}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">{i.description}</p>
            </header>
            {i.content}
          </section>
        ))}
      </div>
    </div>
  );
}
