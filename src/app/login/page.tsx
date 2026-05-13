import { redirect } from "next/navigation";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";

import { LoginForm } from "@/app/login/login-form";
import { PageShell, StatusPill } from "@/components/premium";
import { PageArtwork } from "@/components/visuals/page-artwork";
import { getOptionalCurrentUserId } from "@/lib/current-user";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const userId = await getOptionalCurrentUserId();
  const params = await searchParams;

  if (userId) {
    redirect(safeNextPath(first(params.next)) ?? "/dashboard");
  }

  return (
    <PageShell size="6xl" className="lg:grid lg:place-items-center">
      <div className="grid w-full max-w-5xl gap-5 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <header className="premium-hero order-2 hidden p-5 text-slate-950 sm:p-8 lg:order-1 lg:block">
          <StatusPill tone="green">Secure access</StatusPill>
          <h2 className="mt-4 text-2xl font-semibold tracking-normal text-balance sm:text-4xl lg:text-5xl">
            Sign in to ForeKingHell
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600 sm:text-base sm:leading-7">
            Your shot data, rounds, equipment, coaching notes, achievements, and course maps are now scoped to your Supabase account.
          </p>
          <Link href="/privacy" className="mt-3 inline-flex text-sm font-medium text-emerald-700 underline-offset-4 hover:underline">
            Read the data notice
          </Link>
          <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_15rem] lg:items-stretch">
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              {["Private data", "Coach sharing", "PWA sync"].map((item) => (
                <div key={item} className="apple-panel-strong p-3">
                  <ShieldCheck className="size-4 text-emerald-600" />
                  <p className="mt-2 text-sm font-medium text-slate-900">{item}</p>
                </div>
              ))}
            </div>
            <PageArtwork
              variant="hole"
              alt=""
              className="h-full min-h-44 rounded-2xl"
              sizes="240px"
            />
          </div>
        </header>

        <section className="premium-card order-1 p-5 text-slate-950 sm:p-6 lg:order-2">
          <div className="mb-4">
            <h1 className="text-2xl font-semibold tracking-normal sm:text-3xl">
              <span className="lg:hidden">Sign in to ForeKingHell</span>
              <span className="hidden lg:inline">Continue</span>
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Use email magic link first, or connect Google/Apple once those providers are enabled in Supabase.
            </p>
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50/70 px-3 py-2 text-xs font-medium text-emerald-800 lg:hidden">
              <ShieldCheck className="size-4" />
              Private shot data, coach sharing, and PWA sync stay scoped to your account.
            </div>
          </div>
          <LoginForm error={first(params.error) || null} next={safeNextPath(first(params.next))} />
          <details className="mt-4 rounded-xl border border-slate-200 bg-white/80 lg:hidden">
            <summary className="min-h-11 cursor-pointer list-none px-3 py-2 text-sm font-semibold [&::-webkit-details-marker]:hidden">
              Why sign in?
            </summary>
            <div className="border-t border-slate-200 px-3 py-2 text-sm leading-6 text-slate-600">
              Your rounds, imports, equipment, achievements, and coaching context are private to your Supabase account.
            </div>
          </details>
        </section>
      </div>
    </PageShell>
  );
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function safeNextPath(value: string) {
  return value.startsWith("/") && !value.startsWith("//") ? value : null;
}
