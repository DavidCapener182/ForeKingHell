import * as React from "react";

import { cn } from "@/lib/utils";

function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "inline-flex min-w-5 items-center justify-center rounded-md border bg-muted px-1.5 py-0.5 font-mono text-[0.7rem] font-medium text-muted-foreground shadow-xs",
        className,
      )}
      {...props}
    />
  );
}

export { Kbd };
