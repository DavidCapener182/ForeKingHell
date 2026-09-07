"use server";

import { redirect, unstable_rethrow } from "next/navigation";

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
  const destination = await recordOfferClick(requiredString(formData, "offerId"), formString(formData, "source"));
  redirect(destination ?? "/partners?offer=clicked");
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

export async function partnerFormAction(
  _previous: {ok:boolean;error?:string;message?:string}, data: FormData,
): Promise<{ok:boolean;error?:string;message?:string}> {
  try {
    const operation=formString(data,"operation");
    const limits: Record<string, number> = operation === "sponsor"
      ? { name: 160, contactEmail: 254 }
      : { title: 160, targetContext: 80, couponCode: 80 };
    for (const [field, limit] of Object.entries(limits)) {
      if ((formString(data, field)?.length ?? 0) > limit) {
        return { ok: false, error: `${field} must be ${limit} characters or fewer.` };
      }
    }
    const urlKey=operation==="sponsor"?"websiteUrl":"offerUrl";
    const url=formString(data,urlKey);
    if(url && !safeExternalUrl(url)) return {ok:false,error:"Enter a complete http or https website address."};
    if(operation==="sponsor") {
      const name=formString(data,"name");
      if(!name) return {ok:false,error:"Enter a sponsor name."};
      const contactEmail = formString(data, "contactEmail");
      if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
        return { ok: false, error: "Enter a valid contact email address." };
      }
      await createSponsor({name,websiteUrl:url,contactEmail});
      return {ok:true,message:"Sponsor created."};
    }
    if(operation==="offer") {
      const sponsorId=formString(data,"sponsorId");
      const title=formString(data,"title");
      const offerType=formString(data,"offerType");
      if(!sponsorId||!title) return {ok:false,error:"Choose your sponsor and enter an offer title."};
      if(!offerType||!["affiliate","discount","prize","range_credit"].includes(offerType)) return {ok:false,error:"Choose an available offer type."};
      await createPartnerOffer({sponsorId,title,offerType,description:formString(data,"description"),targetContext:formString(data,"targetContext"),offerUrl:url,couponCode:formString(data,"couponCode")});
      return {ok:true,message:"Offer created."};
    }
    return {ok:false,error:"Choose a valid partner action."};
  } catch(error) {
    unstable_rethrow(error);
    return {ok:false,error:error instanceof Error && error.message==="Sponsor not found."?"That sponsor is unavailable or is not owned by your account.":"The partner changes could not be saved. Try again."};
  }
}
