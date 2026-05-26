import { PageShell } from "@/components/premium";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <PageShell>
      <section className="premium-hero grid gap-4 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="grid gap-2">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-9 w-64 max-w-full" />
            <Skeleton className="h-4 w-80 max-w-full" />
          </div>
          <Skeleton className="h-10 w-36" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-24 w-full" />
          ))}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.85fr)]">
        <div className="grid gap-4">
          <Skeleton className="h-44 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
        <div className="grid gap-4">
          <Skeleton className="h-36 w-full" />
          <Skeleton className="h-52 w-full" />
        </div>
      </section>
    </PageShell>
  );
}
