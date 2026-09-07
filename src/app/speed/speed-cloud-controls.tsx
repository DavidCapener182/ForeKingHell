"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { loginRapsodoAction } from "@/app/rapsodo/actions";
import { importRapsodoSpeedSessionWithStateAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
export function SpeedCloudControls({ connected }: { connected: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const busy = useRef(false);
  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={() => {
            if (connected) startTransition(() => router.refresh());
            else setOpen(true);
          }}
          disabled={pending}
        >
          {pending
            ? "Checking connection…"
            : connected
              ? "Refresh R-Speed inbox"
              : "Connect R-Cloud"}
        </Button>
      </div>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!busy.current) setOpen(next);
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Connect R-Cloud</DialogTitle>
            <DialogDescription>
              Use your Rapsodo account to read its R-Speed sessions. This connection is separate
              from previously imported data.
            </DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (busy.current) return;
              const data = new FormData(event.currentTarget);
              busy.current = true;
              setError("");
              startTransition(async () => {
                try {
                  const result = await loginRapsodoAction({
                    email: String(data.get("email") ?? ""),
                    password: String(data.get("password") ?? ""),
                  });
                  if (result.ok) {
                    setOpen(false);
                    router.refresh();
                  } else setError(result.message ?? "Connection failed.");
                } catch {
                  setError("Unable to connect. Your entries are retained.");
                } finally {
                  busy.current = false;
                }
              });
            }}
          >
            <fieldset disabled={pending} className="grid gap-4">
              <label className="grid gap-1 text-sm">
                Rapsodo email
                <Input type="email" name="email" autoComplete="username" required />
              </label>
              <label className="grid gap-1 text-sm">
                Rapsodo password
                <Input type="password" name="password" autoComplete="current-password" required />
              </label>
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">{pending ? "Connecting…" : "Connect"}</Button>
              </div>
            </fieldset>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
export function SpeedCloudImport({
  id,
  title,
  available,
}: {
  id: string;
  title: string;
  available: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<string | null>(null);
  const busy = useRef(false);
  return (
    <div className="grid gap-2">
      <Button
        disabled={!available || pending || Boolean(saved)}
        onClick={() => {
          if (busy.current || saved) return;
          busy.current = true;
          setError("");
          startTransition(async () => {
            try {
              const result = await importRapsodoSpeedSessionWithStateAction(id);
              if (result.ok) setSaved(result.sessionId ?? null);
              else setError(result.error);
            } catch {
              setError("Import could not be confirmed. Check saved sessions before retrying.");
            } finally {
              busy.current = false;
            }
          });
        }}
      >
        {pending ? "Importing…" : saved ? "Imported" : "Import R-Speed"}
        <span className="sr-only"> {title}</span>
      </Button>
      {!available && (
        <p className="text-xs text-muted-foreground">
          Individual provider readings are unavailable. Use manual entry above.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {saved && (
        <a className="text-sm text-primary underline" href={`/speed/sessions/${saved}`}>
          Open imported session
        </a>
      )}
    </div>
  );
}
