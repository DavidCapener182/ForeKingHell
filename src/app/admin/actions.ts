"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
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

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
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
