"use client";

import Link from "next/link";
import { MessageCircle, Sparkles } from "lucide-react";

import { AiCoachCard } from "@/app/coach/ai-coach-card";
import { CoachChatCard } from "@/app/coach/coach-chat-card";
import {
  CoachCommandSuggestions,
  type CoachCommandSuggestion,
} from "@/app/coach/coach-command-suggestions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import type { AiCoachPayload } from "@/lib/ai-coach-summary";

export type CoachAiToolsPanelProps = {
  canUseAiCoach: boolean;
  aiPayload: AiCoachPayload;
  suggestions: CoachCommandSuggestion[];
};

export function CoachAiToolsPanel({
  canUseAiCoach,
  aiPayload,
  suggestions,
}: CoachAiToolsPanelProps) {
  return (
    <section className="grid gap-4" data-coach-ai-tools>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-normal">Ask your coach</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Start from the current diagnosis, or write a focused question from your measured data.
          </p>
        </div>
        <Badge variant={canUseAiCoach ? "secondary" : "outline"}>
          {canUseAiCoach ? "AI available" : "Pro feature"}
        </Badge>
      </div>

      <CoachCommandSuggestions suggestions={suggestions.slice(0, 6)} />

      {canUseAiCoach ? (
        <div className="grid gap-6 xl:grid-cols-2 xl:divide-x xl:divide-border">
          <section className="min-w-0 py-2 xl:pr-6" aria-label="Generate coach note">
            <AiCoachCard payload={aiPayload} />
          </section>
          <section className="min-w-0 py-2 xl:pl-6" aria-label="Ask coach">
            <CoachChatCard questionId="coach-question-desktop" />
          </section>
        </div>
      ) : (
        <section className="border-y border-dashed bg-muted/30 py-4">
          <UpgradeAiCoachCard />
        </section>
      )}

      <Button asChild variant="outline" className="w-fit">
        <Link href="/data-chat" prefetch={false}>
          <MessageCircle className="size-4" />
          Open Data Chat
        </Link>
      </Button>
    </section>
  );
}

function UpgradeAiCoachCard() {
  return (
    <CardContent>
      <div className="rounded-lg border border-dashed bg-muted/30 p-4 text-sm">
        <p className="font-semibold">AI coach is a Pro feature.</p>
        <p className="mt-1 leading-6 text-muted-foreground">
          Rule-based coaching stays available. Upgrade when you want AI summaries and chat over your
          personal SQL context.
        </p>
        <Button asChild variant="outline" className="mt-3">
          <Link href="/billing" prefetch={false}>
            <Sparkles className="size-4" />
            View Pro
          </Link>
        </Button>
      </div>
    </CardContent>
  );
}
