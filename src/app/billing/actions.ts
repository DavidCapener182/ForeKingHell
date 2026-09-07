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

export async function createCheckoutFormAction(
  _previous: { ok: boolean; error?: string; url?: string }, formData: FormData,
): Promise<{ ok: boolean; error?: string; url?: string }> {
  try {
    const plan = formData.get("planKey");
    const interval = formData.get("interval");
    if (plan !== "plus" && plan !== "pro" && plan !== "coach") return { ok: false, error: "Choose an available paid plan." };
    if (interval !== "monthly" && interval !== "yearly") return { ok: false, error: "Choose monthly or yearly billing." };
    const result = await createCheckoutSession({ planKey: plan, interval, origin: getSiteOrigin() });
    if (result.error) return { ok: false, error: "Could not start checkout. Your plan has not changed. Try again later." };
    return { ok: true, url: result.url };
  } catch {
    return { ok: false, error: "Could not start checkout. Your plan has not changed. Try again later." };
  }
}

export async function openCustomerPortalFormAction(
  _previous: { ok: boolean; error?: string; url?: string }, _formData: FormData,
): Promise<{ ok: boolean; error?: string; url?: string }> {
  void _previous;
  void _formData;
  try {
    const result = await createCustomerPortalSession(getSiteOrigin());
    if (result.error) return { ok: false, error: "Could not open billing management. Try again later." };
    return { ok: true, url: result.url };
  } catch {
    return { ok: false, error: "Could not open billing management. Try again later." };
  }
}
