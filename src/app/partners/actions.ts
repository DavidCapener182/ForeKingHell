"use server";

import { redirect } from "next/navigation";

import { createPartnerOffer, createSponsor, recordOfferClick } from "@/lib/partners";

export async function createSponsorAction(formData: FormData) {
  await createSponsor({
    name: requiredString(formData, "name"),
    websiteUrl: formString(formData, "websiteUrl"),
    contactEmail: formString(formData, "contactEmail"),
  });
  redirect("/partners?sponsor=created");
}

export async function createPartnerOfferAction(formData: FormData) {
  await createPartnerOffer({
    sponsorId: requiredString(formData, "sponsorId"),
    title: requiredString(formData, "title"),
    description: formString(formData, "description"),
    offerType: requiredString(formData, "offerType"),
    targetContext: formString(formData, "targetContext"),
    offerUrl: formString(formData, "offerUrl"),
    couponCode: formString(formData, "couponCode"),
  });
  redirect("/partners?offer=created");
}

export async function recordOfferClickAction(formData: FormData) {
  await recordOfferClick(requiredString(formData, "offerId"), formString(formData, "source"));
  redirect(safeExternalUrl(formString(formData, "offerUrl")) ?? "/partners?offer=clicked");
}

function safeExternalUrl(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function requiredString(formData: FormData, key: string) {
  const value = formString(formData, key);

  if (!value) {
    throw new Error(`${key} is required.`);
  }

  return value;
}

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
