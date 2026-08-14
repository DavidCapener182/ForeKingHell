import { PageShell } from "@/components/premium";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function TodayLoading() {
  return (
    <PageShell>
      <div role="status" aria-live="polite" aria-busy="true" className="grid gap-3">
        <Card
          size="sm"
          className="gap-3 py-3"
          role="status"
          aria-busy="true"
          aria-label="Loading Today answer"
        >
          <CardHeader className="grid gap-2">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-7 w-4/5" />
            <Skeleton className="h-4 w-full" />
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-11 rounded-lg" />
            ))}
            <Skeleton className="col-span-2 h-12 rounded-xl" />
          </CardContent>
        </Card>
        <Card
          className="gap-3 py-3"
          role="status"
          aria-busy="true"
          aria-label="Loading latest shot pattern"
        >
          <CardHeader className="grid gap-2 px-3">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-3 w-52" />
          </CardHeader>
          <CardContent className="px-3">
            <Skeleton className="aspect-[82/43] w-full rounded-xl" />
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
