"use client";
import { useClientReady } from "@/hooks/use-client-ready";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { groupPostFormAction } from "@/app/groups/actions";
import { ResponsiveDetailPanel } from "@/components/app/responsive-detail-panel";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
export function GroupPostForm({
  groupId,
  groupName,
  visibility,
}: {
  groupId: string;
  groupName: string;
  visibility: string;
}) {
  const ready = useClientReady();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [review, setReview] = useState(false);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const lock = useRef(false);
  return (
    <>
      <Button
        disabled={!ready}
        onClick={() => {
          setSaved(false);
          setOpen(true);
        }}
      >
        Write group update
      </Button>
      {saved ? <p role="status">Your update was saved to {groupName}.</p> : null}
      <ResponsiveDetailPanel
        open={open}
        onOpenChange={(next) => {
          if (!pending) setOpen(next);
        }}
        title={`Post to ${groupName}`}
        description={`Group visibility: ${visibility}. Publishing shares this update with people who can access this group.`}
      >
        <form
          className="grid gap-4"
          aria-busy={pending}
          onSubmit={(e) => {
            e.preventDefault();
            if (!body.trim()) {
              setError("Enter an update before publishing.");
              return;
            }
            if (!review) {
              setReview(true);
              return;
            }
            if (lock.current) return;
            lock.current = true;
            setError(undefined);
            start(async () => {
              try {
                const data = new FormData();
                data.set("groupId", groupId);
                data.set("title", title);
                data.set("body", body);
                const result = await groupPostFormAction({ ok: false }, data);
                if (!result.ok) {
                  setError(result.error ?? "Could not publish. Try again.");
                  return;
                }
                setTitle("");
                setBody("");
                setReview(false);
                setOpen(false);
                setSaved(true);
                router.refresh();
              } catch {
                setError("Could not publish. Your draft is retained.");
              } finally {
                lock.current = false;
              }
            });
          }}
        >
          {review ? (
            <section className="grid gap-3 rounded-xl border p-4">
              <h3 className="break-words font-semibold">{title || "Group update"}</h3>
              <p className="whitespace-pre-wrap break-words">{body}</p>
              <p>
                Publish to {groupName} · {visibility}
              </p>
            </section>
          ) : (
            <>
              <Label htmlFor="group-post-title">Title (optional)</Label>
              <Input
                id="group-post-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={180}
              />
              <Label htmlFor="group-post-body">Update</Label>
              <Textarea
                id="group-post-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                required
                maxLength={2000}
                rows={6}
              />
              <p className="text-sm text-muted-foreground">{body.length}/2000 characters</p>
            </>
          )}
          {error ? (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2 border-t pt-4">
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              Keep draft and close
            </Button>
            {review ? (
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => setReview(false)}
              >
                Edit draft
              </Button>
            ) : null}
            <Button type="submit" disabled={pending}>
              {pending ? "Publishing…" : review ? "Confirm publish" : "Review update"}
            </Button>
          </div>
        </form>
      </ResponsiveDetailPanel>
    </>
  );
}
