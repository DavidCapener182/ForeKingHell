import { NextResponse } from "next/server";

import {
  clearSupabaseAuthCookies,
  createSupabaseServerClient,
  isSupabaseAuthConfigured,
} from "@/lib/supabase/server";
import { SELECTED_COURSE_COOKIE } from "@/lib/selected-course";

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
  response.cookies.delete(SELECTED_COURSE_COOKIE);
  response.headers.set("Clear-Site-Data", '"cache"');
  response.headers.set("Cache-Control", "no-store");
  return response;
}
