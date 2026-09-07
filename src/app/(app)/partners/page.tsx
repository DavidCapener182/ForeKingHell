import { recordOfferClickAction } from "@/app/partners/actions";
import { PartnerCreationForms } from "@/app/partners/partner-creation-forms";
import { PartnerRegister } from "@/app/partners/partner-register";
import { PageHeader, PageShell } from "@/components/premium";
import { PartnerDestinationButton } from "@/app/partners/partner-destination-button";
import { getPartnersPageData } from "@/lib/partners";
export const dynamic = "force-dynamic";
export default async function PartnersPage() {
  const data = await getPartnersPageData();
  return (
    <PageShell>
      <div className="grid min-w-0 gap-5 pb-28">
        <PageHeader
          title="Sponsors and partner offers"
          description="Manage owned sponsors and clearly labelled offers with their actual terms and golf context."
        />
        <dl className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Owned sponsors", data.ownedSponsors.length],
            ["Loaded sponsor records", data.sponsors.length],
            ["Loaded active offers", data.offers.length],
            ["Your recent clicks (latest 20)", data.recentClicks.length],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-sm text-muted-foreground">{label}</dt>
              <dd className="text-2xl font-semibold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
        <PartnerCreationForms
          sponsors={data.ownedSponsors.map((s) => ({ id: s.id, name: s.name }))}
        />
        <section id="offers" aria-label="Active partner offers" className="grid gap-3">
          <h2 className="text-xl font-semibold">Active partner offers</h2>
          <p className="text-sm text-muted-foreground">
            Latest 80 active offers. Viewing terms does not record a click; the destination action
            does.
          </p>
          <div className="grid gap-3 lg:grid-cols-2">
            {data.offers.map((offer) => (
              <article key={offer.id} className="grid min-w-0 gap-3 rounded-xl border p-4">
                <p className="text-xs font-medium uppercase tracking-wide">
                  {offer.offerType === "affiliate" ? "Affiliate offer" : "Sponsored offer"} ·{" "}
                  {offer.offerType.replaceAll("_", " ")}
                </p>
                <h3 className="break-words text-lg font-semibold">{offer.title}</h3>
                <p className="text-sm">
                  Sponsor:{" "}
                  {data.sponsors.find((s) => s.id === offer.sponsorId)?.name ??
                    data.ownedSponsors.find((s) => s.id === offer.sponsorId)?.name ??
                    offer.sponsorId}
                </p>
                <p className="whitespace-pre-wrap break-words text-sm">
                  {offer.description ?? "No additional terms supplied."}
                </p>
                <dl className="grid gap-2 text-sm">
                  <div>
                    <dt>Golf context</dt>
                    <dd>{offer.targetContext ?? "Not supplied"}</dd>
                  </div>
                  <div>
                    <dt>Coupon code</dt>
                    <dd className="break-all">
                      {offer.couponCode ?? "Not required / not supplied"}
                    </dd>
                  </div>
                  <div>
                    <dt>Destination</dt>
                    <dd className="break-all">{offer.offerUrl ?? "No destination supplied"}</dd>
                  </div>
                </dl>
                {offer.offerUrl ? (
                  <form action={recordOfferClickAction}>
                    <input type="hidden" name="offerId" value={offer.id} />
                    <input type="hidden" name="source" value="partners" />
                    <PartnerDestinationButton />
                  </form>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    This offer has no destination to open.
                  </p>
                )}
              </article>
            ))}
          </div>
          {!data.offers.length ? (
            <p className="rounded-xl border p-4">No active offers are available.</p>
          ) : null}
        </section>
        <PartnerRegister
          currentUserId={data.userId}
          rows={data.sponsors.map((s) => ({
            ...s,
            createdAt: s.createdAt.toISOString(),
            updatedAt: s.updatedAt.toISOString(),
            offers: data.offers.filter((o) => o.sponsorId === s.id).length,
          }))}
        />
      </div>
    </PageShell>
  );
}
