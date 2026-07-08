import { NextResponse } from "next/server";

import {
  clearSupabaseAuthCookies,
  createSupabaseServerClient,
  isSupabaseAuthConfigured,
} from "@/lib/supabase/server";

export async function POST(request: Request) {
  if (isSupabaseAuthConfigured()) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("[auth] Supabase sign-out failed while clearing local session", error);
    }

    await clearSupabaseAuthCookies();
  }

  const response = NextResponse.redirect(new URL("/login", request.url), { status: 303 });
  response.headers.set("Clear-Site-Data", '"cache"');
  response.headers.set("Cache-Control", "no-store");
  return response;
}
