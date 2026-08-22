"use client";

import { Collapsible as CollapsiblePrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

function Collapsible({
  className,
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.Root>) {
  return (
    <CollapsiblePrimitive.Root
      data-slot="collapsible"
      className={cn("t-acc", className)}
      {...props}
    />
  );
}

function CollapsibleTrigger({
  className,
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.CollapsibleTrigger>) {
  return (
    <CollapsiblePrimitive.CollapsibleTrigger
      data-slot="collapsible-trigger"
      className={cn("t-acc-head", className)}
      {...props}
    />
  );
}

function CollapsibleContent({
  className,
  children,
  outerClassName,
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.CollapsibleContent> & {
  outerClassName?: string;
}) {
  return (
    <CollapsiblePrimitive.CollapsibleContent
      data-slot="collapsible-content"
      className={cn("t-acc-content", outerClassName)}
      {...props}
    >
      <div className={cn("t-acc-panel-inner", className)}>{children}</div>
    </CollapsiblePrimitive.CollapsibleContent>
  );
}

export { Collapsible, CollapsibleContent, CollapsibleTrigger };
