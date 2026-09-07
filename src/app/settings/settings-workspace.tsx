"use client";
import { useEffect, useState, type ReactNode } from "react";
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
  useEffect(() => {
    const sync = () => {
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
    setActive(key);
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
            type="search"
            className="min-h-11 rounded-lg border bg-background px-3"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
        <div className="mt-3 grid gap-2">
          {items
            .filter((i) => `${i.label} ${i.description}`.toLowerCase().includes(q.toLowerCase()))
            .map((i) => (
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
        {items.every(
          (i) => !`${i.label} ${i.description}`.toLowerCase().includes(q.toLowerCase()),
        ) ? (
          <p role="status">No sections match.</p>
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
              <h2 className="text-xl font-semibold">{i.label}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{i.description}</p>
            </header>
            {i.content}
          </section>
        ))}
      </div>
    </div>
  );
}
