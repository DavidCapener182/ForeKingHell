"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useState, useTransition } from "react";
import { Cloud, MoreHorizontal } from "lucide-react";

import {
  disconnectRapsodoAction,
  listRapsodoSessionsAction,
  loginRapsodoAction,
  previewRapsodoSessionAction,
} from "@/app/rapsodo/actions";
import { AppEmptyState } from "@/components/app/app-empty-state";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import type { RapsodoSessionListItem, RapsodoSessionPreview } from "@/lib/rapsodo/sync-types";
import { companionRapsodoInbox } from "@/lib/rapsodo/companion-workflow";

type ConnectionStatus = {
  connected: boolean;
  expiresAt: string | null;
  profile: Record<string, unknown> | null;
};

const RapsodoCompanionPreview = dynamic(
  () =>
    import("@/app/rapsodo/rapsodo-companion-preview").then(
      (module) => module.RapsodoCompanionPreview,
    ),
  {
    loading: () => <Skeleton className="h-72 rounded-xl" data-rapsodo-preview-loading />,
  },
);

export function RapsodoCompanionClient({
  initialStatus,
  practicePlanId,
}: {
  initialStatus: ConnectionStatus;
  practicePlanId: string | null;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [sessions, setSessions] = useState<RapsodoSessionListItem[]>([]);
  const [preview, setPreview] = useState<RapsodoSessionPreview | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState<"sessions" | "preview" | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const timer = window.setTimeout(() => setHydrated(true), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const loadSessions = useCallback(() => {
    if (!status.connected) return;
    setLoading("sessions");
    setMessage(null);
    startTransition(async () => {
      const result = await listRapsodoSessionsAction({ take: 16 });
      setLoading(null);
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      setSessions(companionRapsodoInbox(result.data));
    });
  }, [status.connected]);

  useEffect(() => {
    const timer = window.setTimeout(loadSessions, 0);
    return () => window.clearTimeout(timer);
  }, [loadSessions]);

  function connect(formData: FormData) {
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    setMessage(null);
    startTransition(async () => {
      const result = await loginRapsodoAction({ email, password });
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      setStatus({ connected: true, expiresAt: null, profile: result.data.profile });
    });
  }

  function openPreview(session: RapsodoSessionListItem) {
    setLoading("preview");
    setMessage(null);
    startTransition(async () => {
      const result = await previewRapsodoSessionAction(session);
      setLoading(null);
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      setPreview(result.data);
    });
  }

  if (!status.connected) {
    return (
      <Card>
        <CardHeader>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              Rapsodo R-Cloud
            </p>
            <CardTitle className="mt-1 text-2xl">Connect your account</CardTitle>
            <p className="mt-2 text-sm leading-5 text-muted-foreground">
              Credentials are sent directly to R-Cloud to establish the encrypted provider session.
            </p>
          </div>
          <CardAction>
            <div className="flex items-center gap-2">
              <Badge variant="outline">Not connected</Badge>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="ghost" size="icon" aria-label="R-Cloud options">
                    <MoreHorizontal className="size-4" aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link href="/import?source=csv">Use a CSV instead</Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardAction>
        </CardHeader>
        <CardContent>
          <form action={connect} className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="rapsodo-email">Email</Label>
              <Input
                id="rapsodo-email"
                name="email"
                type="email"
                autoComplete="username"
                required
                className="min-h-11"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="rapsodo-password">Password</Label>
              <Input
                id="rapsodo-password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="min-h-11"
              />
            </div>
            <Button type="submit" className="min-h-12 rounded-xl" disabled={pending}>
              Connect R-Cloud
            </Button>
          </form>
          {message ? (
            <Alert variant="destructive" className="mt-3">
              <AlertTitle>R-Cloud connection failed</AlertTitle>
              <AlertDescription className="grid gap-2">
                <span>{message}</span>
                <Button asChild size="sm" variant="outline" className="w-fit">
                  <Link href="/import?source=csv">Use a CSV instead</Link>
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  if (preview) {
    return (
      <RapsodoCompanionPreview
        preview={preview}
        practicePlanId={practicePlanId}
        hydrated={hydrated}
        message={message}
        onMessageChange={setMessage}
        onClose={() => setPreview(null)}
      />
    );
  }

  return (
    <div
      className="grid gap-4"
      data-rapsodo-companion-inbox
      data-hydrated={hydrated ? "true" : "false"}
    >
      <Card size="sm" data-rapsodo-connection-card>
        <CardHeader>
          <div>
            <CardTitle>R-Cloud connected</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">Recent unimported sessions</p>
          </div>
          <CardAction>
            <div className="flex items-center gap-2">
              <Badge>Connected</Badge>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="outline" size="icon" aria-label="R-Cloud options">
                    <MoreHorizontal className="size-4" aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={loadSessions}>Refresh sessions</DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/import?source=csv">Import a CSV instead</Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardAction>
        </CardHeader>
      </Card>
      <section className="grid gap-2.5">
        <div className="px-1">
          <h2 className="text-sm font-semibold">Session inbox</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {sessions.length ? "Newest unimported session first" : "No unimported sessions found"}
          </p>
        </div>
        <ScrollArea className="max-h-[28rem] rounded-xl border bg-card">
          <div className="grid gap-1 p-2" aria-label="R-Cloud session inbox">
            {sessions.map((session, index) => (
              <Button
                key={`${session.providerKind}-${session.providerSessionId}`}
                type="button"
                variant="ghost"
                className="focus-aaa h-auto w-full justify-start rounded-xl p-0 text-left outline-none"
                onClick={() => openPreview(session)}
              >
                <Item variant="muted" size="sm" className="w-full text-left">
                  <ItemMedia>
                    <Cloud className="size-4 text-primary" aria-hidden />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>{session.title}</ItemTitle>
                    <ItemDescription>
                      {formatDate(session.dateIso)} · {session.shotCount ?? "—"} shots
                    </ItemDescription>
                  </ItemContent>
                  {index === 0 ? (
                    <ItemActions>
                      <Badge variant="secondary">Newest</Badge>
                    </ItemActions>
                  ) : null}
                </Item>
              </Button>
            ))}
            {loading === "sessions" ? <Skeleton className="h-16 rounded-xl" /> : null}
          </div>
        </ScrollArea>
        {!loading && sessions.length === 0 ? (
          <AppEmptyState
            title="You are up to date"
            description="Refresh after your next Rapsodo session."
            primaryAction={
              <Button type="button" size="sm" variant="outline" onClick={loadSessions}>
                Refresh sessions
              </Button>
            }
            className="mt-3"
          />
        ) : null}
      </section>
      {message ? (
        <Alert variant="destructive">
          <AlertTitle>R-Cloud unavailable</AlertTitle>
          <AlertDescription className="grid gap-2">
            <span>{message}</span>
            <Button asChild size="sm" variant="outline" className="w-fit">
              <Link href="/import?source=csv">Use a CSV instead</Link>
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className="min-h-11 text-muted-foreground"
            disabled={!hydrated || pending}
          >
            Disconnect R-Cloud
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect R-Cloud?</AlertDialogTitle>
            <AlertDialogDescription>
              Future Rapsodo sessions will stop appearing until the provider is connected again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep connected</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() =>
                startTransition(async () => {
                  await disconnectRapsodoAction();
                  setStatus({ connected: false, expiresAt: null, profile: null });
                  setSessions([]);
                })
              }
            >
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function formatDate(value: string | null) {
  if (!value) return "Date unavailable";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}
