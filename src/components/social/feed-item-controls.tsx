"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { feedInteractionFormAction } from "@/app/feed/actions";
import { ResponsiveDetailPanel } from "@/components/app/responsive-detail-panel";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useClientReady } from "@/hooks/use-client-ready";
type Choice = { operation: string; label: string; value?: string; consequence: string };
export function FeedItemControls({
  feedItemId,
  visibility,
  isOwnItem,
  headline = "Selected activity",
  compact = false,
}: {
  feedItemId: string;
  visibility: "private" | "friends" | "public";
  isOwnItem: boolean;
  headline?: string;
  compact?: boolean;
}) {
  const ready = useClientReady();
  const router = useRouter();
  const [choice, setChoice] = useState<Choice | null>(null);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const lock = useRef(false);
  const choices: Choice[] = [
    ...(isOwnItem
      ? (["private", "friends", "public"] as const).map((value) => ({
          operation: "visibility",
          value,
          label: `Visibility: ${value}${value === visibility ? " · Current" : ""}`,
          consequence: `Change this activity's audience to ${value}. This does not alter the original golf record.`,
        }))
      : [
          {
            operation: "hide",
            label: "Hide post",
            consequence: "Hide this activity from your feed.",
          },
          {
            operation: "hide-type",
            label: "Hide this activity type",
            consequence: "Hide this kind of activity from your feed.",
          },
          {
            operation: "mute",
            label: "Mute golfer",
            consequence: "Stop showing this golfer in your feed.",
          },
        ]),
    ...["feed_report", "suspicious_result", "spam", "harassment"].map((value) => ({
      operation: "report",
      value,
      label: `Report: ${value.replaceAll("_", " ")}`,
      consequence: "Send this reason for review. This does not automatically remove the activity.",
    })),
    ...(isOwnItem
      ? [
          {
            operation: "delete",
            label: "Delete post",
            consequence:
              "Remove this activity from the feed for everyone who can see it. The original golf record is preserved.",
          },
        ]
      : []),
  ];
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            disabled={!ready || pending}
            variant={compact ? "ghost" : "outline"}
            className="min-h-11 min-w-11"
            aria-label={`Activity actions: ${headline}`}
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Activity controls</DropdownMenuLabel>
          {choices.map((c) => (
            <DropdownMenuItem
              key={`${c.operation}-${c.value ?? ""}`}
              className="min-h-11"
              onSelect={() => {
                setError(undefined);
                setChoice(c);
              }}
            >
              {c.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <ResponsiveDetailPanel
        open={!!choice}
        onOpenChange={(open) => {
          if (!open && !pending) setChoice(null);
        }}
        title={choice?.label ?? "Activity action"}
        description={choice?.consequence}
      >
        <div className="grid gap-4" aria-busy={pending}>
          <p className="break-words font-semibold">{headline}</p>
          <p className="text-sm">Current audience: {visibility}</p>
          {error ? (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={pending} onClick={() => setChoice(null)}>
              Cancel
            </Button>
            <Button
              variant={choice?.operation === "delete" ? "destructive" : "default"}
              disabled={pending}
              onClick={() => {
                if (!choice || lock.current) return;
                lock.current = true;
                setError(undefined);
                start(async () => {
                  try {
                    const data = new FormData();
                    data.set("feedItemId", feedItemId);
                    data.set("operation", choice.operation);
                    if (choice.value)
                      data.set(
                        choice.operation === "visibility" ? "visibility" : "reason",
                        choice.value,
                      );
                    const result = await feedInteractionFormAction({ ok: false }, data);
                    if (!result.ok) {
                      setError(result.error ?? "Could not complete this action.");
                      return;
                    }
                    setChoice(null);
                    router.refresh();
                  } catch {
                    setError("Could not complete this action. Try again.");
                  } finally {
                    lock.current = false;
                  }
                });
              }}
            >
              {pending ? "Saving…" : "Confirm action"}
            </Button>
          </div>
        </div>
      </ResponsiveDetailPanel>
    </>
  );
}
