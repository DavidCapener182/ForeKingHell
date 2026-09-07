"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { MoreHorizontal, PlugZap, RefreshCw, Unplug } from "lucide-react";

import { disconnectRapsodoAction } from "@/app/rapsodo/actions";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ProviderConnectionActions({
  providerKind,
  connected,
  live,
}: {
  providerKind: string;
  connected: boolean;
  live: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [pending, startTransition] = useTransition();
  const isRapsodo = providerKind.toLowerCase().includes("rapsodo");
  const destination = live ? "/rapsodo" : "/billing";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label={`${providerKind} connection actions`}>
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel>Connection actions</DropdownMenuLabel>
          <DropdownMenuItem asChild>
            <Link href={destination} prefetch={false}>
              <PlugZap className="size-4" />
              {connected ? "Open provider inbox" : live ? "Connect provider" : "View access"}
            </Link>
          </DropdownMenuItem>
          {live ? (
            <DropdownMenuItem asChild>
              <Link href="/rapsodo" prefetch={false}>
                <RefreshCw className="size-4" />
                Reconnect
              </Link>
            </DropdownMenuItem>
          ) : null}
          {connected && isRapsodo ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setConfirmDisconnect(true)}>
                <Unplug className="size-4" />
                Disconnect
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog
        open={confirmDisconnect}
        onOpenChange={(open) => {
          if (!pending) {
            setConfirmDisconnect(open);
            if (!open) setError(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect R-Cloud?</AlertDialogTitle>
            <AlertDialogDescription>
              Existing imported sessions stay in LM World Tour. New R-Cloud sessions will stop
              syncing until you reconnect.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Keep connected</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => {
                startTransition(async () => {
                  setError(null);
                  try {
                    const result = await disconnectRapsodoAction();
                    if (!result.ok) {
                      setError(result.message);
                      return;
                    }
                    setConfirmDisconnect(false);
                    router.refresh();
                  } catch {
                    setError(
                      "The connection could not be removed. Your imported sessions are unchanged. Try again.",
                    );
                  }
                });
              }}
            >
              {pending ? "Disconnecting…" : "Disconnect"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
