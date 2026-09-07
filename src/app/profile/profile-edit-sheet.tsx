"use client";
import { useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { updateSocialProfileFormAction } from "@/app/profile/actions";
import { Button } from "@/components/ui/button";
import { useClientReady } from "@/hooks/use-client-ready";
export function ProfileEditSheet({ children }: { children: ReactNode }) {
  const ready = useClientReady();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const busy = useRef(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const router = useRouter();
  const close = () => {
    if (!busy.current) {
      dialog.current?.close();
      trigger.current?.focus();
    }
  };
  return (
    <>
      <Button
        ref={trigger}
        variant="secondary"
        disabled={!ready}
        onClick={() => {
          setSaved(false);
          dialog.current?.showModal();
        }}
      >
        Edit profile
      </Button>
      {saved ? <p role="status">Profile and sharing settings saved.</p> : null}
      <dialog
        ref={dialog}
        aria-labelledby="profile-edit-title"
        aria-describedby="profile-edit-description"
        className="fixed inset-0 m-auto max-h-[92dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-2xl border bg-popover p-4 text-popover-foreground shadow-xl backdrop:bg-black/30 sm:p-6"
        onCancel={(e) => {
          e.preventDefault();
          close();
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="profile-edit-title" className="text-xl font-semibold">
            Edit profile
          </h2>
          <Button type="button" variant="outline" disabled={pending} onClick={close}>
            Close
          </Button>
        </div>
        <p id="profile-edit-description" className="mt-2 text-sm text-muted-foreground">
          Edit your identity and each sharing scope. Closing keeps your draft on this page; only
          Save profile changes the saved account.
        </p>
        <form
          id="profile-settings-form"
          aria-label="Edit profile and privacy"
          aria-busy={pending}
          className="grid gap-4 pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (busy.current) return;
            if (e.currentTarget.querySelector('[data-profile-media-processing="true"]')) {
              setError("Wait for the photo preview to finish before saving.");
              return;
            }
            const data = new FormData(e.currentTarget);
            busy.current = true;
            setError(undefined);
            start(async () => {
              try {
                const result = await updateSocialProfileFormAction({ ok: false }, data);
                if (!result.ok) {
                  setError(result.error ?? "Profile could not be saved. Your edits are retained.");
                  return;
                }
                setSaved(true);
                dialog.current?.close();
                trigger.current?.focus();
                router.refresh();
              } catch {
                setError("Profile could not be saved. Your edits are retained.");
              } finally {
                busy.current = false;
              }
            });
          }}
        >
          <fieldset disabled={pending} className="min-w-0 grid gap-5">
            {children}
          </fieldset>
          {pending ? <p role="status">Saving profile and sharing settings…</p> : null}
          {error ? (
            <p role="alert" className="rounded-lg border p-3 text-sm">
              {error}
            </p>
          ) : null}
        </form>
      </dialog>
    </>
  );
}
