"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { BRAND_NAME } from "@/lib/brand";
import { ensureUserProfile } from "@/lib/current-user";
import {
  clearSupabaseAuthCookies,
  createSupabaseServerClient,
  isSupabaseAuthConfigured,
} from "@/lib/supabase/server";

export type LoginActionState = {
  message: string | null;
  status: "idle" | "success" | "error";
};

export async function sendMagicLinkAction(
  _previousState: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  if (!isSupabaseAuthConfigured()) {
    return {
      status: "error",
      message:
        "Supabase Auth is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    };
  }

  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const next = safeNextPath(String(formData.get("next") ?? "")) ?? "/dashboard";

  if (!email) {
    return { status: "error", message: "Enter an email address." };
  }

  await clearSupabaseAuthCookies();
  const supabase = await createSupabaseServerClient();
  const redirectTo = new URL("/auth/callback", await siteOrigin());
  redirectTo.searchParams.set("next", next);
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectTo.toString(),
      shouldCreateUser: true,
    },
  });

  if (error) {
    return { status: "error", message: error.message };
  }

  return {
    status: "success",
    message: `Check your email for the ${BRAND_NAME} sign-in link.`,
  };
}

export async function signInWithPasswordAction(
  _previousState: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  if (!isSupabaseAuthConfigured()) {
    return {
      status: "error",
      message:
        "Supabase Auth is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    };
  }

  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const nextRaw = String(formData.get("next") ?? "");
  const next = safeNextPath(nextRaw) ?? "/dashboard";

  if (!email || !password) {
    return { status: "error", message: "Enter your email and password." };
  }

  await clearSupabaseAuthCookies();
  const supabase = await createSupabaseServerClient();
  let authResult: Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>;
  try {
    authResult = await supabase.auth.signInWithPassword({ email, password });
  } catch (error) {
    console.error("[login] Password sign-in request failed", error);
    return {
      status: "error",
      message: "Sign-in could not reach the auth service. Try again in a moment.",
    };
  }

  const { data, error } = authResult;

  if (error || !data.user) {
    return {
      status: "error",
      message: error?.message ?? "Invalid email or password.",
    };
  }

  const authUser = {
    id: data.user.id,
    email: data.user.email ?? null,
    name:
      stringMetadata(data.user.user_metadata?.name) ??
      stringMetadata(data.user.user_metadata?.full_name) ??
      stringMetadata(data.user.user_metadata?.display_name),
  };

  try {
    await ensureUserProfile(authUser);
  } catch (error) {
    console.error("[login] Profile setup failed after password sign-in", error);
    try {
      await supabase.auth.signOut();
    } catch (signOutError) {
      console.error("[login] Failed to clear session after profile setup error", signOutError);
    }
    await clearSupabaseAuthCookies();

    return {
      status: "error",
      message:
        "Your password was accepted, but your golf profile could not be loaded. Try again in a moment.",
    };
  }

  redirect(next);
}

export async function signInWithOAuthAction(formData: FormData) {
  if (!isSupabaseAuthConfigured()) {
    redirect("/login?error=Supabase%20Auth%20is%20not%20configured");
  }

  const provider = String(formData.get("provider") ?? "");
  const next = safeNextPath(String(formData.get("next") ?? "")) ?? "/dashboard";

  if (provider !== "google" && provider !== "apple") {
    redirect("/login?error=Unsupported%20auth%20provider");
  }

  await clearSupabaseAuthCookies();
  const supabase = await createSupabaseServerClient();
  const redirectTo = new URL("/auth/callback", await siteOrigin());
  redirectTo.searchParams.set("next", next);
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: redirectTo.toString(),
    },
  });

  if (error || !data.url) {
    redirect(`/login?error=${encodeURIComponent(error?.message ?? "OAuth sign-in failed")}`);
  }

  redirect(data.url);
}

async function siteOrigin() {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) {
    return explicit.replace(/\/$/, "");
  }

  const headerStore = await headers();
  const proto = headerStore.get("x-forwarded-proto") ?? "http";
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host") ?? "localhost:3000";

  return `${proto}://${host}`;
}

function stringMetadata(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function safeNextPath(value: string) {
  return value.startsWith("/") && !value.startsWith("//") ? value : null;
}
