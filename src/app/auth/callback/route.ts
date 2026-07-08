import { NextRequest, NextResponse } from "next/server";

import { ensureUserProfile } from "@/lib/current-user";
import { clearSupabaseAuthCookies, createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = safeNextPath(requestUrl.searchParams.get("next") ?? "") ?? "/dashboard";

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=Missing%20auth%20code", requestUrl.origin));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message)}`, requestUrl.origin),
    );
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error("[auth] Session user lookup failed after callback sign-in", userError);
    await clearCallbackSession(supabase);
    return loginErrorRedirect(
      requestUrl,
      "Your sign-in was accepted, but the session could not be loaded. Try again in a moment.",
      next,
    );
  }

  try {
    await ensureUserProfile({
      id: user.id,
      email: user.email ?? null,
      name:
        stringMetadata(user.user_metadata?.name) ??
        stringMetadata(user.user_metadata?.full_name) ??
        stringMetadata(user.user_metadata?.display_name),
    });
  } catch (error) {
    console.error("[auth] Profile setup failed after callback sign-in", error);
    await clearCallbackSession(supabase);
    return loginErrorRedirect(
      requestUrl,
      "Your sign-in was accepted, but your golf profile could not be loaded. Try again in a moment.",
      next,
    );
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin));
}

async function clearCallbackSession(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
) {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("[auth] Supabase sign-out failed after callback setup error", error);
    }
  } catch (error) {
    console.error("[auth] Failed to clear callback session after setup error", error);
  }

  await clearSupabaseAuthCookies();
}

function loginErrorRedirect(requestUrl: URL, message: string, next: string) {
  const url = new URL("/login", requestUrl.origin);
  url.searchParams.set("error", message);
  if (next !== "/dashboard") {
    url.searchParams.set("next", next);
  }
  return NextResponse.redirect(url);
}

function safeNextPath(value: string) {
  return value.startsWith("/") && !value.startsWith("//") ? value : null;
}

function stringMetadata(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
