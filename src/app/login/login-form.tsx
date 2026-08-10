"use client";

import type { ReactNode } from "react";
import { useActionState } from "react";
import { KeyRound, Mail } from "lucide-react";

import {
  sendMagicLinkAction,
  signInWithOAuthAction,
  signInWithPasswordAction,
  type LoginActionState,
} from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const initialState: LoginActionState = {
  message: null,
  status: "idle",
};

export function LoginForm({ error, next }: { error?: string | null; next?: string | null }) {
  const [passwordState, passwordAction, passwordPending] = useActionState(
    signInWithPasswordAction,
    initialState,
  );
  const [magicState, magicAction, magicPending] = useActionState(sendMagicLinkAction, initialState);

  const passwordMessage =
    passwordState.status === "idle" ? error : (passwordState.message ?? error);
  const passwordIsError =
    passwordState.status === "idle" ? Boolean(error) : passwordState.status === "error";
  const magicMessage = magicState.message;
  const magicIsError = magicState.status === "error";

  return (
    <div className="grid gap-6 lg:gap-5">
      <form
        action={passwordAction}
        className="grid gap-3.5 lg:gap-3"
        aria-describedby={passwordMessage ? "password-login-message" : undefined}
        noValidate
      >
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <label
          className="grid gap-2 text-[15px] font-medium text-[var(--ios-label)] lg:text-sm lg:text-slate-800"
          htmlFor="email"
        >
          Email
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="you@example.com"
            className="h-[3.125rem] rounded-xl border-[var(--ios-separator)] bg-[var(--ios-secondary-surface)] px-3.5 text-[17px] text-[var(--ios-label)] shadow-none placeholder:text-[var(--ios-tertiary-label)] focus-visible:ring-[var(--ios-tint)] lg:h-12 lg:rounded-lg lg:border-slate-200 lg:bg-white lg:px-2.5 lg:text-base lg:text-slate-950 lg:placeholder:text-slate-400 lg:focus-visible:ring-ring/50"
          />
        </label>
        <label
          className="grid gap-2 text-[15px] font-medium text-[var(--ios-label)] lg:text-sm lg:text-slate-800"
          htmlFor="password"
        >
          Password
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="Your password"
            className="h-[3.125rem] rounded-xl border-[var(--ios-separator)] bg-[var(--ios-secondary-surface)] px-3.5 text-[17px] text-[var(--ios-label)] shadow-none placeholder:text-[var(--ios-tertiary-label)] focus-visible:ring-[var(--ios-tint)] lg:h-12 lg:rounded-lg lg:border-slate-200 lg:bg-white lg:px-2.5 lg:text-base lg:text-slate-950 lg:placeholder:text-slate-400 lg:focus-visible:ring-ring/50"
          />
        </label>
        <Button
          type="submit"
          size="lg"
          disabled={passwordPending}
          className="h-[3.125rem] rounded-xl bg-[var(--ios-action)] text-[17px] font-semibold text-white shadow-none active:scale-[0.985] hover:bg-[var(--ios-action-pressed)] focus-visible:ring-[var(--ios-tint)] lg:h-12 lg:rounded-lg lg:bg-[#0B7A3B] lg:text-sm lg:font-medium lg:shadow-[0_8px_18px_rgba(11,122,59,0.18)] lg:hover:bg-[#064E3B] lg:focus-visible:ring-ring/50 lg:active:scale-100"
        >
          <KeyRound className="size-4" />
          {passwordPending ? "Signing in…" : "Sign in with password"}
        </Button>
        {passwordMessage ? (
          <p
            id="password-login-message"
            role="alert"
            className={
              passwordIsError
                ? "rounded-xl border border-[var(--ios-separator)] bg-[var(--ios-secondary-surface)] px-3 py-2.5 text-[15px] leading-5 text-[var(--ios-label)] lg:rounded-lg lg:border-amber-200 lg:bg-amber-50 lg:py-2 lg:text-sm lg:text-amber-900"
                : "rounded-xl border border-[var(--ios-separator)] bg-[var(--ios-secondary-surface)] px-3 py-2.5 text-[15px] leading-5 text-[var(--ios-label)] lg:rounded-lg lg:border-emerald-200 lg:bg-emerald-50 lg:py-2 lg:text-sm lg:text-emerald-900"
            }
            aria-live="assertive"
          >
            {passwordMessage}
          </p>
        ) : null}
      </form>

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-[var(--ios-separator)] lg:bg-slate-200" />
        <p className="text-[13px] font-medium text-[var(--ios-secondary-label)] lg:text-xs lg:uppercase lg:text-slate-500">
          or continue with
        </p>
        <div className="h-px flex-1 bg-[var(--ios-separator)] lg:bg-slate-200" />
      </div>

      <div className="grid gap-2">
        <form action={signInWithOAuthAction}>
          <input type="hidden" name="provider" value="google" />
          {next ? <input type="hidden" name="next" value={next} /> : null}
          <OAuthButton icon={<GoogleIcon />} label="Continue with Google" />
        </form>
        <form action={signInWithOAuthAction}>
          <input type="hidden" name="provider" value="apple" />
          {next ? <input type="hidden" name="next" value={next} /> : null}
          <OAuthButton
            icon={<AppleIcon />}
            label="Continue with Apple"
            className="border-[var(--ios-label)] bg-[var(--ios-label)] text-[var(--ios-background)] hover:bg-[var(--ios-label)] hover:text-[var(--ios-background)] dark:border-[var(--ios-label)] dark:bg-[var(--ios-label)] dark:hover:bg-[var(--ios-label)] lg:border-black lg:bg-black lg:text-white lg:hover:bg-black/90 lg:hover:text-white"
          />
        </form>
      </div>

      <div className="grid gap-3 rounded-[14px] bg-[var(--ios-secondary-surface)] p-4 lg:rounded-lg lg:border lg:border-slate-200 lg:bg-slate-50 lg:p-3">
        <div>
          <p className="text-[15px] font-semibold leading-5 text-[var(--ios-label)] lg:text-sm lg:text-slate-900">
            Create an account or skip the password
          </p>
          <p className="mt-1 text-[15px] leading-5 text-[var(--ios-secondary-label)] lg:text-sm lg:text-slate-600">
            We will email a secure link. If you are new, that link starts your account.
          </p>
        </div>
        <form
          action={magicAction}
          className="grid gap-2"
          aria-describedby={magicMessage ? "magic-login-message" : undefined}
          noValidate
        >
          {next ? <input type="hidden" name="next" value={next} /> : null}
          <label
            className="grid gap-2 text-[15px] font-medium text-[var(--ios-label)] lg:text-sm lg:text-slate-800"
            htmlFor="magic-email"
          >
            <span className="sr-only">Magic link address</span>
            <Input
              id="magic-email"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="you@example.com"
              className="h-[3.125rem] rounded-xl border-[var(--ios-separator)] bg-[var(--ios-grouped-surface)] px-3.5 text-[17px] text-[var(--ios-label)] shadow-none placeholder:text-[var(--ios-tertiary-label)] focus-visible:ring-[var(--ios-tint)] lg:h-12 lg:rounded-lg lg:border-slate-200 lg:bg-white lg:px-2.5 lg:text-base lg:text-slate-950 lg:placeholder:text-slate-400 lg:focus-visible:ring-ring/50"
            />
          </label>
          <Button
            type="submit"
            variant="outline"
            size="lg"
            disabled={magicPending}
            className="h-[3.125rem] w-full rounded-xl border-[var(--ios-separator)] bg-[var(--ios-grouped-surface)] text-[17px] font-semibold text-[var(--ios-label)] shadow-none active:scale-[0.985] hover:bg-[var(--ios-fill)] hover:text-[var(--ios-label)] focus-visible:ring-[var(--ios-tint)] lg:h-12 lg:rounded-lg lg:border-slate-200 lg:bg-white lg:text-sm lg:font-medium lg:text-slate-900 lg:hover:bg-slate-100 lg:hover:text-slate-900 lg:focus-visible:ring-ring/50 lg:active:scale-100"
          >
            <Mail className="size-4" />
            {magicPending ? "Sending…" : "Email me a secure link"}
          </Button>
          {magicMessage ? (
            <p
              id="magic-login-message"
              role="alert"
              className={
                magicIsError
                  ? "rounded-xl border border-[var(--ios-separator)] bg-[var(--ios-secondary-surface)] px-3 py-2.5 text-[15px] leading-5 text-[var(--ios-label)] lg:rounded-lg lg:border-amber-200 lg:bg-amber-50 lg:py-2 lg:text-sm lg:text-amber-900"
                  : "rounded-xl border border-[var(--ios-separator)] bg-[var(--ios-secondary-surface)] px-3 py-2.5 text-[15px] leading-5 text-[var(--ios-label)] lg:rounded-lg lg:border-emerald-200 lg:bg-emerald-50 lg:py-2 lg:text-sm lg:text-emerald-900"
              }
              aria-live="assertive"
            >
              {magicMessage}
            </p>
          ) : null}
        </form>
      </div>
    </div>
  );
}

function OAuthButton({
  icon,
  label,
  className = "border-[var(--ios-separator)] bg-[var(--ios-grouped-surface)] text-[var(--ios-label)] hover:bg-[var(--ios-fill)] hover:text-[var(--ios-label)] lg:border-[#DADCE0] lg:bg-white lg:text-[#3C4043] lg:hover:bg-white lg:hover:text-[#202124]",
}: {
  icon: ReactNode;
  label: string;
  className?: string;
}) {
  return (
    <Button
      type="submit"
      variant="outline"
      size="lg"
      className={`h-[3.125rem] w-full justify-center rounded-xl text-[17px] font-semibold shadow-none active:scale-[0.985] focus-visible:ring-[var(--ios-tint)] lg:h-12 lg:rounded-lg lg:text-base lg:shadow-sm lg:focus-visible:ring-ring/50 lg:active:scale-100 ${className}`}
    >
      {icon}
      {label}
    </Button>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M21.6 12.2c0-.7-.1-1.3-.2-1.9H12v3.6h5.4a4.6 4.6 0 0 1-2 3v2.4h3.2c1.8-1.7 3-4.1 3-7.1Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 5-0.9 6.6-2.5l-3.2-2.4c-.9.6-2 .9-3.4.9-2.6 0-4.8-1.8-5.6-4.1H3.1v2.5A10 10 0 0 0 12 22Z"
      />
      <path
        fill="#FBBC05"
        d="M6.4 13.9A6 6 0 0 1 6 12c0-.7.1-1.3.4-1.9V7.6H3.1A10 10 0 0 0 2 12c0 1.6.4 3.1 1.1 4.4l3.3-2.5Z"
      />
      <path
        fill="#EA4335"
        d="M12 6c1.5 0 2.8.5 3.9 1.5l2.9-2.9A9.7 9.7 0 0 0 12 2a10 10 0 0 0-8.9 5.6l3.3 2.5C7.2 7.8 9.4 6 12 6Z"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden="true">
      <path d="M16.7 12.8c0-2.1 1.7-3.1 1.8-3.2-1-1.5-2.6-1.7-3.1-1.7-1.3-.1-2.6.8-3.3.8s-1.7-.8-2.8-.8c-1.4 0-2.7.8-3.5 2.1-1.5 2.7-.4 6.7 1.1 8.8.7 1.1 1.6 2.3 2.8 2.3 1.1 0 1.5-.7 2.8-.7s1.7.7 2.8.7c1.2 0 1.9-1.1 2.7-2.2.8-1.2 1.1-2.3 1.1-2.4 0-.1-2.3-.9-2.4-3.7ZM14.6 6.5c.6-.8 1.1-1.9 1-3-.9 0-2 .6-2.6 1.4-.6.7-1.1 1.8-1 2.9 1 .1 2-.5 2.6-1.3Z" />
    </svg>
  );
}
