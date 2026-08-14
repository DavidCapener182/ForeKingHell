import { PageShell } from "@/components/premium";
import { Skeleton } from "@/components/ui/skeleton";

export default function SessionsLoading() {
  return (
    <PageShell>
      <div className="grid gap-3" role="status" aria-live="polite" aria-busy="true">
        <span className="sr-only">Loading golf history</span>
        <Skeleton className="h-11 w-full rounded-xl" />
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.08fr)_minmax(22rem,0.92fr)]">
          <div className="rounded-xl border p-4">
            <Skeleton className="h-5 w-44" />
            <div className="mt-5 grid gap-4">
              {Array.from({ length: 6 }, (_, index) => (
                <div key={index} className="flex gap-3">
                  <Skeleton className="size-7 shrink-0 rounded-full" />
                  <div className="grid flex-1 gap-2">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-4/5" />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-xl border p-4">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="mt-4 aspect-[82/43] w-full rounded-xl" />
            <Skeleton className="mt-3 h-28 w-full rounded-xl" />
          </div>
        </div>
      </div>
    </PageShell>
  );
}
