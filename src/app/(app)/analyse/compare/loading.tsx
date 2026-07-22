import { PageShell } from "@/components/premium";

export default function Loading() {
  return (
    <PageShell>
      <div className="h-36 animate-pulse rounded-lg bg-muted" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-44 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    </PageShell>
  );
}
