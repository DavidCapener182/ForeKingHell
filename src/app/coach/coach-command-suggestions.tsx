"use client";

import { useRouter } from "next/navigation";
import { MessageCircle, Sparkles } from "lucide-react";

import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";

export type CoachCommandSuggestion = {
  label: string;
  prompt: string;
};

export function CoachCommandSuggestions({
  suggestions,
}: {
  suggestions: CoachCommandSuggestion[];
}) {
  const router = useRouter();

  return (
    <Command
      className="border bg-card shadow-sm"
      aria-label="Suggested coach questions"
      data-coach-command-suggestions
    >
      <CommandList className="max-h-none">
        <CommandGroup
          heading="Ask from this diagnosis"
          className="[&_[cmdk-group-items]]:grid [&_[cmdk-group-items]]:gap-1 md:[&_[cmdk-group-items]]:grid-cols-2"
        >
          {suggestions.map((suggestion) => (
            <CommandItem
              key={suggestion.label}
              value={`${suggestion.label} ${suggestion.prompt}`}
              onSelect={() =>
                router.push(`/data-chat?prompt=${encodeURIComponent(suggestion.prompt)}`)
              }
              className="items-start whitespace-normal"
            >
              <Sparkles className="mt-0.5 size-4 text-primary" aria-hidden />
              <span className="min-w-0">
                <span className="block font-medium">{suggestion.label}</span>
                <span className="line-clamp-2 text-xs text-muted-foreground group-data-[selected=true]/command-item:text-primary-foreground/75">
                  {suggestion.prompt}
                </span>
              </span>
              <MessageCircle className="ml-auto mt-0.5 size-4 opacity-55" aria-hidden />
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  );
}
