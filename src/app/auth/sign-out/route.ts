import { NextResponse } from "next/server";

import { createSupabaseServerClient, isSupabaseAuthConfigured } from "@/lib/supabase/server";

export async function POST(request: Request) {
  if (isSupabaseAuthConfigured()) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }

  const response = NextResponse.redirect(new URL("/login", request.url), { status: 303 });
  response.headers.set("Clear-Site-Data", '"cache"');
  response.headers.set("Cache-Control", "no-store");
  return response;
}
