import { CheckCircle2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export function ResultHero({
  eyebrow = "Complete",
  title,
  summary,
  confidence,
  metrics = [],
  action,
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  summary?: React.ReactNode;
  confidence?: { label: string; tone?: "default" | "secondary" | "destructive" | "outline" };
  metrics?: { label: string; value: React.ReactNode }[];
  action?: React.ReactNode;
  className?: string;
}) {
  const visibleMetrics = metrics.slice(0, 4);

  return (
    <Card
      className={cn(
        "gap-0 bg-card bg-gradient-to-br from-card via-card to-primary/[0.04] py-0 shadow-sm ring-primary/20",
        className,
      )}
      data-result-hero
    >
      <CardHeader className="gap-2 px-5 py-5 sm:px-6">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            <CheckCircle2 className="size-4" aria-hidden />
            {eyebrow}
          </p>
          <CardTitle>
            <h1 className="mt-1 text-2xl font-bold leading-7 tracking-tight sm:text-3xl">
              {title}
            </h1>
          </CardTitle>
        </div>
        {confidence ? (
          <CardAction>
            <Badge variant={confidence.tone ?? "secondary"} className="shrink-0 shadow-xs">
              {confidence.label}
            </Badge>
          </CardAction>
        ) : null}
      </CardHeader>

      {summary || visibleMetrics.length ? (
        <>
          <Separator />
          <CardContent className="grid gap-4 px-5 py-4 sm:px-6">
            {summary ? (
              <div className="max-w-4xl text-sm leading-6 text-muted-foreground">{summary}</div>
            ) : null}
            {visibleMetrics.length ? (
              <div
                className="grid overflow-hidden rounded-lg bg-muted/35 ring-1 ring-border sm:grid-cols-2 xl:grid-cols-4"
                aria-label="Result metrics"
                role="list"
              >
                {visibleMetrics.map((metric, index) => (
                  <div key={metric.label} className="relative min-w-0 p-3" role="listitem">
                    {index > 0 ? (
                      <Separator className="absolute inset-x-3 top-0 w-auto sm:hidden" />
                    ) : null}
                    {index > 0 ? (
                      <Separator
                        orientation="vertical"
                        className={cn(
                          "absolute inset-y-3 -left-px hidden h-auto",
                          index % 2 === 1 && "sm:block",
                          index > 0 && "xl:block",
                        )}
                      />
                    ) : null}
                    {index > 1 ? (
                      <Separator className="absolute inset-x-3 top-0 hidden w-auto sm:block xl:hidden" />
                    ) : null}
                    <p className="truncate text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                      {metric.label}
                    </p>
                    <p className="mt-1 truncate text-base font-semibold text-foreground">
                      {metric.value}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}
          </CardContent>
        </>
      ) : null}

      {action ? (
        <CardFooter className="px-5 py-4 sm:px-6">
          <ButtonGroup className="w-full min-w-0 flex-wrap [&>[data-slot=button-group]]:w-full">
            {action}
          </ButtonGroup>
        </CardFooter>
      ) : null}
    </Card>
  );
}
