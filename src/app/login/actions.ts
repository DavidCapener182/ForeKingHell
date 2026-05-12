"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createSupabaseServerClient, isSupabaseAuthConfigured } from "@/lib/supabase/server";

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
      message: "Supabase Auth is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    };
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!email) {
    return { status: "error", message: "Enter an email address." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${await requestOrigin()}/auth/callback`,
      shouldCreateUser: true,
    },
  });

  if (error) {
    return { status: "error", message: error.message };
  }

  return {
    status: "success",
    message: "Check your email for the ForeKingHell sign-in link.",
  };
}

export async function signInWithOAuthAction(formData: FormData) {
  if (!isSupabaseAuthConfigured()) {
    redirect("/login?error=Supabase%20Auth%20is%20not%20configured");
  }

  const provider = String(formData.get("provider") ?? "");

  if (provider !== "google" && provider !== "apple") {
    redirect("/login?error=Unsupported%20auth%20provider");
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${await requestOrigin()}/auth/callback`,
    },
  });

  if (error || !data.url) {
    redirect(`/login?error=${encodeURIComponent(error?.message ?? "OAuth sign-in failed")}`);
  }

  redirect(data.url);
}

async function requestOrigin() {
  const headerStore = await headers();
  const proto = headerStore.get("x-forwarded-proto") ?? "http";
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host") ?? "localhost:3000";

  return `${proto}://${host}`;
}
