"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  billingIntervals,
  createCheckoutSession,
  createCustomerPortalSession,
  type BillingInterval,
  type PlanKey,
} from "@/lib/billing";

export async function createCheckoutAction(formData: FormData) {
  const planKey = parsePlanKey(formData.get("planKey"));
  const interval = parseInterval(formData.get("interval"));
  const origin = await requestOrigin();
  const result = await createCheckoutSession({ planKey, interval, origin });

  redirect(result.url);
}

export async function openCustomerPortalAction() {
  const result = await createCustomerPortalSession(await requestOrigin());
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

async function requestOrigin() {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) {
    return explicit.replace(/\/$/, "");
  }

  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol =
    requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${protocol}://${host}`;
}
