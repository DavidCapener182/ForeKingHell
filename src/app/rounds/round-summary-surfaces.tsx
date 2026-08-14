import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { cn } from "@/lib/utils";

export function RoundMetricItem({
  detail,
  label,
  value,
  className,
}: {
  detail: string;
  label: string;
  value: ReactNode;
  className?: string;
}) {
  return (
    <Item
      variant="outline"
      size="sm"
      className={cn("h-full items-start bg-muted/20", className)}
      data-round-metric-item
    >
      <ItemContent>
        <ItemDescription className="text-[11px] font-medium uppercase tracking-[0.12em]">
          {label}
        </ItemDescription>
        <ItemTitle className="mt-1 text-xl font-semibold tracking-normal sm:text-2xl">
          {value}
        </ItemTitle>
        <ItemDescription className="mt-1 whitespace-normal [overflow:visible] [text-overflow:clip]">
          {detail}
        </ItemDescription>
      </ItemContent>
    </Item>
  );
}

export function RoundTaskItem({
  action,
  detail,
  icon: Icon,
  title,
}: {
  action: ReactNode;
  detail: string;
  icon: LucideIcon;
  title: string;
}) {
  return (
    <Item
      variant="outline"
      className="h-full min-h-28 flex-col items-stretch justify-between gap-3 bg-muted/20"
      data-round-task-item
    >
      <div className="flex min-w-0 items-start gap-3">
        <ItemMedia className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-4" />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>{title}</ItemTitle>
          <ItemDescription className="mt-1 line-clamp-2 whitespace-normal [overflow:visible] [text-overflow:clip]">
            {detail}
          </ItemDescription>
        </ItemContent>
      </div>
      <ItemActions className="ml-0 justify-start">{action}</ItemActions>
    </Item>
  );
}
