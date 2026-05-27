import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { LockKeyhole, ShieldCheck, Trophy, Zap } from "lucide-react";

import { LoginForm } from "@/app/login/login-form";
import { BrandMark } from "@/components/brand-mark";
import { PageShell, StatusPill } from "@/components/premium";
import { BRAND_NAME } from "@/lib/brand";
import { getOptionalCurrentUserId } from "@/lib/current-user";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const userId = await getOptionalCurrentUserId();
  const params = await searchParams;

  if (userId) {
    redirect(safeNextPath(first(params.next)) ?? "/dashboard");
  }

  return (
    <PageShell
      size="full"
      className="relative isolate overflow-hidden bg-[#07110B] px-0 py-0 pb-0 text-white sm:px-0 sm:pb-0 sm:pt-0 lg:px-0"
      contentClassName="relative min-h-screen w-screen !max-w-none gap-0 overflow-hidden"
    >
      <Image
        src="/assets/hole-350-aerial.jpg"
        alt=""
        fill
        priority
        sizes="100vw"
        className="-z-20 object-cover object-[center_34%] opacity-80 saturate-[1.05] brightness-[0.72]"
      />
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(110deg,rgba(5,12,7,0.9)_0%,rgba(5,12,7,0.76)_42%,rgba(5,12,7,0.42)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 -z-10 h-1/2 bg-[linear-gradient(0deg,rgba(5,12,7,0.92),rgba(5,12,7,0))]" />

      <div className="mx-auto grid min-h-screen w-full max-w-none items-center gap-8 px-5 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_460px] lg:px-8 xl:px-10">
        <header className="order-2 grid gap-7 py-6 lg:order-1 lg:py-10">
          <div className="inline-flex w-fit items-center gap-2 rounded-lg border border-white/20 bg-[#07110B]/70 px-3 py-2 text-sm font-medium text-white">
            <BrandMark className="size-12 rounded-md" sizes="48px" priority />
            {BRAND_NAME}
          </div>

          <div className="max-w-2xl">
            <StatusPill tone="green">Private golf analytics</StatusPill>
            <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight tracking-normal text-white text-balance sm:text-5xl lg:text-6xl">
              Your rounds, records and range work in one clubhouse.
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-white/78 sm:text-lg">
              Sign in or create an account to keep scorecards, practice sessions, PBs and course
              records tied to your own golf profile.
            </p>
            <Link
              href="/privacy"
              className="mt-5 inline-flex text-sm font-semibold text-emerald-100 underline-offset-4 hover:underline"
            >
              Read the data notice
            </Link>
          </div>

          <div className="grid max-w-2xl gap-3 sm:grid-cols-3">
            <GolfProof
              icon={<LockKeyhole className="size-4" />}
              label="Private by default"
              value="Your shot data stays scoped to your account."
            />
            <GolfProof
              icon={<Zap className="size-4" />}
              label="Practice ready"
              value="Import sessions and turn range work into progress."
            />
            <GolfProof
              icon={<Trophy className="size-4" />}
              label="Record chasing"
              value="Track PBs, achievements and course records."
            />
          </div>
        </header>

        <section className="relative order-1 overflow-hidden rounded-lg border border-white/20 bg-white p-4 text-slate-950 shadow-2xl shadow-black/30 sm:p-5 lg:order-2">
          <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#0B7A3B,#A7F3D0,#C7972B)]" />
          <div className="mb-5 rounded-lg border border-emerald-100 bg-emerald-50/70 p-4">
            <div className="flex items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[#0B7A3B] text-white">
                <ShieldCheck className="size-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <h2 className="text-2xl font-semibold tracking-normal">Sign in or join</h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Use email and password, Google, Apple or a secure email link.
                </p>
              </div>
            </div>
          </div>
          <LoginForm error={first(params.error) || null} next={safeNextPath(first(params.next))} />
        </section>
      </div>
    </PageShell>
  );
}

function GolfProof({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/20 bg-[#07110B]/58 p-3 text-white shadow-sm">
      <div className="flex items-center gap-2 text-emerald-100">
        {icon}
        <p className="text-sm font-semibold">{label}</p>
      </div>
      <p className="mt-2 text-sm leading-5 text-white/72">{value}</p>
    </div>
  );
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function safeNextPath(value: string) {
  return value.startsWith("/") && !value.startsWith("//") ? value : null;
}
