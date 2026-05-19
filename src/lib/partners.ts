import "server-only";

import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { offerClicks, partnerOffers, sponsors } from "@/db/schema";
import { getDb } from "@/db/client";
import { requireAdminUser } from "@/lib/admin";
import { requireCurrentUserId } from "@/lib/current-user";

export async function getPartnersPageData() {
  await requireAdminUser();
  const userId = await requireCurrentUserId();
  const [sponsorRows, offerRows, clickRows] = await Promise.all([
    getDb().select().from(sponsors).orderBy(desc(sponsors.createdAt)).limit(40),
    getDb()
      .select()
      .from(partnerOffers)
      .where(eq(partnerOffers.active, true))
      .orderBy(desc(partnerOffers.createdAt))
      .limit(80),
    getDb()
      .select()
      .from(offerClicks)
      .where(eq(offerClicks.userId, userId))
      .orderBy(desc(offerClicks.createdAt))
      .limit(20),
  ]);

  return {
    userId,
    sponsors: sponsorRows,
    offers: offerRows,
    recentClicks: clickRows,
    ownedSponsors: sponsorRows.filter((sponsor) => sponsor.ownerUserId === userId),
  };
}

export async function createSponsor(input: {
  name: string;
  websiteUrl?: string | null;
  contactEmail?: string | null;
}) {
  await requireAdminUser();
  const userId = await requireCurrentUserId();
  const name = cleanRequired(input.name, "New sponsor").slice(0, 160);
  const slug = await uniqueSponsorSlug(name);
  const [sponsor] = await getDb()
    .insert(sponsors)
    .values({
      ownerUserId: userId,
      name,
      slug,
      websiteUrl: nullableClean(input.websiteUrl),
      contactEmail: nullableClean(input.contactEmail),
      status: "prospect",
      updatedAt: new Date(),
    })
    .returning();

  revalidatePartners();
  return sponsor;
}

export async function createPartnerOffer(input: {
  sponsorId: string;
  title: string;
  description?: string | null;
  offerType: string;
  targetContext?: string | null;
  offerUrl?: string | null;
  couponCode?: string | null;
}) {
  await requireAdminUser();
  const userId = await requireCurrentUserId();
  const [sponsor] = await getDb()
    .select()
    .from(sponsors)
    .where(eq(sponsors.id, input.sponsorId))
    .limit(1);

  if (!sponsor || sponsor.ownerUserId !== userId) {
    throw new Error("Sponsor not found.");
  }

  await getDb()
    .insert(partnerOffers)
    .values({
      sponsorId: sponsor.id,
      title: cleanRequired(input.title, "Partner offer").slice(0, 160),
      description: nullableClean(input.description),
      offerType: cleanRequired(input.offerType, "affiliate").slice(0, 40),
      targetContext: nullableClean(input.targetContext)?.slice(0, 80) ?? null,
      offerUrl: nullableClean(input.offerUrl),
      couponCode: nullableClean(input.couponCode)?.slice(0, 80) ?? null,
      active: true,
      updatedAt: new Date(),
    });

  revalidatePartners();
}

export async function recordOfferClick(offerId: string, source?: string | null) {
  const userId = await requireCurrentUserId();
  await getDb()
    .insert(offerClicks)
    .values({
      offerId,
      userId,
      source: nullableClean(source)?.slice(0, 80) ?? null,
    });
  revalidatePartners();
}

async function uniqueSponsorSlug(name: string) {
  const base = normalizeSlug(name) || "sponsor";

  for (let index = 0; index < 12; index += 1) {
    const slug = index === 0 ? base : `${base.slice(0, 68)}-${index}`;
    const [existing] = await getDb()
      .select({ id: sponsors.id })
      .from(sponsors)
      .where(eq(sponsors.slug, slug))
      .limit(1);

    if (!existing) {
      return slug;
    }
  }

  return `${base.slice(0, 64)}-${Date.now().toString(36).slice(-6)}`;
}

function normalizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function nullableClean(value: string | null | undefined) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function cleanRequired(value: string | null | undefined, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function revalidatePartners() {
  revalidatePath("/partners");
  revalidatePath("/challenges");
  revalidatePath("/feed");
}
