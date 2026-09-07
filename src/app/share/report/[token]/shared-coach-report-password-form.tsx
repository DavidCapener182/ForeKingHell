"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { unlockCoachReportStateAction } from "@/app/share/report/[token]/actions";
import { useClientReady } from "@/hooks/use-client-ready";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function SharedCoachReportPasswordForm({
  token,
  invalid,
  invalidAttempt,
  headingLevel,
}: {
  token: string;
  invalid: boolean;
  invalidAttempt: string | null;
  headingLevel: "h1" | "h2";
}) {
  const [state, action, pending] = useActionState(
    unlockCoachReportStateAction.bind(null, token),
    {},
  );
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const ready = useClientReady();
  const error = state.error || (invalid ? "That password did not match." : "");
  const Heading = headingLevel;
  const passwordInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!error || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    return replayErrorShake(passwordInputRef.current);
  }, [error, invalidAttempt]);

  return (
    <>
      <p className="mt-5 text-sm font-semibold uppercase tracking-[0.14em] text-primary">
        Protected performance report
      </p>
      <Heading className="mt-2 font-display text-3xl font-semibold">
        Enter the report password
      </Heading>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        The golfer protected this frozen report. The share token alone does not unlock it.
      </p>
      <form action={action} className="mt-5 grid gap-3">
        <label className="grid gap-2 text-sm font-semibold">
          Password
          <Input
            ref={passwordInputRef}
            id="shared-report-password"
            name="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type={visible ? "text" : "password"}
            autoComplete="current-password"
            minLength={8}
            maxLength={128}
            autoFocus
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "shared-report-password-error" : undefined}
            className={`t-input min-h-11 ${error ? "is-error" : ""}`}
            required
          />
        </label>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={!ready || pending}
          aria-pressed={visible}
          aria-controls="shared-report-password"
          onClick={() => setVisible((v) => !v)}
        >
          {visible ? "Hide password" : "Show password"}
        </Button>
        {error ? (
          <Alert variant="destructive" id="shared-report-password-error">
            <AlertDescription className="text-sm font-semibold text-destructive">
              {error}
            </AlertDescription>
          </Alert>
        ) : null}
        <Button type="submit" className="min-h-11" disabled={!ready || pending}>
          {pending ? "Checking access…" : "Open report"}
        </Button>
      </form>
    </>
  );
}

function replayErrorShake(element: HTMLElement | null) {
  if (!element) return;
  element.classList.remove("is-shaking");
  void element.offsetWidth;
  element.classList.add("is-shaking");
  const timer = window.setTimeout(() => element.classList.remove("is-shaking"), 300);
  return () => {
    window.clearTimeout(timer);
    element.classList.remove("is-shaking");
  };
}
