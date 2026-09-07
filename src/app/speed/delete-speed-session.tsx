"use client";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { deleteSpeedSessionWithStateAction } from "./actions";
export function DeleteSpeedSession({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const busy = useRef(false);
  return (
    <>
      <Button variant="destructive" onClick={() => setOpen(true)}>
        Delete session
      </Button>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!pending) setOpen(value);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {title}?</DialogTitle>
            <DialogDescription>
              This removes this speed session and all its individual readings. Imported golf shots
              remain saved. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {error && (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" disabled={pending} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => {
                if (busy.current) return;
                busy.current = true;
                setError("");
                startTransition(async () => {
                  try {
                    const data = new FormData();
                    data.set("sessionId", id);
                    const result = await deleteSpeedSessionWithStateAction(data);
                    if (result.ok) {
                      router.push("/speed");
                      router.refresh();
                      return;
                    }
                    setError(result.error);
                  } catch {
                    setError(
                      "Deletion could not be confirmed. Check Speed Centre before retrying.",
                    );
                  } finally {
                    busy.current = false;
                  }
                });
              }}
            >
              {pending ? "Deleting…" : "Confirm deletion"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
