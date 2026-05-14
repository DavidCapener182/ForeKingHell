import type { ReactNode } from "react";
import { Gift, Megaphone, Plus, ShieldCheck, TicketPercent } from "lucide-react";

import { createPartnerOfferAction, createSponsorAction, recordOfferClickAction } from "@/app/partners/actions";
import { PageShell, StatusPill } from "@/components/premium";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getPartnersPageData } from "@/lib/partners";

export const dynamic = "force-dynamic";

export default async function PartnersPage() {
  const data = await getPartnersPageData();

  return (
    <PageShell size="7xl">
      <header className="rounded-xl border bg-white p-5 shadow-sm">
        <StatusPill tone="amber">Sponsored growth</StatusPill>
        <h1 className="mt-3 text-3xl font-semibold tracking-normal">Sponsors and partner offers</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Keep sponsored challenges and affiliate offers contextual, labelled and optional. This page is the lightweight partner dashboard foundation.
        </p>
      </header>

      <section className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start">
        <aside className="grid gap-4 lg:sticky lg:top-28">
          <section className="rounded-xl border bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold">Add sponsor prospect</p>
            <form action={createSponsorAction} className="mt-3 grid gap-3">
              <Input name="name" placeholder="Local range / golf shop" className="h-9 rounded-xl bg-slate-50" required />
              <Input name="websiteUrl" placeholder="https://..." className="h-9 rounded-xl bg-slate-50" />
              <Input name="contactEmail" type="email" placeholder="partner@example.com" className="h-9 rounded-xl bg-slate-50" />
              <Button type="submit" className="rounded-xl bg-[#111827] text-white">
                <Plus className="size-4" />
                Add sponsor
              </Button>
            </form>
          </section>

          <section className="rounded-xl border bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold">Create offer</p>
            <form action={createPartnerOfferAction} className="mt-3 grid gap-3">
              <select name="sponsorId" className="h-9 rounded-xl border bg-slate-50 px-3 text-sm" required>
                {data.ownedSponsors.map((sponsor) => (
                  <option key={sponsor.id} value={sponsor.id}>{sponsor.name}</option>
                ))}
              </select>
              <Input name="title" placeholder="Winter range credit" className="h-9 rounded-xl bg-slate-50" required />
              <textarea name="description" rows={3} className="rounded-xl border bg-slate-50 px-3 py-2 text-sm" placeholder="Short labelled offer copy" />
              <select name="offerType" className="h-9 rounded-xl border bg-slate-50 px-3 text-sm">
                <option value="affiliate">Affiliate</option>
                <option value="discount">Discount</option>
                <option value="prize">Prize</option>
                <option value="range_credit">Range credit</option>
              </select>
              <Input name="targetContext" placeholder="spin_missing, wedge, challenge" className="h-9 rounded-xl bg-slate-50" />
              <Input name="offerUrl" placeholder="https://..." className="h-9 rounded-xl bg-slate-50" />
              <Input name="couponCode" placeholder="Optional code" className="h-9 rounded-xl bg-slate-50" />
              <Button type="submit" disabled={data.ownedSponsors.length === 0}>
                <TicketPercent className="size-4" />
                Save offer
              </Button>
            </form>
          </section>
        </aside>

        <main className="grid gap-4">
          <section className="grid gap-3 md:grid-cols-3">
            <Metric icon={<Megaphone className="size-4 text-amber-600" />} label="Sponsors" value={data.sponsors.length} />
            <Metric icon={<Gift className="size-4 text-emerald-600" />} label="Active offers" value={data.offers.length} />
            <Metric icon={<ShieldCheck className="size-4 text-sky-600" />} label="Label policy" value="Required" />
          </section>

          <section className="rounded-xl border bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold">Active contextual offers</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {data.offers.length === 0 ? (
                <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No partner offers yet.</p>
              ) : (
                data.offers.map((offer) => (
                  <article key={offer.id} className="rounded-xl border bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Badge variant="outline">{label(offer.offerType)}</Badge>
                        <h2 className="mt-3 font-semibold">{offer.title}</h2>
                      </div>
                      {offer.couponCode ? <Badge variant="secondary">{offer.couponCode}</Badge> : null}
                    </div>
                    <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">{offer.description ?? "No description."}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {offer.targetContext ? <Badge variant="outline">{offer.targetContext}</Badge> : null}
                      {offer.offerUrl ? (
                        <form action={recordOfferClickAction}>
                          <input type="hidden" name="offerId" value={offer.id} />
                          <input type="hidden" name="offerUrl" value={offer.offerUrl} />
                          <input type="hidden" name="source" value="partners_page" />
                          <Button type="submit" size="sm">Open offer</Button>
                        </form>
                      ) : null}
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>

          <section className="rounded-xl border bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold">Sponsor pipeline</p>
            <div className="mt-4 grid gap-2">
              {data.sponsors.map((sponsor) => (
                <div key={sponsor.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{sponsor.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{sponsor.websiteUrl ?? sponsor.contactEmail ?? "No contact detail"}</p>
                  </div>
                  <Badge variant={sponsor.status === "active" ? "secondary" : "outline"}>{sponsor.status}</Badge>
                </div>
              ))}
            </div>
          </section>
        </main>
      </section>
    </PageShell>
  );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <p className="flex items-center gap-2 text-sm text-muted-foreground">{icon}{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-normal">{value}</p>
    </div>
  );
}

function label(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
