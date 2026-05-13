"use client";

import { useActionState } from "react";
import { Apple, KeyRound, Mail } from "lucide-react";

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
  const [magicState, magicAction, magicPending] = useActionState(
    sendMagicLinkAction,
    initialState,
  );

  const passwordMessage = error ?? passwordState.message;
  const passwordIsError = Boolean(error) || passwordState.status === "error";
  const magicMessage = magicState.message;
  const magicIsError = magicState.status === "error";

  return (
    <div className="grid gap-4">
      <form action={passwordAction} className="grid gap-3">
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <label className="grid gap-2 text-sm font-medium text-slate-800" htmlFor="email">
          Email
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="you@example.com"
            required
            className="h-11 rounded-xl border-slate-200 bg-white text-base text-slate-950 placeholder:text-slate-400"
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-800" htmlFor="password">
          Password
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="Your password"
            required
            minLength={6}
            className="h-11 rounded-xl border-slate-200 bg-white text-base text-slate-950 placeholder:text-slate-400"
          />
        </label>
        <Button
          type="submit"
          size="lg"
          disabled={passwordPending}
          className="h-11 rounded-xl bg-[#111827] text-white"
        >
          <KeyRound className="size-4" />
          {passwordPending ? "Signing in..." : "Sign in with password"}
        </Button>
        {passwordMessage ? (
          <p
            className={
              passwordIsError
                ? "rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
                : "rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900"
            }
            aria-live="polite"
          >
            {passwordMessage}
          </p>
        ) : null}
      </form>

      <div className="grid gap-2 border-t border-slate-200 pt-4">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
          Or use a one-time link
        </p>
        <form action={magicAction} className="grid gap-2">
          <label className="grid gap-2 text-sm font-medium text-slate-800" htmlFor="magic-email">
            <span className="sr-only">Magic link address</span>
            <Input
              id="magic-email"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="you@example.com"
              required
              className="h-11 rounded-xl border-slate-200 bg-white text-base text-slate-950 placeholder:text-slate-400"
            />
          </label>
          <Button
            type="submit"
            variant="outline"
            size="lg"
            disabled={magicPending}
            className="h-11 w-full rounded-xl border-slate-200 bg-white text-slate-900 hover:bg-slate-50 hover:text-slate-900"
          >
            <Mail className="size-4" />
            {magicPending ? "Sending..." : "Email sign-in link"}
          </Button>
          {magicMessage ? (
            <p
              className={
                magicIsError
                  ? "rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
                  : "rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900"
              }
              aria-live="polite"
            >
              {magicMessage}
            </p>
          ) : null}
        </form>
      </div>

      <div className="grid gap-2 border-t border-slate-200 pt-4">
        <form action={signInWithOAuthAction}>
          <input type="hidden" name="provider" value="google" />
          <Button type="submit" variant="outline" size="lg" className="h-11 w-full rounded-xl border-slate-200 bg-white text-slate-900 hover:bg-slate-50 hover:text-slate-900">
            <span className="grid size-4 place-items-center rounded-full border border-slate-300 text-[10px] font-semibold">G</span>
            Continue with Google
          </Button>
        </form>
        <form action={signInWithOAuthAction}>
          <input type="hidden" name="provider" value="apple" />
          <Button type="submit" variant="outline" size="lg" className="h-11 w-full rounded-xl border-slate-200 bg-white text-slate-900 hover:bg-slate-50 hover:text-slate-900">
            <Apple className="size-4" />
            Continue with Apple
          </Button>
        </form>
      </div>
    </div>
  );
}
