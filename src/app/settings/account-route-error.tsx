"use client";

import Link from "next/link";
import { PageHeader, PageShell } from "@/components/premium";
import { Button } from "@/components/ui/button";

/** Page recovery only. Retrying never resubmits an account or billing operation. */
export function AccountRouteError({
  title,
  description,
  retry,
  href,
  label,
}: {
  title: string;
  description: string;
  retry: () => void;
  href: string;
  label: string;
}) {
  return (
    <PageShell>
      <div className="grid min-w-0 gap-4 pb-28">
        <PageHeader title={title} description={description} />
        <div className="flex flex-wrap gap-3">
          <Button type="button" onClick={retry}>
            Try loading again
          </Button>
          <Button asChild variant="outline">
            <Link href={href}>{label}</Link>
          </Button>
        </div>
      </div>
    </PageShell>
  );
}
