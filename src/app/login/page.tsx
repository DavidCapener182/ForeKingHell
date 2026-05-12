import { redirect } from "next/navigation";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";

import { LoginForm } from "@/app/login/login-form";
import { PageShell, StatusPill } from "@/components/premium";
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
        <header className="premium-hero order-2 p-5 sm:p-8 lg:order-1">
          <StatusPill tone="green">Secure access</StatusPill>
          <h2 className="mt-4 text-2xl font-semibold tracking-normal text-balance sm:text-4xl lg:text-5xl">
            Sign in to ForeKingHell
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7">
            Your shot data, rounds, equipment, coaching notes, achievements, and course maps are now scoped to your Supabase account.
          </p>
          <Link href="/privacy" className="mt-3 inline-flex text-sm font-medium text-emerald-700 underline-offset-4 hover:underline">
            Read the data notice
          </Link>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {["Private data", "Coach sharing", "PWA sync"].map((item) => (
              <div key={item} className="apple-panel-strong p-3">
                <ShieldCheck className="size-4 text-emerald-600" />
                <p className="mt-2 text-sm font-medium">{item}</p>
              </div>
            ))}
          </div>
        </header>

        <section className="premium-card order-1 p-5 sm:p-6 lg:order-2">
          <div className="mb-4">
            <h1 className="text-2xl font-semibold tracking-normal sm:text-3xl">
              <span className="lg:hidden">Sign in to ForeKingHell</span>
              <span className="hidden lg:inline">Continue</span>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Use email magic link first, or connect Google/Apple once those providers are enabled in Supabase.
            </p>
          </div>
          <LoginForm error={first(params.error) || null} />
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
