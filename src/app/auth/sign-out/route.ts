import { NextResponse } from "next/server";

import { createSupabaseServerClient, isSupabaseAuthConfigured } from "@/lib/supabase/server";

export async function POST(request: Request) {
  if (isSupabaseAuthConfigured()) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }

  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}
