"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ResponsiveDetailPanel } from "@/components/app/responsive-detail-panel";
import { useClientReady } from "@/hooks/use-client-ready";
import layout from "@/app/course-records/course-record-board.module.css";
export type SponsorRecord = {
  id: string;
  name: string;
  slug: string;
  status: string;
  ownerUserId: string | null;
  websiteUrl: string | null;
  contactEmail: string | null;
  createdAt: string;
  updatedAt: string;
  offers: number;
};
export function PartnerRegister({
  rows,
  currentUserId,
}: {
  rows: SponsorRecord[];
  currentUserId: string;
}) {
  const ready = useClientReady();
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState("all");
  const [order, setOrder] = useState("name");
  const [id, setId] = useState<string | null>(null);
  const selected = rows.find((r) => r.id === id);
  const shown = rows
    .filter(
      (r) =>
        (scope === "all" || r.ownerUserId === currentUserId) &&
        `${r.name} ${r.slug} ${r.status} ${r.contactEmail ?? ""}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort((a, b) =>
      order === "name" ? a.name.localeCompare(b.name) : b.updatedAt.localeCompare(a.updatedAt),
    );
  return (
    <section id="sponsor-pipeline" aria-label="Sponsor pipeline" className="grid min-w-0 gap-3">
      <h2 className="text-xl font-semibold">Sponsor pipeline</h2>
      <p className="text-sm text-muted-foreground">
        Newest 40 sponsor records. Offer counts refer to the loaded active offers only. Commercial
        plan, asset approval and campaign milestones are not configured in this register.
      </p>
      <div className="flex flex-wrap gap-3">
        <label className="grid min-w-0 flex-1 basis-full gap-1 text-sm sm:basis-auto">
          Search sponsors
          <Input disabled={!ready} value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <label className="grid gap-1 text-sm">
          Ownership
          <select
            disabled={!ready}
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            className="min-h-11 rounded-lg border bg-background px-3"
          >
            <option value="all">All loaded sponsors</option>
            <option value="owned">Owned by me</option>
          </select>
        </label>
        <Button
          disabled={!ready}
          variant="outline"
          className="self-end"
          onClick={() => setOrder(order === "name" ? "updated" : "name")}
        >
          Order: {order}
        </Button>
      </div>
      <p role="status" className="text-sm">
        {shown.length} of {rows.length} loaded sponsors
      </p>
      {!shown.length ? (
        <p>No sponsors match this view.</p>
      ) : (
        <>
          <div className={layout.desktop}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">Sponsor pipeline ordered by {order}</caption>
                <thead>
                  <tr>
                    <th scope="col" aria-sort={order === "name" ? "ascending" : undefined}>
                      Sponsor
                    </th>
                    <th scope="col">Status</th>
                    <th scope="col">Owner</th>
                    <th scope="col">Contact</th>
                    <th scope="col" aria-sort={order === "updated" ? "descending" : undefined}>
                      Updated
                    </th>
                    <th scope="col">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((r) => (
                    <tr key={r.id} className="border-t">
                      <th scope="row" className="py-3 pr-3">
                        {r.name}
                      </th>
                      <td>{r.status}</td>
                      <td>{r.ownerUserId === currentUserId ? "You" : "Other admin"}</td>
                      <td className="break-all">
                        {r.contactEmail ?? r.websiteUrl ?? "Not supplied"}
                      </td>
                      <td>{r.updatedAt.slice(0, 10)}</td>
                      <td>
                        <Button
                          disabled={!ready}
                          variant="outline"
                          onClick={() => setId(r.id)}
                          aria-label={`Inspect sponsor ${r.name}`}
                        >
                          Inspect
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className={layout.mobile}>
            {shown.map((r) => (
              <Button
                key={r.id}
                disabled={!ready}
                variant="outline"
                onClick={() => setId(r.id)}
                aria-label={`Inspect sponsor ${r.name}`}
                className="h-auto min-h-14 justify-between whitespace-normal p-4 text-left"
              >
                <span className="min-w-0 break-words">
                  {r.name}
                  <span className="block text-xs font-normal">
                    {r.status} · {r.ownerUserId === currentUserId ? "Owned by you" : "Other admin"}
                  </span>
                </span>
                <span className="ml-2">Inspect</span>
              </Button>
            ))}
          </div>
        </>
      )}
      <ResponsiveDetailPanel
        open={Boolean(selected)}
        onOpenChange={(v) => {
          if (!v) setId(null);
        }}
        title={selected?.name ?? "Sponsor details"}
        description="Actual configured sponsor information and available offer context."
      >
        {selected ? (
          <div className="grid gap-4">
            <dl className="grid gap-3">
              {Object.entries(selected).map(([key, value]) => (
                <div key={key}>
                  <dt className="text-sm text-muted-foreground">
                    {key === "offers" ? "Loaded active offers" : key}
                  </dt>
                  <dd className="break-all">
                    {value === null || value === undefined
                      ? "Not supplied"
                      : typeof value === "object"
                        ? JSON.stringify(value, null, 2)
                        : String(value)}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="text-sm">
              Website/contact presence is not evidence of campaign approval or commercial
              entitlement. Offer creation requires ownership of this sponsor.
            </p>
            <Button asChild variant="outline">
              <a href="#partner-setup" onClick={() => setId(null)}>
                Open partner setup
              </a>
            </Button>
          </div>
        ) : null}
      </ResponsiveDetailPanel>
    </section>
  );
}
