"use client";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ResponsiveDetailPanel } from "@/components/app/responsive-detail-panel";
import { useClientReady } from "@/hooks/use-client-ready";
const links = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/system-checks", label: "System checks" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/billing", label: "Billing" },
  { href: "/admin/moderation", label: "Moderation" },
  { href: "/admin/challenges", label: "Challenges" },
];
export function AdminNavigation({ active }: { active: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ready = useClientReady();
  const current = links.find((link) => link.href === active)?.label ?? "Administration";
  return (
    <nav aria-label="Admin sections" className="grid gap-3 rounded-xl border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">Administrator · {current}</p>
        <Button variant="outline" disabled={!ready} onClick={() => setOpen(true)}>
          All admin sections
        </Button>
      </div>
      <details>
        <summary className="min-h-11 cursor-pointer py-3 text-sm">Section shortcuts</summary>
        <div className="flex flex-wrap gap-2">
          {links.map((link) => (
            <Button key={link.href} asChild variant={link.href === active ? "default" : "outline"}>
              <Link
                href={link.href}
                prefetch={false}
                aria-current={link.href === active ? "page" : undefined}
              >
                {link.label}
              </Link>
            </Button>
          ))}
        </div>
      </details>
      <ResponsiveDetailPanel
        open={open}
        onOpenChange={setOpen}
        title="All admin sections"
        description="Protected operational tasks. Your player navigation remains separate."
      >
        <div className="grid gap-3">
          <label className="grid gap-1 text-sm">
            Search admin sections
            <Input value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          {links
            .filter((link) => link.label.toLowerCase().includes(query.toLowerCase()))
            .map((link) => (
              <Button key={link.href} asChild variant="outline" className="justify-start">
                <Link
                  href={link.href}
                  prefetch={false}
                  aria-current={link.href === active ? "page" : undefined}
                  onClick={() => setOpen(false)}
                >
                  {link.label}
                </Link>
              </Button>
            ))}
          {!links.some((link) => link.label.toLowerCase().includes(query.toLowerCase())) ? (
            <p role="status">No admin sections match.</p>
          ) : null}
        </div>
      </ResponsiveDetailPanel>
    </nav>
  );
}
