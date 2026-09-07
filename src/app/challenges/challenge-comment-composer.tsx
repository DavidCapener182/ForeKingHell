"use client";
import { useRef, useState, useTransition } from "react";
import { unstable_rethrow, useRouter } from "next/navigation";
import { addChallengeCommentFormAction } from "@/app/challenges/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useClientReady } from "@/hooks/use-client-ready";
export function ChallengeCommentComposer({ challengeId }: { challengeId: string }) {
  const router = useRouter();
  const [receipt, setReceipt] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const busy = useRef(false);
  const ready = useClientReady();
  return (
    <form
      className="grid gap-3 rounded-xl border bg-card p-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (busy.current || !body.trim()) return;
        busy.current = true;
        setError("");
        setReceipt("");
        const data = new FormData();
        data.set("challengeId", challengeId);
        data.set("body", body);
        start(async () => {
          try {
            const result = await addChallengeCommentFormAction({ ok: false }, data);
            if (result.ok) {
              setBody("");
              setReceipt("Comment saved.");
              router.refresh();
            } else setError(result.error ?? "Comment could not be saved. Your draft remains here.");
          } catch (error) {
            unstable_rethrow(error);
            setError(
              error instanceof Error
                ? error.message
                : "Comment could not be sent. Your draft remains here.",
            );
          } finally {
            busy.current = false;
          }
        });
      }}
    >
      <label className="grid gap-2 text-sm font-medium">
        Comment
        <Textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={3}
          required
          disabled={pending}
        />
      </label>
      <p className="text-sm text-muted-foreground">
        Visible to people who can view this challenge. Sending is explicit.
      </p>
      <Button className="min-h-11 justify-self-start" disabled={!ready || pending || !body.trim()}>
        {pending ? "Sending…" : "Send comment"}
      </Button>
      {receipt ? <p role="status">{receipt}</p> : null}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </form>
  );
}
