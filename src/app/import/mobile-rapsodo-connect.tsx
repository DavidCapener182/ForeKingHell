"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Cloud, Loader2, ShieldCheck } from "lucide-react";

import { loginRapsodoAction } from "@/app/rapsodo/actions";
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
    <section id="rapsodo-connect" className="premium-hero rounded-lg p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#0B7A3B]">Rapsodo sync · Live</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-normal text-foreground">
            {status.connected ? "Provider connected" : "Connect Rapsodo"}
          </h2>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">
            Pull live R-Cloud sessions, preview shots, confirm clubs, then import verified data into
            the shared LM World Tour history.
          </p>
        </div>
        <span className="grid size-11 place-items-center rounded-lg bg-[#F5F6F4] text-[#0B7A3B]">
          {status.connected ? <ShieldCheck className="size-5" /> : <Cloud className="size-5" />}
        </span>
      </div>

      <div className="trust-indicator mt-4 rounded-lg p-3 text-sm leading-5">
        We do not store your Rapsodo password. It is exchanged for a short-lived encrypted token.
        You can disconnect at any time.
      </div>

      {status.connected ? (
        <div className="mt-4 grid gap-3">
          <div className="rounded-lg bg-[#F5F6F4] p-3 text-sm text-[#050505]">
            <p className="font-semibold">Token saved</p>
            <p className="mt-1 text-[#6B7280]">
              {status.expiresAt
                ? `Expires ${new Date(status.expiresAt).toLocaleString("en-GB")}.`
                : "Ready to load R-Cloud sessions."}
            </p>
          </div>
          <Button asChild className="premium-action rounded-lg">
            <Link href="/rapsodo" prefetch={false}>
              Open Rapsodo sessions
            </Link>
          </Button>
        </div>
      ) : (
        <form
          className="mt-4 grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            login();
          }}
        >
          <Input
            type="email"
            autoComplete="email"
            placeholder="Rapsodo email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="h-11 rounded-lg bg-white"
          />
          <Input
            type="password"
            autoComplete="current-password"
            placeholder="Rapsodo password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="h-11 rounded-lg bg-white"
          />
          {message ? <p className="text-sm text-[#DC2626]">{message}</p> : null}
          <Button
            type="submit"
            disabled={isPending}
            className="premium-action rounded-lg"
          >
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <Cloud className="size-4" />}
            Sign in to Rapsodo
          </Button>
        </form>
      )}
    </section>
  );
}
