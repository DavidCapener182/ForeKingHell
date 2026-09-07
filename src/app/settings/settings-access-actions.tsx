"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { settingsAccessFormAction } from "@/app/settings/actions";
import { ResponsiveDetailPanel } from "@/components/app/responsive-detail-panel";
import { Button } from "@/components/ui/button";
import { useClientReady } from "@/hooks/use-client-ready";
import { collaborationRoles } from "@/lib/collaboration-roles";
export function SettingsInvitationDialog() {
  const ready = useClientReady();
  const [open, setOpen] = useState(false);
  const [review, setReview] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("viewer");
  const [error, setError] = useState<string>();
  const [url, setUrl] = useState<string>();
  const [pending, start] = useTransition();
  const busy = useRef(false);
  const router = useRouter();
  return (
    <>
      <Button disabled={!ready} onClick={() => setOpen(true)}>
        Invite collaborator
      </Button>
      <ResponsiveDetailPanel
        open={open}
        onOpenChange={(next) => {
          if (!pending) setOpen(next);
        }}
        title="Invite a collaborator"
        description="Review the exact email and role. Access starts only when the matching recipient accepts."
      >
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!review) {
              setReview(true);
              return;
            }
            if (busy.current) return;
            busy.current = true;
            const data = new FormData();
            data.set("operation", "invite");
            data.set("invitedEmail", email);
            data.set("role", role);
            start(async () => {
              try {
                const result = await settingsAccessFormAction({ ok: false }, data);
                if (!result.ok) {
                  setError(result.error ?? "Invitation could not be created.");
                  return;
                }
                setUrl(
                  `${location.origin}/settings/invitations/${encodeURIComponent(result.inviteToken!)}`,
                );
                setReview(false);
                router.refresh();
              } catch {
                setError("Invitation could not be confirmed. Your draft is retained.");
              } finally {
                busy.current = false;
              }
            });
          }}
        >
          {url ? (
            <>
              <p role="status">Invitation created. Share this link with the named recipient.</p>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setUrl(undefined);
                  setEmail("");
                  setRole("viewer");
                  setError(undefined);
                }}
              >
                Create another invitation
              </Button>
              <label className="grid gap-2 text-sm">
                Invitation link
                <input
                  readOnly
                  value={url}
                  onFocus={(e) => e.target.select()}
                  className="min-h-11 w-full rounded-lg border bg-background px-3"
                />
              </label>
            </>
          ) : (
            <>
              {review ? (
                <section
                  className="grid gap-2 rounded-xl border p-3"
                  aria-label="Review invitation"
                >
                  <p className="break-all">Recipient: {email}</p>
                  <p>Role: {role}</p>
                </section>
              ) : (
                <>
                  <label className="grid gap-2 text-sm">
                    Invite email
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="min-h-11 rounded-lg border bg-background px-3"
                    />
                  </label>
                  <label className="grid gap-2 text-sm">
                    Role
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      className="min-h-11 rounded-lg border bg-background px-3"
                    >
                      {collaborationRoles.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              )}
              <p className="text-sm">
                {role === "editor"
                  ? "Editor can read and edit account data where collaboration is supported."
                  : "Coach and viewer can read shared account data where collaboration is supported; they cannot edit it."}{" "}
                This invitation does not change public profile visibility.
              </p>
              {error ? <p role="alert">{error}</p> : null}
              <div className="flex flex-wrap gap-3">
                {review ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={pending}
                    onClick={() => setReview(false)}
                  >
                    Edit invitation
                  </Button>
                ) : null}
                <Button disabled={pending} type="submit">
                  {pending ? "Creating…" : review ? "Confirm invitation" : "Review invitation"}
                </Button>
              </div>
            </>
          )}
          <Button type="button" variant="outline" disabled={pending} onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </form>
      </ResponsiveDetailPanel>
    </>
  );
}
export function SettingsAccessRowAction({
  targetId,
  targetType,
  party,
}: {
  targetId: string;
  targetType: "invitation" | "membership";
  party: string;
}) {
  const ready = useClientReady();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const busy = useRef(false);
  const router = useRouter();
  const label = targetType === "invitation" ? "Cancel invitation" : "Remove access";
  return (
    <>
      <Button
        variant="outline"
        disabled={!ready || pending}
        aria-label={`${label}: ${party}`}
        onClick={() => {
          setError(undefined);
          setOpen(true);
        }}
      >
        {label}
      </Button>
      <ResponsiveDetailPanel
        open={open}
        onOpenChange={(next) => {
          if (!pending) setOpen(next);
        }}
        title={`${label}: ${party}`}
        description={
          targetType === "invitation"
            ? "The pending link will no longer grant access when accepted."
            : "This collaborator will lose role-scoped access to this account."
        }
      >
        <div className="grid gap-4">
          {error ? <p role="alert">{error}</p> : null}
          <Button variant="outline" disabled={pending} onClick={() => setOpen(false)}>
            Keep access
          </Button>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() => {
              if (busy.current) return;
              busy.current = true;
              const data = new FormData();
              data.set("operation", targetType === "invitation" ? "cancel" : "remove");
              data.set(targetType === "invitation" ? "invitationId" : "membershipId", targetId);
              start(async () => {
                try {
                  const result = await settingsAccessFormAction({ ok: false }, data);
                  if (!result.ok) {
                    setError(result.error ?? "Access change could not be confirmed.");
                    return;
                  }
                  setOpen(false);
                  router.refresh();
                } catch {
                  setError("Access change could not be confirmed. Try again.");
                } finally {
                  busy.current = false;
                }
              });
            }}
          >
            {pending ? "Saving…" : `Confirm: ${label}`}
          </Button>
        </div>
      </ResponsiveDetailPanel>
    </>
  );
}
