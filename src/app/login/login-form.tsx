"use client";

import { useActionState } from "react";
import { Apple, Mail } from "lucide-react";

import { sendMagicLinkAction, signInWithOAuthAction, type LoginActionState } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const initialState: LoginActionState = {
  message: null,
  status: "idle",
};

export function LoginForm({ error }: { error?: string | null }) {
  const [state, formAction, pending] = useActionState(sendMagicLinkAction, initialState);
  const message = error ?? state.message;
  const isError = Boolean(error) || state.status === "error";

  return (
    <div className="grid gap-4">
      <form action={formAction} className="grid gap-3">
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
        <Button type="submit" size="lg" disabled={pending} className="rounded-xl bg-[#111827] text-white">
          <Mail className="size-4" />
          {pending ? "Sending..." : "Email sign-in link"}
        </Button>
      </form>

      {message ? (
        <p
          className={isError ? "rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900" : "rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900"}
          aria-live="polite"
        >
          {message}
        </p>
      ) : null}

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
