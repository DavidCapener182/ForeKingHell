import type { ReactNode } from "react";

import { ButtonGroup } from "@/components/ui/button-group";
import { Card, CardContent } from "@/components/ui/card";
import { FieldGroup } from "@/components/ui/field";
import { cn } from "@/lib/utils";

type FilterToolbarProps = {
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export function FilterToolbar({
  children,
  actions,
  className,
}: FilterToolbarProps) {
  return (
    <Card className={cn("premium-card", className)}>
      <CardContent className="p-3">
        <FieldGroup className="gap-3 md:grid md:grid-cols-3 xl:grid-cols-6">
          {children}
        </FieldGroup>
        {actions ? (
          <ButtonGroup className="mt-3 flex-wrap">{actions}</ButtonGroup>
        ) : null}
      </CardContent>
    </Card>
  );
}
