"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";

import {
  bulkResolveModerationEvents,
  bulkResolveSocialReports,
  deactivateAdminAccess,
  grantAdminAccessByEmail,
  grantLifetimeFullAccessByEmail,
  resolveModerationEvent,
  resolveSocialReport,
  type AdminRole,
} from "@/lib/admin";

export async function grantLifetimeFullAction(formData: FormData) {
  const email = readString(formData, "email");
  const returnTo = safeReturnTo(readString(formData, "returnTo")) ?? "/admin/billing";

  try {
    await grantLifetimeFullAccessByEmail(email);
  } catch (error) {
    unstable_rethrow(error);
    redirect(`${returnTo}?adminError=${encodeURIComponent(errorMessage(error))}`);
  }

  revalidateAdminPaths();
  redirect(`${returnTo}?adminStatus=${encodeURIComponent("Lifetime full access granted.")}`);
}

export async function grantAdminAccessAction(formData: FormData) {
  const email = readString(formData, "email");
  const role = parseAdminRole(readString(formData, "role"));
  const returnTo = safeReturnTo(readString(formData, "returnTo")) ?? "/admin/users";

  try {
    await grantAdminAccessByEmail(email, role);
  } catch (error) {
    unstable_rethrow(error);
    redirect(`${returnTo}?adminError=${encodeURIComponent(errorMessage(error))}`);
  }

  revalidateAdminPaths();
  redirect(`${returnTo}?adminStatus=${encodeURIComponent("Admin access granted.")}`);
}

export async function deactivateAdminAccessAction(formData: FormData) {
  const userId = readString(formData, "userId");

  try {
    await deactivateAdminAccess(userId);
  } catch (error) {
    unstable_rethrow(error);
    redirect(`/admin/users?adminError=${encodeURIComponent(errorMessage(error))}`);
  }

  revalidateAdminPaths();
  redirect(`/admin/users?adminStatus=${encodeURIComponent("Admin access deactivated.")}`);
}

export async function resolveSocialReportAction(formData: FormData) {
  await resolveSocialReport(readString(formData, "reportId"));
  revalidatePath("/admin/moderation");
  redirect(`/admin/moderation?adminStatus=${encodeURIComponent("Report resolved.")}`);
}

export async function resolveModerationEventAction(formData: FormData) {
  await resolveModerationEvent(readString(formData, "eventId"));
  revalidatePath("/admin/moderation");
  redirect(`/admin/moderation?adminStatus=${encodeURIComponent("Moderation event resolved.")}`);
}

export async function bulkResolveSocialReportsAction(formData: FormData) {
  let resolvedCount = 0;

  try {
    resolvedCount = await bulkResolveSocialReports(readStrings(formData, "reportId"));
  } catch (error) {
    unstable_rethrow(error);
    redirect(`/admin/moderation?adminError=${encodeURIComponent(errorMessage(error))}`);
  }

  revalidatePath("/admin/moderation");
  redirect(
    `/admin/moderation?adminStatus=${encodeURIComponent(
      `${resolvedCount} ${resolvedCount === 1 ? "report" : "reports"} resolved.`,
    )}`,
  );
}

export async function bulkResolveModerationEventsAction(formData: FormData) {
  let resolvedCount = 0;

  try {
    resolvedCount = await bulkResolveModerationEvents(readStrings(formData, "eventId"));
  } catch (error) {
    unstable_rethrow(error);
    redirect(`/admin/moderation?adminError=${encodeURIComponent(errorMessage(error))}`);
  }

  revalidatePath("/admin/moderation");
  redirect(
    `/admin/moderation?adminStatus=${encodeURIComponent(
      `${resolvedCount} ${resolvedCount === 1 ? "moderation event" : "moderation events"} resolved.`,
    )}`,
  );
}

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readStrings(formData: FormData, key: string) {
  return formData
    .getAll(key)
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean);
}

function parseAdminRole(value: string): AdminRole {
  return value === "owner" ? "owner" : "operator";
}

function safeReturnTo(value: string) {
  return value.startsWith("/admin") ? value : null;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "The admin action could not be completed.";
}

function revalidateAdminPaths() {
  revalidatePath("/admin");
  revalidatePath("/admin/users");
  revalidatePath("/admin/billing");
  revalidatePath("/billing");
}
