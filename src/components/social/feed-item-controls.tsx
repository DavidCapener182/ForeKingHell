"use client";

import { EyeOff, Flag, Lock, MoreHorizontal, Trash2, Users } from "lucide-react";

import {
  deleteFeedItemAction,
  hideFeedItemAction,
  hideFeedItemTypeAction,
  muteFeedItemUserAction,
  reportFeedItemAction,
  updateFeedItemVisibilityAction,
} from "@/app/feed/actions";
import { ConfirmSubmitButton } from "@/components/app/confirm-submit-button";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const socialVisibilityOptions = ["private", "friends", "public"] as const;
type SocialVisibility = (typeof socialVisibilityOptions)[number];

export function FeedItemControls({
  feedItemId,
  visibility,
  isOwnItem,
  compact = false,
}: {
  feedItemId: string;
  visibility: SocialVisibility;
  isOwnItem: boolean;
  compact?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" size={compact ? "xs" : "sm"}>
            <MoreHorizontal className="size-4" />
            Actions
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52">
          <DropdownMenuLabel>Feed controls</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {isOwnItem ? (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Lock className="size-4" /> Visibility
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {socialVisibilityOptions.map((option) => (
                  <DropdownMenuItem key={option} asChild>
                    <form action={updateFeedItemVisibilityAction} className="w-full">
                      <input type="hidden" name="feedItemId" value={feedItemId} />
                      <input type="hidden" name="visibility" value={option} />
                      <button type="submit" className="w-full text-left">
                        {titleCase(option)}
                        {option === visibility ? " · Current" : ""}
                      </button>
                    </form>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          ) : (
            <>
              <DropdownMenuItem asChild>
                <form action={hideFeedItemAction} className="w-full">
                  <input type="hidden" name="feedItemId" value={feedItemId} />
                  <button type="submit" className="flex w-full items-center gap-2 text-left">
                    <EyeOff className="size-4" /> Hide post
                  </button>
                </form>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <form action={hideFeedItemTypeAction} className="w-full">
                  <input type="hidden" name="feedItemId" value={feedItemId} />
                  <button type="submit" className="flex w-full items-center gap-2 text-left">
                    <EyeOff className="size-4" /> Hide this type
                  </button>
                </form>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <form action={muteFeedItemUserAction} className="w-full">
                  <input type="hidden" name="feedItemId" value={feedItemId} />
                  <button type="submit" className="flex w-full items-center gap-2 text-left">
                    <Users className="size-4" /> Mute user
                  </button>
                </form>
              </DropdownMenuItem>
            </>
          )}
          {!isOwnItem ? <DropdownMenuSeparator /> : null}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Flag className="size-4" /> Report
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {[
                ["feed_report", "Report post"],
                ["suspicious_result", "Suspicious result"],
                ["spam", "Spam"],
                ["harassment", "Harassment"],
              ].map(([value, label]) => (
                <DropdownMenuItem key={value} asChild>
                  <form action={reportFeedItemAction} className="w-full" data-feed-report-form>
                    <input type="hidden" name="feedItemId" value={feedItemId} />
                    <input type="hidden" name="reason" value={value} />
                    <button type="submit" className="w-full text-left">
                      {label}
                    </button>
                  </form>
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>
      {isOwnItem ? (
        <form action={deleteFeedItemAction}>
          <input type="hidden" name="feedItemId" value={feedItemId} />
          <ConfirmSubmitButton
            confirmMessage="Delete this feed item? This removes it from the feed for everyone who can see it."
            variant="destructive"
            size={compact ? "xs" : "sm"}
          >
            <Trash2 className="size-4" /> Delete
          </ConfirmSubmitButton>
        </form>
      ) : null}
    </div>
  );
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
