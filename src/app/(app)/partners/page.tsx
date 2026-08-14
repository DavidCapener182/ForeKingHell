import { Plus, TicketPercent } from "lucide-react";

import {
  createPartnerOfferAction,
  createSponsorAction,
  recordOfferClickAction,
} from "@/app/partners/actions";
import {
  DesktopWorkbenchLayout,
  DesktopSavedViewSuggestion,
  DesktopWorkbenchColumn,
} from "@/components/app/desktop-workbench";
import {
  DataPair,
  DataPanel,
  DataTableFrame,
  PageHeader,
  PageShell,
  StatusPill,
} from "@/components/premium";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PageArtwork } from "@/components/visuals/page-artwork";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getPartnersPageData } from "@/lib/partners";

export const dynamic = "force-dynamic";

type PartnersPageData = Awaited<ReturnType<typeof getPartnersPageData>>;
type Sponsor = PartnersPageData["sponsors"][number];

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const sponsorPipelineColumns: DesktopWorkbenchColumn[] = [
  { id: "sponsor", label: "Sponsor", locked: true },
  { id: "status", label: "Status" },
  { id: "owner", label: "Owner" },
  { id: "contact", label: "Contact" },
  { id: "created", label: "Created" },
  { id: "updated", label: "Updated" },
];

const sponsorPipelineSuggestedViews: DesktopSavedViewSuggestion[] = [
  {
    title: "Prospects needing contact",
    href: "/partners#sponsor-pipeline",
    detail: "Review sponsors that still need owner follow-up.",
  },
  {
    title: "Active offers",
    href: "/partners#offers",
    detail: "Jump to live contextual offers and coupon controls.",
  },
  {
    title: "Owned sponsor setup",
    href: "/partners#partner-setup",
    detail: "Create sponsors and offers from the admin forms.",
  },
];

export default async function PartnersPage({
  searchParams,
}: {
  searchParams?: Promise<{ sponsor?: string; offer?: string }>;
}) {
  const params = await searchParams;
  const data = await getPartnersPageData();
  const activeContextualOffers = data.offers.filter((offer) => Boolean(offer.targetContext)).length;
  const sponsorAssetCount = data.sponsors.filter(
    (sponsor) => Boolean(sponsor.websiteUrl) || Boolean(sponsor.contactEmail),
  ).length;
  const status =
    params?.sponsor === "created"
      ? "Sponsor added"
      : params?.offer === "created"
        ? "Offer created"
        : params?.offer === "clicked"
          ? "Offer click recorded"
          : null;

  return (
    <PageShell>
      <DesktopWorkbenchLayout scope="partners">
        <PageHeader
          eyebrow={<StatusPill tone="amber">Sponsored growth</StatusPill>}
          title="Sponsors and partner offers"
          description="Keep sponsored challenges and affiliate offers contextual, labelled and optional. This page is the lightweight partner dashboard foundation."
          visual={<PageArtwork variant="partners" alt="" className="h-full min-h-36" priority />}
          metrics={[
            { label: "Sponsors", value: data.sponsors.length },
            { label: "Active offers", value: data.offers.length },
            { label: "Label policy", value: "Required" },
          ]}
        />

        {status ? (
          <Alert>
            <AlertTitle>{status}</AlertTitle>
            <AlertDescription>Partner operations have been refreshed.</AlertDescription>
          </Alert>
        ) : null}

        <PartnerOperationsSummary
          activeContextualOffers={activeContextualOffers}
          offerCount={data.offers.length}
          recentClickCount={data.recentClicks.length}
          sponsorAssetCount={sponsorAssetCount}
          sponsorCount={data.sponsors.length}
        />

        <section className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start">
          <section id="partner-setup" className="grid scroll-mt-28 gap-4 lg:sticky lg:top-28">
            <section className="rounded-xl border bg-card p-4 shadow-sm">
              <p className="text-sm font-semibold">Add sponsor prospect</p>
              <form action={createSponsorAction} className="mt-3 grid gap-3">
                <Input
                  name="name"
                  placeholder="Local range / golf shop"
                  className="h-9 rounded-xl bg-muted/40"
                  required
                />
                <Input
                  name="websiteUrl"
                  placeholder="https://example.com"
                  className="h-9 rounded-xl bg-muted/40"
                />
                <Input
                  name="contactEmail"
                  type="email"
                  placeholder="partner@example.com"
                  className="h-9 rounded-xl bg-muted/40"
                />
                <Button type="submit" className="rounded-xl">
                  <Plus className="size-4" />
                  Add sponsor
                </Button>
              </form>
            </section>

            <section className="rounded-xl border bg-card p-4 shadow-sm">
              <p className="text-sm font-semibold">Create offer</p>
              <form action={createPartnerOfferAction} className="mt-3 grid gap-3">
                <Select name="sponsorId" defaultValue={data.ownedSponsors[0]?.id} required>
                  <SelectTrigger aria-label="Sponsor" className="h-9 w-full bg-muted/40">
                    <SelectValue placeholder="Choose sponsor" />
                  </SelectTrigger>
                  <SelectContent>
                    {data.ownedSponsors.map((sponsor) => (
                      <SelectItem key={sponsor.id} value={sponsor.id}>
                        {sponsor.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  name="title"
                  placeholder="Winter range credit"
                  className="h-9 rounded-xl bg-muted/40"
                  required
                />
                <Textarea
                  name="description"
                  rows={3}
                  className="rounded-xl border bg-muted/40 px-3 py-2 text-sm"
                  placeholder="Short labelled offer copy"
                />
                <Select name="offerType" defaultValue="affiliate">
                  <SelectTrigger aria-label="Offer type" className="h-9 w-full bg-muted/40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="affiliate">Affiliate</SelectItem>
                    <SelectItem value="discount">Discount</SelectItem>
                    <SelectItem value="prize">Prize</SelectItem>
                    <SelectItem value="range_credit">Range credit</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  name="targetContext"
                  placeholder="spin_missing, wedge, challenge"
                  className="h-9 rounded-xl bg-muted/40"
                />
                <Input
                  name="offerUrl"
                  placeholder="https://example.com/offer"
                  className="h-9 rounded-xl bg-muted/40"
                />
                <Input
                  name="couponCode"
                  placeholder="Optional code"
                  className="h-9 rounded-xl bg-muted/40"
                />
                <Button type="submit" disabled={data.ownedSponsors.length === 0}>
                  <TicketPercent className="size-4" />
                  Save offer
                </Button>
              </form>
            </section>
          </section>

          <section className="grid gap-4">
            <Card id="offers" className="gap-0 py-0">
              <CardContent className="p-4">
                <p className="text-sm font-semibold">Active contextual offers</p>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {data.offers.length === 0 ? (
                    <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                      No partner offers yet.
                    </p>
                  ) : (
                    data.offers.map((offer) => (
                      <article key={offer.id} className="rounded-xl border bg-muted/40 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <Badge variant="outline">{label(offer.offerType)}</Badge>
                            <h2 className="mt-3 font-semibold">{offer.title}</h2>
                          </div>
                          {offer.couponCode ? (
                            <Badge variant="secondary">{offer.couponCode}</Badge>
                          ) : null}
                        </div>
                        <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">
                          {offer.description ?? "No description."}
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          {offer.targetContext ? (
                            <Badge variant="outline">{offer.targetContext}</Badge>
                          ) : null}
                          {offer.offerUrl ? (
                            <form action={recordOfferClickAction}>
                              <input type="hidden" name="offerId" value={offer.id} />
                              <input type="hidden" name="offerUrl" value={offer.offerUrl} />
                              <input type="hidden" name="source" value="partners_page" />
                              <Button type="submit" size="sm">
                                Open offer
                              </Button>
                            </form>
                          ) : null}
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            <SponsorPipelineTable sponsors={data.sponsors} currentUserId={data.userId} />
          </section>
        </section>
      </DesktopWorkbenchLayout>
    </PageShell>
  );
}

function PartnerOperationsSummary({
  activeContextualOffers,
  offerCount,
  recentClickCount,
  sponsorAssetCount,
  sponsorCount,
}: {
  activeContextualOffers: number;
  offerCount: number;
  recentClickCount: number;
  sponsorAssetCount: number;
  sponsorCount: number;
}) {
  return (
    <DataPanel>
      <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:items-center">
        <div>
          <StatusPill tone="amber">Partner operations</StatusPill>
          <h2 className="mt-3 text-2xl font-semibold tracking-normal">
            Campaign, asset and plan requirements
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Promote offers only when the sponsor has a contact route, the offer is clearly labelled
            and the campaign has a golf context such as wedge, challenge or range credit.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <DataPair
            label="Campaigns"
            value={`${activeContextualOffers} / ${offerCount} contextual`}
          />
          <DataPair
            label="Sponsor assets"
            value={`${sponsorAssetCount} / ${sponsorCount} contactable`}
          />
          <DataPair label="Plan requirements" value="Owner + label" />
          <DataPair label="Recent clicks" value={`${recentClickCount} recent`} />
        </div>
      </div>
    </DataPanel>
  );
}

async function SponsorPipelineTable({
  sponsors,
  currentUserId,
}: {
  sponsors: Sponsor[];
  currentUserId: string;
}) {
  const { DesktopTableWorkbenchControls } = await import("@/components/app/desktop-workbench");

  return (
    <Card
      id="sponsor-pipeline"
      data-workbench-scope="partner-sponsors"
      className="scroll-mt-28 gap-0 py-0"
    >
      <CardContent className="p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold">Sponsor pipeline</p>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">
              Review sponsor owner, contact and status before attaching offers to golf contexts.
            </p>
          </div>
          <StatusPill tone={sponsors.length > 0 ? "green" : "slate"}>
            {sponsors.length} sponsors
          </StatusPill>
        </div>

        <DesktopTableWorkbenchControls
          viewKey="partner-sponsors"
          scope="partner-sponsors"
          currentViewLabel="Sponsor pipeline"
          resultLabel={`${sponsors.length} sponsors`}
          columns={sponsorPipelineColumns}
          suggestedViews={sponsorPipelineSuggestedViews}
          exportTableId="partner-sponsors"
          exportFileName="forekinghell-sponsor-pipeline.csv"
          className="my-3"
        />

        <DataTableFrame mainTable mainTableLabel="Sponsor pipeline table" stickyFirstColumn>
          <Table
            data-workbench-export-table="partner-sponsors"
            aria-describedby="partner-sponsors-summary"
          >
            <TableCaption id="partner-sponsors-summary" className="sr-only">
              Sponsor pipeline table with sponsor name, status, owner, contact, created date and
              updated date.
            </TableCaption>
            <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-card">
              <TableRow>
                <TableHead
                  data-column="sponsor"
                  className="sticky left-0 z-20 min-w-64 bg-card shadow-[1px_0_0_hsl(var(--border))]"
                >
                  Sponsor
                </TableHead>
                <TableHead data-column="status">Status</TableHead>
                <TableHead data-column="owner">Owner</TableHead>
                <TableHead data-column="contact">Contact</TableHead>
                <TableHead data-column="created">Created</TableHead>
                <TableHead data-column="updated">Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sponsors.length > 0 ? (
                sponsors.map((sponsor) => (
                  <TableRow key={sponsor.id} tabIndex={0} className="focus-aaa outline-none">
                    <TableCell
                      data-column="sponsor"
                      className="sticky left-0 z-10 min-w-64 bg-card font-medium shadow-[1px_0_0_hsl(var(--border))]"
                    >
                      <span className="block max-w-72 truncate">{sponsor.name}</span>
                      <span className="mt-1 block truncate text-xs text-muted-foreground">
                        {sponsor.slug}
                      </span>
                    </TableCell>
                    <TableCell data-column="status">
                      <Badge variant={sponsor.status === "active" ? "secondary" : "outline"}>
                        {label(sponsor.status)}
                      </Badge>
                    </TableCell>
                    <TableCell data-column="owner">
                      {sponsor.ownerUserId === currentUserId ? "You" : "Other admin"}
                    </TableCell>
                    <TableCell data-column="contact">{sponsorContactLabel(sponsor)}</TableCell>
                    <TableCell data-column="created">
                      {dateFormatter.format(sponsor.createdAt)}
                    </TableCell>
                    <TableCell data-column="updated">
                      {dateFormatter.format(sponsor.updatedAt)}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                    No sponsor prospects yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </DataTableFrame>
      </CardContent>
    </Card>
  );
}

function sponsorContactLabel(sponsor: Sponsor) {
  return sponsor.websiteUrl ?? sponsor.contactEmail ?? "No contact detail";
}

function label(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
