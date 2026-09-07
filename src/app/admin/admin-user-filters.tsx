"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ResponsiveDetailPanel } from "@/components/app/responsive-detail-panel";
import { useClientReady } from "@/hooks/use-client-ready";
const choices = {
  role: [
    ["all", "All roles"],
    ["owner", "Owner"],
    ["operator", "Operator"],
    ["none", "No admin role"],
  ],
  plan: [
    ["all", "All plans"],
    ["free", "Free"],
    ["plus", "Plus"],
    ["pro", "Pro"],
    ["coach", "Coach / Club"],
    ["full", "Lifetime full"],
  ],
  status: [
    ["all", "All statuses"],
    ["active", "Active admin"],
    ["inactive", "Inactive admin"],
    ["standard", "Standard account"],
  ],
  order: [
    ["created_desc", "Newest accounts"],
    ["created_asc", "Oldest accounts"],
    ["user_asc", "Name A–Z"],
    ["user_desc", "Name Z–A"],
    ["activity_desc", "Most activity"],
    ["activity_asc", "Least activity"],
    ["plan_desc", "Plan descending"],
    ["plan_asc", "Plan ascending"],
    ["admin_desc", "Admin role descending"],
    ["admin_asc", "Admin role ascending"],
  ],
};
export function AdminUserFilters({
  q,
  role,
  plan,
  status,
  order,
  count,
  loaded,
}: {
  q: string;
  role: string;
  plan: string;
  status: string;
  order: string;
  count: number;
  loaded: number;
}) {
  const router = useRouter();
  const ready = useClientReady();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ role, plan, status, order });
  const form = useRef<HTMLFormElement>(null);
  const active = [role, plan, status].filter((value) => value !== "all").length;
  return (
    <div className="grid gap-3">
      <form ref={form} action="/admin/users" className="flex flex-wrap items-end gap-3">
        <label className="grid min-w-0 flex-1 basis-full gap-1 text-sm sm:basis-auto">
          Search accounts
          <Input name="q" defaultValue={q} placeholder="Name, username or email" />
        </label>
        {Object.entries({ role, plan, status, order }).map(([key, value]) => (
          <input key={key} type="hidden" name={key} value={value} />
        ))}
        <Button type="submit">Search</Button>
        <Button
          type="button"
          variant="outline"
          disabled={!ready}
          onClick={() => {
            setDraft({ role, plan, status, order });
            setOpen(true);
          }}
        >
          Filters and order ({active})
        </Button>
        <Button asChild variant="outline">
          <a href="/admin/users">Clear all</a>
        </Button>
      </form>
      <p role="status" className="text-sm">
        {count} results from the latest {loaded} search matches, up to 100. Filters and ordering
        apply to this loaded scope.
      </p>
      <div className="flex flex-wrap gap-2 text-xs">
        {q ? <span className="rounded-lg border p-2">Search: {q}</span> : null}
        {Object.entries({ role, plan, status })
          .filter(([, value]) => value !== "all")
          .map(([key, value]) => (
            <span key={key} className="rounded-lg border p-2">
              {key}: {value}
            </span>
          ))}
      </div>
      <ResponsiveDetailPanel
        open={open}
        onOpenChange={setOpen}
        title="Account filters"
        description="Filter the latest 100 matching accounts; your search text is retained."
      >
        <div className="grid gap-4">
          {Object.entries(choices).map(([key, options]) => (
            <label key={key} className="grid gap-1 text-sm">
              {key === "role"
                ? "Admin role"
                : key === "plan"
                  ? "Plan"
                  : key === "status"
                    ? "Admin status"
                    : "Order"}
              <select
                className="min-h-11 rounded-lg border bg-background px-3"
                value={draft[key as keyof typeof draft]}
                onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
              >
                {options.map(([value, title]) => (
                  <option key={value} value={value}>
                    {title}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <Button
            variant="outline"
            onClick={() =>
              setDraft({ role: "all", plan: "all", status: "all", order: "created_desc" })
            }
          >
            Reset filters
          </Button>
          <Button
            onClick={() => {
              if (!form.current) return;
              const data = new FormData(form.current);
              for (const [key, value] of Object.entries(draft)) data.set(key, value);
              router.push(
                "/admin/users?" +
                  new URLSearchParams(
                    Array.from(data.entries()).map(([key, value]) => [key, String(value)]),
                  ).toString(),
              );
              setOpen(false);
            }}
          >
            Apply filters
          </Button>
        </div>
      </ResponsiveDetailPanel>
    </div>
  );
}
