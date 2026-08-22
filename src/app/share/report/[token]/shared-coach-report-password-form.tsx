"use client";

import { useEffect, useRef } from "react";

import { unlockCoachReportAction } from "@/app/share/report/[token]/actions";
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
  const action = unlockCoachReportAction.bind(null, token);
  const Heading = headingLevel;
  const passwordInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!invalid) return;
    return replayErrorShake(passwordInputRef.current);
  }, [invalid, invalidAttempt]);

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
            name="password"
            type="password"
            autoComplete="current-password"
            minLength={8}
            maxLength={128}
            autoFocus
            aria-invalid={invalid}
            className={`t-input min-h-11 ${invalid ? "is-error is-shaking" : ""}`}
            required
          />
        </label>
        {invalid ? (
          <Alert variant="destructive">
            <AlertDescription className="text-sm font-semibold text-destructive">
              That password did not match.
            </AlertDescription>
          </Alert>
        ) : null}
        <Button type="submit" className="min-h-11">
          Open report
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
