"use client";

import { useState, useTransition } from "react";
import { Cloud, Loader2 } from "lucide-react";

import { loginRapsodoAction } from "@/app/rapsodo/actions";
import { IOSGroupedList, IOSInlineStatus, IOSListRow } from "@/components/app/ios-mobile";
import { BottomSheet } from "@/components/mobile-sports";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ConnectionStatus = {
  connected: boolean;
  expiresAt: string | null;
  profile: Record<string, unknown> | null;
};

export function MobileRapsodoConnect({ initialStatus }: { initialStatus: ConnectionStatus }) {
  const [status, setStatus] = useState(initialStatus);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function login() {
    setMessage(null);
    startTransition(async () => {
      const result = await loginRapsodoAction({ email, password });

      if (!result.ok) {
        setMessage(result.message);
        return;
      }

      setStatus({
        connected: result.data.connected,
        expiresAt: null,
        profile: result.data.profile,
      });
      setPassword("");
      setMessage("Provider connected. Open R-Cloud sessions to choose what to import.");
    });
  }

  return (
    <section id="rapsodo-connect" className="grid scroll-mt-24 gap-2">
      <IOSGroupedList label="Rapsodo connection">
        <IOSListRow
          icon={Cloud}
          label={status.connected ? "Rapsodo connected" : "Rapsodo R-Cloud"}
          value={status.connected ? "Ready" : undefined}
          detail={
            status.connected
              ? status.expiresAt
                ? `Token expires ${new Date(status.expiresAt).toLocaleString("en-GB")}.`
                : (message ?? "Choose a measured R-Cloud session to review before import.")
              : "Your password is exchanged for a short-lived encrypted token and is not stored."
          }
          status={
            <IOSInlineStatus
              label={status.connected ? "Session inbox available" : "Connection required"}
              tone={status.connected ? "positive" : "attention"}
            />
          }
          href={status.connected ? "/rapsodo" : undefined}
          trailing={
            status.connected ? undefined : (
              <BottomSheet label="Connect" title="Connect Rapsodo">
                <form
                  className="grid gap-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    login();
                  }}
                >
                  <p className="text-sm leading-5 text-muted-foreground">
                    R-Cloud credentials are used only to exchange for a short-lived encrypted token.
                    ForeKingHell does not store your Rapsodo password.
                  </p>
                  <label className="grid gap-1.5 text-sm font-medium">
                    Rapsodo email
                    <Input
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      className="h-11"
                      required
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm font-medium">
                    Password
                    <Input
                      type="password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="h-11"
                      required
                    />
                  </label>
                  {message ? (
                    <p role="alert" className="text-sm font-medium text-destructive">
                      {message}
                    </p>
                  ) : null}
                  <Button type="submit" disabled={isPending} className="min-h-11">
                    {isPending ? (
                      <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
                    ) : (
                      <Cloud className="size-4" />
                    )}
                    Sign in to Rapsodo
                  </Button>
                </form>
              </BottomSheet>
            )
          }
        />
      </IOSGroupedList>
    </section>
  );
}
