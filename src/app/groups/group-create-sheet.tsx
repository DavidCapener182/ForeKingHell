"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createGroupFormAction } from "@/app/groups/actions";
import { ResponsiveDetailPanel } from "@/components/app/responsive-detail-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useClientReady } from "@/hooks/use-client-ready";
const privacy = {
  private: "Only invited members can access this group.",
  friends: "Access follows the existing friends-group permissions.",
  public: "This group is public and can be discovered by other golfers.",
};
export function GroupCreateSheet({ groupTypes }: { groupTypes: readonly string[] }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ready = useClientReady();
  return (
    <>
      <Button disabled={!ready} onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        Create group
      </Button>
      <ResponsiveDetailPanel
        open={open}
        onOpenChange={(next) => {
          if (!busy) setOpen(next);
        }}
        title="Create a group"
        description="Choose who can access your group. No members are invited automatically."
      >
        <GroupCreateForm
          groupTypes={groupTypes}
          onCancel={() => setOpen(false)}
          onBusyChange={setBusy}
        />
      </ResponsiveDetailPanel>
    </>
  );
}
export function GroupCreateForm({
  groupTypes,
  onCancel,
  onBusyChange,
}: {
  groupTypes: readonly string[];
  onCancel?: () => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const router = useRouter();
  const ready = useClientReady();
  const [pending, start] = useTransition();
  const lock = useRef(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [groupType, setGroupType] = useState(groupTypes[0] ?? "friends");
  const [visibility, setVisibility] = useState<keyof typeof privacy>("private");
  const [review, setReview] = useState(false);
  const [error, setError] = useState<string>();
  return (
    <form
      className="grid gap-4"
      aria-busy={pending}
      onSubmit={(event) => {
        event.preventDefault();
        if (!name.trim()) {
          setError("Enter a group name.");
          return;
        }
        if (!review) {
          setError(undefined);
          setReview(true);
          return;
        }
        if (lock.current) return;
        lock.current = true;
        onBusyChange?.(true);
        setError(undefined);
        start(async () => {
          try {
            const data = new FormData();
            data.set("name", name);
            data.set("description", description);
            data.set("visibility", visibility);
            data.set("groupType", groupType);
            const result = await createGroupFormAction({ ok: false }, data);
            if (!result.ok || !result.slug) {
              setError(result.error ?? "Could not create the group. Try again.");
              return;
            }
            router.push(`/groups/${encodeURIComponent(result.slug)}`);
            router.refresh();
          } catch {
            setError("Could not create the group. Try again.");
          } finally {
            lock.current = false;
            onBusyChange?.(false);
          }
        });
      }}
    >
      {review ? (
        <section className="grid gap-3 rounded-xl border p-4" aria-label="Review group">
          <h3 className="break-words font-semibold">{name}</h3>
          <p>
            {titleCase(groupType)} · {titleCase(visibility)}
          </p>
          <p>{privacy[visibility]}</p>
          <p className="whitespace-pre-wrap break-words">{description || "No description."}</p>
          <p className="text-sm text-muted-foreground">
            You will be the owner. No other members will be invited.
          </p>
        </section>
      ) : (
        <>
          <div className="grid gap-2">
            <Label htmlFor="group-name">Name</Label>
            <Input
              id="group-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="group-type">Type</Label>
            <select
              id="group-type"
              className="min-h-11 w-full rounded-lg border bg-background px-3"
              value={groupType}
              onChange={(e) => setGroupType(e.target.value)}
            >
              {groupTypes.map((type) => (
                <option key={type} value={type}>
                  {titleCase(type)}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="group-visibility">Visibility</Label>
            <select
              id="group-visibility"
              className="min-h-11 w-full rounded-lg border bg-background px-3"
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as keyof typeof privacy)}
            >
              {Object.keys(privacy).map((value) => (
                <option key={value} value={value}>
                  {titleCase(value)}
                </option>
              ))}
            </select>
            <p className="text-sm text-muted-foreground">{privacy[visibility]}</p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="group-description">Description</Label>
            <Textarea
              id="group-description"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </>
      )}
      {error ? (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2 border-t pt-4">
        {onCancel ? (
          <Button type="button" variant="outline" disabled={pending} onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        {review ? (
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => setReview(false)}
          >
            Edit details
          </Button>
        ) : null}
        <Button type="submit" disabled={!ready || pending}>
          {pending ? "Creating…" : review ? "Confirm creation" : "Review group"}
        </Button>
      </div>
    </form>
  );
}
function titleCase(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
