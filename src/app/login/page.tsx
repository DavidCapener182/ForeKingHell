import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { LockKeyhole, ShieldCheck, Trophy, Zap } from "lucide-react";

import { LoginForm } from "@/app/login/login-form";
import { BrandMark } from "@/components/brand-mark";
import { PageShell, StatusPill } from "@/components/premium";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { BRAND_NAME } from "@/lib/brand";
import { getOptionalCurrentUserId } from "@/lib/current-user";
import { safeNextPath } from "@/lib/safe-next-path";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const userId = await getOptionalCurrentUserId();
  const params = await searchParams;

  if (userId && first(params.reason) !== "reauth_required") {
    redirect(safeNextPath(first(params.next)) ?? "/dashboard");
  }

  return (
    <PageShell
      size="full"
      className="ios-public-auth relative isolate overflow-hidden bg-[var(--ios-background)] px-0 py-0 pb-0 font-[-apple-system,BlinkMacSystemFont,'SF_Pro_Text','Helvetica_Neue',Arial,sans-serif] text-[var(--ios-label)] sm:px-0 sm:pb-0 sm:pt-0 lg:bg-[#07110B] lg:px-0 lg:font-[var(--font-ui-source)] lg:text-white"
      contentClassName="relative min-h-[100svh] w-full !max-w-none gap-0 overflow-hidden lg:min-h-screen lg:w-screen"
    >
      <Image
        src="/assets/hole-350-aerial.jpg"
        alt=""
        fill
        loading="eager"
        fetchPriority="high"
        sizes="(max-width: 1023px) 1px, 100vw"
        className="-z-20 hidden object-cover object-[center_34%] opacity-80 saturate-[1.05] brightness-[0.72] lg:block"
      />
      <div className="absolute inset-0 -z-10 hidden bg-[linear-gradient(110deg,rgba(5,12,7,0.9)_0%,rgba(5,12,7,0.76)_42%,rgba(5,12,7,0.42)_100%)] lg:block" />
      <div className="absolute inset-x-0 bottom-0 -z-10 hidden h-1/2 bg-[linear-gradient(0deg,rgba(5,12,7,0.92),rgba(5,12,7,0))] lg:block" />

      <div className="mx-auto grid min-h-[100svh] w-full max-w-none content-start gap-5 px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-6 lg:min-h-screen lg:grid-cols-[minmax(0,1fr)_460px] lg:content-normal lg:items-center lg:gap-8 lg:px-8 lg:py-8 xl:px-10">
        <header className="grid gap-4 lg:hidden">
          <Link
            href="/"
            className="inline-flex min-h-11 w-fit items-center gap-2 rounded-[10px] text-[15px] font-semibold tracking-[-0.01em] text-[var(--ios-label)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--ios-tint)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--ios-background)]"
            aria-label={`${BRAND_NAME} home`}
          >
            <BrandMark className="size-9 rounded-[9px]" sizes="36px" priority />
            {BRAND_NAME}
          </Link>

          <div className="max-w-xl pb-1">
            <h1 className="text-[2.125rem] font-bold leading-[1.08] tracking-[-0.03em] text-[var(--ios-label)] text-balance sm:text-[2.5rem]">
              Sign in or join.
            </h1>
            <p className="mt-2 max-w-lg text-[17px] leading-[1.47] tracking-[-0.01em] text-[var(--ios-secondary-label)]">
              Your rounds, records and range work in one clubhouse.
            </p>
          </div>
        </header>

        <header className="order-2 hidden gap-7 py-6 lg:order-1 lg:grid lg:py-10">
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

        <section
          className="relative order-2 overflow-hidden rounded-[14px] bg-[var(--ios-grouped-surface)] p-4 text-[var(--ios-label)] shadow-none sm:p-5 lg:order-2 lg:rounded-lg lg:border lg:border-white/20 lg:bg-white lg:text-slate-950 lg:shadow-2xl lg:shadow-black/30"
          aria-label="Sign in options"
        >
          <div className="absolute inset-x-0 top-0 hidden h-1 bg-[linear-gradient(90deg,#0B7A3B,#A7F3D0,#C7972B)] lg:block" />
          <div className="mb-5 hidden rounded-lg border border-emerald-100 bg-emerald-50/70 p-4 lg:block">
            <div className="flex items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-[var(--ios-fill)] text-[var(--ios-tint)] lg:rounded-lg lg:bg-[#0B7A3B] lg:text-white">
                <ShieldCheck className="size-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <h2 className="text-[1.375rem] font-semibold leading-7 tracking-[-0.02em] lg:text-2xl lg:leading-8 lg:tracking-normal">
                  Sign in or join
                </h2>
                <p className="mt-0.5 text-[15px] leading-5 text-[var(--ios-secondary-label)] lg:mt-1 lg:text-sm lg:leading-6 lg:text-slate-600">
                  Use email and password, Google, Apple or a secure email link.
                </p>
              </div>
            </div>
          </div>
          {first(params.reason) === "session_expired" ? (
            <Alert className="mb-4">
              <LockKeyhole className="size-4" />
              <AlertTitle>Your session expired</AlertTitle>
              <AlertDescription>
                Sign in again to continue. The page you were opening has been preserved.
              </AlertDescription>
            </Alert>
          ) : null}
          {first(params.reason) === "reauth_required" ? (
            <Alert className="mb-4">
              <ShieldCheck className="size-4" />
              <AlertTitle>Confirm it is you</AlertTitle>
              <AlertDescription>
                Sign in again before permanently deleting this account.
              </AlertDescription>
            </Alert>
          ) : null}
          {first(params.accountDeleted) ? (
            <Alert className="mb-4">
              <ShieldCheck className="size-4" />
              <AlertTitle>Account permanently deleted</AlertTitle>
              <AlertDescription>
                Your deletion receipt is {first(params.receipt) || "available in this confirmation"}
                . Keep it if you need to contact support.
              </AlertDescription>
            </Alert>
          ) : null}
          <LoginForm error={first(params.error) || null} next={safeNextPath(first(params.next))} />
        </section>

        <section
          className="order-3 grid gap-3 pb-2 lg:hidden"
          aria-labelledby="account-data-heading"
        >
          <div className="flex items-end justify-between gap-4 px-1">
            <h2
              id="account-data-heading"
              className="text-[20px] font-semibold leading-6 tracking-[-0.02em] text-[var(--ios-label)]"
            >
              Your golf profile
            </h2>
            <Link
              href="/privacy"
              className="min-h-11 content-center text-[15px] font-medium text-[var(--ios-link)] underline-offset-4 focus-visible:rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ios-tint)]"
            >
              Data notice
            </Link>
          </div>
          <div className="overflow-hidden rounded-[14px] bg-[var(--ios-grouped-surface)]">
            <GolfProof
              mobile
              icon={<LockKeyhole className="size-[18px]" />}
              label="Private by default"
              value="Your shot data stays scoped to your account."
            />
            <GolfProof
              mobile
              icon={<Zap className="size-[18px]" />}
              label="Practice ready"
              value="Import sessions and turn range work into progress."
            />
            <GolfProof
              mobile
              icon={<Trophy className="size-[18px]" />}
              label="Record chasing"
              value="Track PBs, achievements and course records."
            />
          </div>
        </section>
      </div>
    </PageShell>
  );
}

function GolfProof({
  icon,
  label,
  value,
  mobile = false,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  mobile?: boolean;
}) {
  if (mobile) {
    return (
      <div className="grid min-h-[4.5rem] grid-cols-[2rem_minmax(0,1fr)] gap-3 border-b border-[var(--ios-separator)] px-4 py-3 last:border-b-0">
        <span className="grid size-8 place-items-center self-start rounded-[9px] bg-[var(--ios-fill)] text-[var(--ios-tint)]">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-[15px] font-semibold leading-5 tracking-[-0.01em] text-[var(--ios-label)]">
            {label}
          </p>
          <p className="mt-0.5 text-[15px] leading-5 text-[var(--ios-secondary-label)]">{value}</p>
        </div>
      </div>
    );
  }

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
