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
          <Button
            type="button"
            variant={compact ? "ghost" : "outline"}
            size={compact ? "icon-xs" : "sm"}
            aria-label="Activity actions"
          >
            <MoreHorizontal className="size-4" />
            {compact ? <span className="sr-only">Actions</span> : "Actions"}
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
                      <Button
                        type="submit"
                        variant="ghost"
                        size="sm"
                        className="h-auto w-full justify-start rounded-none p-0 text-left font-normal hover:bg-transparent focus-visible:ring-0"
                      >
                        {titleCase(option)}
                        {option === visibility ? " · Current" : ""}
                      </Button>
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
                  <Button
                    type="submit"
                    variant="ghost"
                    size="sm"
                    className="h-auto w-full justify-start rounded-none p-0 text-left font-normal hover:bg-transparent focus-visible:ring-0"
                  >
                    <EyeOff className="size-4" /> Hide post
                  </Button>
                </form>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <form action={hideFeedItemTypeAction} className="w-full">
                  <input type="hidden" name="feedItemId" value={feedItemId} />
                  <Button
                    type="submit"
                    variant="ghost"
                    size="sm"
                    className="h-auto w-full justify-start rounded-none p-0 text-left font-normal hover:bg-transparent focus-visible:ring-0"
                  >
                    <EyeOff className="size-4" /> Hide this type
                  </Button>
                </form>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <form action={muteFeedItemUserAction} className="w-full">
                  <input type="hidden" name="feedItemId" value={feedItemId} />
                  <Button
                    type="submit"
                    variant="ghost"
                    size="sm"
                    className="h-auto w-full justify-start rounded-none p-0 text-left font-normal hover:bg-transparent focus-visible:ring-0"
                  >
                    <Users className="size-4" /> Mute user
                  </Button>
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
                    <Button
                      type="submit"
                      variant="ghost"
                      size="sm"
                      className="h-auto w-full justify-start rounded-none p-0 text-left font-normal hover:bg-transparent focus-visible:ring-0"
                    >
                      {label}
                    </Button>
                  </form>
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          {isOwnItem ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <form action={deleteFeedItemAction} className="w-full">
                  <input type="hidden" name="feedItemId" value={feedItemId} />
                  <ConfirmSubmitButton
                    confirmMessage="Delete this feed item? This removes it from the feed for everyone who can see it."
                    variant="ghost"
                    size="sm"
                    className="h-auto w-full justify-start rounded-none p-0 text-left font-normal text-destructive hover:bg-transparent hover:text-destructive focus-visible:ring-0"
                  >
                    <Trash2 className="size-4" /> Delete
                  </ConfirmSubmitButton>
                </form>
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
