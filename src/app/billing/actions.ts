"use server";

import { redirect } from "next/navigation";

import {
  billingIntervals,
  createCheckoutSession,
  createCustomerPortalSession,
  type BillingInterval,
  type PlanKey,
} from "@/lib/billing";
import { getSiteOrigin } from "@/lib/site-origin";

export async function createCheckoutAction(formData: FormData) {
  const planKey = parsePlanKey(formData.get("planKey"));
  const interval = parseInterval(formData.get("interval"));
  const origin = getSiteOrigin();
  const result = await createCheckoutSession({ planKey, interval, origin });

  redirect(result.url);
}

export async function openCustomerPortalAction() {
  const result = await createCustomerPortalSession(getSiteOrigin());
  redirect(result.url);
}

function parsePlanKey(value: FormDataEntryValue | null): PlanKey {
  return value === "plus" || value === "pro" || value === "coach" ? value : "free";
}

function parseInterval(value: FormDataEntryValue | null): BillingInterval {
  return billingIntervals.includes(value as BillingInterval)
    ? (value as BillingInterval)
    : "monthly";
}
