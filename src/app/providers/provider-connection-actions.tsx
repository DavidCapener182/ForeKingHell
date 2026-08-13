"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { MoreHorizontal, PlugZap, RefreshCw, Unplug } from "lucide-react";

import { disconnectRapsodoAction } from "@/app/rapsodo/actions";
import {
  AlertDialog,
  AlertDialogAction,
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
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [pending, startTransition] = useTransition();
  const isRapsodo = providerKind.toLowerCase().includes("rapsodo");
  const destination = live ? "/rapsodo" : "/billing";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon-sm" aria-label="Provider connection actions">
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

      <AlertDialog open={confirmDisconnect} onOpenChange={setConfirmDisconnect}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect R-Cloud?</AlertDialogTitle>
            <AlertDialogDescription>
              Existing imported sessions stay in LM World Tour. New R-Cloud sessions will stop
              syncing until you reconnect.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Keep connected</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={pending}
              onClick={() => {
                startTransition(async () => {
                  await disconnectRapsodoAction();
                  setConfirmDisconnect(false);
                  router.refresh();
                });
              }}
            >
              {pending ? "Disconnecting…" : "Disconnect"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
