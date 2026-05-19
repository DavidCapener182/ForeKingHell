import { NextRequest, NextResponse } from "next/server";

import { ensureUserProfile } from "@/lib/current-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
  } = await supabase.auth.getUser();

  if (user) {
    await ensureUserProfile({
      id: user.id,
      email: user.email ?? null,
      name:
        stringMetadata(user.user_metadata?.name) ??
        stringMetadata(user.user_metadata?.full_name) ??
        stringMetadata(user.user_metadata?.display_name),
    });
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin));
}

function safeNextPath(value: string) {
  return value.startsWith("/") && !value.startsWith("//") ? value : null;
}

function stringMetadata(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
