"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";

import {
  resolveAdminGrantTarget,
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

export async function adminFormAction(
  _previous: { ok: boolean; error?: string; message?: string; resolvedCount?: number },
  formData: FormData,
): Promise<{ ok: boolean; error?: string; message?: string; resolvedCount?: number }> {
  try {
    const operation = readString(formData, "operation");
    let message: string;
    let resolvedCount: number | undefined;
    const required = (key: string) => {
      const value = readString(formData, key);
      if (!value) throw new Error(`Missing ${key}.`);
      return value;
    };
    switch (operation) {
      case "grant-admin": {
        const role = readString(formData, "role");
        if (role !== "owner" && role !== "operator") throw new Error("Choose a valid admin role.");
        await grantAdminAccessByEmail(
          required("email"),
          role,
          readString(formData, "userId") || undefined,
        );
        message = "Admin access granted.";
        break;
      }
      case "grant-lifetime":
        await grantLifetimeFullAccessByEmail(
          required("email"),
          readString(formData, "userId") || undefined,
        );
        message = "Lifetime full access granted.";
        break;
      case "deactivate-admin":
        await deactivateAdminAccess(required("userId"));
        message = "Admin access deactivated.";
        break;
      case "resolve-report":
        await resolveSocialReport(required("reportId"));
        message = "Report resolved.";
        break;
      case "resolve-event":
        await resolveModerationEvent(required("eventId"));
        message = "Moderation event resolved.";
        break;
      case "bulk-resolve-reports":
        resolvedCount = await bulkResolveSocialReports(readStrings(formData, "reportId"));
        message = `${resolvedCount} ${resolvedCount === 1 ? "report" : "reports"} resolved.`;
        break;
      case "bulk-resolve-events":
        resolvedCount = await bulkResolveModerationEvents(readStrings(formData, "eventId"));
        message = `${resolvedCount} ${resolvedCount === 1 ? "moderation event" : "moderation events"} resolved.`;
        break;
      default:
        throw new Error("Choose a valid admin action.");
    }
    revalidateAdminPaths();
    revalidatePath("/admin/moderation");
    return { ok: true, message, ...(resolvedCount === undefined ? {} : { resolvedCount }) };
  } catch (error) {
    unstable_rethrow(error);
    return { ok: false, error: safeAdminFormError(error) };
  }
}

function safeAdminFormError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const allowed = new Set([
    "Owner access is required.",
    "Active admin access is required.",
    "This account has changed. Refresh its details before trying again.",
    "No user exists for that email address.",
    "Choose a valid admin role.",
    "The last active owner cannot be demoted.",
    "You cannot deactivate your own admin access.",
    "Active admin access was not found.",
    "The last active owner cannot be deactivated.",
    "Report not found.",
    "Select at least one open report.",
    "No selected open reports could be resolved.",
    "Moderation event not found.",
    "Select at least one open moderation event.",
    "No selected open moderation events could be resolved.",
    "Choose a valid admin action.",
    "Missing email.",
    "Missing userId.",
    "Missing reportId.",
    "Missing eventId.",
  ]);
  return allowed.has(message) ? message : "The admin action could not be completed. Try again.";
}

export async function resolveAdminGrantTargetAction(formData: FormData): Promise<{
  ok: boolean;
  target?: { id: string; displayName: string; email: string };
  error?: string;
}> {
  try {
    const target = await resolveAdminGrantTarget(readString(formData, "email"));
    return { ok: true, target };
  } catch (error) {
    unstable_rethrow(error);
    return { ok: false, error: safeAdminFormError(error) };
  }
}
