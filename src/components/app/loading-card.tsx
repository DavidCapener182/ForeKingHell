import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function LoadingCard({
  className,
  rows = 3,
}: {
  className?: string;
  rows?: number;
}) {
  return (
    <Card className={cn("premium-card", className)}>
      <CardHeader>
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-7 w-48" />
      </CardHeader>
      <CardContent className="grid gap-3">
        {Array.from({ length: rows }).map((_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </CardContent>
    </Card>
  );
}
