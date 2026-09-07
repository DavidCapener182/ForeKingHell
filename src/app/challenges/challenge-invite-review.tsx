"use client";
import { useRef, useState, useTransition } from "react";
import { inviteFriendToChallengeFormAction } from "@/app/challenges/actions";
import { ResponsiveDetailPanel } from "@/components/app/responsive-detail-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useClientReady } from "@/hooks/use-client-ready";
export function ChallengeInviteReview({
  challengeId,
  title,
  visibility,
  friends,
  disabled,
}: {
  challengeId: string;
  title: string;
  visibility: string;
  friends: Array<{ userId: string; username: string; displayName: string }>;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState("");
  const [review, setReview] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState("");
  const [pending, start] = useTransition();
  const busy = useRef(false);
  const ready = useClientReady();
  const friend = friends.find((item) => item.userId === selected);
  return (
    <section className="grid gap-2">
      <ResponsiveDetailPanel
        open={open}
        onOpenChange={(value) => {
          if (!pending) setOpen(value);
        }}
        title={`Invite a friend to ${title}`}
        description={`Challenge visibility: ${visibility}. This invitation gives access to this challenge, not account data.`}
        trigger={
          <Button
            variant="outline"
            className="min-h-11 justify-self-start"
            disabled={!ready || disabled || !friends.length}
          >
            Invite friends
          </Button>
        }
        footer={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="min-h-11"
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            {review ? (
              <>
                <Button
                  variant="outline"
                  className="min-h-11"
                  disabled={pending}
                  onClick={() => setReview(false)}
                >
                  Edit selection
                </Button>
                <Button
                  className="min-h-11"
                  disabled={pending || !friend}
                  onClick={() => {
                    if (busy.current || !friend) return;
                    busy.current = true;
                    setError("");
                    setReceipt("");
                    const data = new FormData();
                    data.set("challengeId", challengeId);
                    data.set("inviteeUserId", friend.userId);
                    start(async () => {
                      try {
                        const result = await inviteFriendToChallengeFormAction({ ok: false }, data);
                        if (result.ok) {
                          setReceipt(`Invitation saved for ${friend.displayName}.`);
                          setReview(false);
                          setSelected("");
                        } else setError(result.error ?? "Could not save invitation.");
                      } catch {
                        setError("Could not save invitation. Your selection remains here.");
                      } finally {
                        busy.current = false;
                      }
                    });
                  }}
                >
                  {" "}
                  {pending ? "Sending…" : "Send reviewed invitation"}
                </Button>
              </>
            ) : (
              <Button
                className="min-h-11"
                disabled={!friend}
                onClick={() => {
                  setError("");
                  setReceipt("");
                  setReview(true);
                }}
              >
                Review invitation
              </Button>
            )}
          </div>
        }
      >
        {review ? (
          <div className="grid gap-3">
            <p className="font-semibold">
              {friend?.displayName} (@{friend?.username})
            </p>
            <p>Challenge: {title}</p>
            <p>Visibility: {visibility}. Sending does not grant access to private account data.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            <label className="grid gap-1 text-sm font-medium">
              Search friends
              <Input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="min-h-11"
              />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Friend to invite
              <select
                aria-label="Friend to invite"
                className="min-h-11 w-full rounded-md border bg-background px-2"
                value={selected}
                onChange={(e) => {
                  setSelected(e.target.value);
                  setReceipt("");
                }}
              >
                <option value="">Choose a friend</option>
                {friends
                  .filter(
                    (f) =>
                      f.userId === selected ||
                      `${f.displayName} ${f.username}`.toLowerCase().includes(query.toLowerCase()),
                  )
                  .map((f) => (
                    <option key={f.userId} value={f.userId}>
                      {f.displayName} (@{f.username})
                    </option>
                  ))}
              </select>
            </label>
          </div>
        )}
        {error ? (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {error}
          </p>
        ) : null}
        {receipt ? (
          <p role="status" className="mt-3 text-sm">
            {receipt}
          </p>
        ) : null}
      </ResponsiveDetailPanel>
      {disabled ? (
        <p className="text-sm">Invitations are closed for this challenge.</p>
      ) : !friends.length ? (
        <p className="text-sm">Add friends before sending an invitation.</p>
      ) : null}
    </section>
  );
}
