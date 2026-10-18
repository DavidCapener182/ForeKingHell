"use client";
import Link from "next/link";
import { PageHeader, PageShell } from "@/components/premium";
import { Button } from "@/components/ui/button";
export default function SharedRoundError({ retry }: { retry: () => void }) {
  return (
    <PageShell>
      <PageHeader
        title="Shared Course Twin could not load"
        description="The service could not complete this request. Try again or return to the product home."
      />
      <div className="flex flex-wrap gap-3">
        <Button type="button" onClick={retry}>
          Try again
        </Button>
        <Button asChild variant="outline">
          <Link href="/">Product home</Link>
        </Button>
      </div>
    </PageShell>
  );
}
