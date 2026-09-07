import Link from "next/link";
import { PageHeader, PageShell } from "@/components/premium";
import { Button } from "@/components/ui/button";
export default function SharedAccountUnavailable() {
  return (
    <PageShell>
      <div className="grid gap-4 pb-28">
        <PageHeader
          title="Shared account unavailable"
          description="This account is unavailable or you no longer have access. No player data is shown."
        />
        <Button asChild variant="outline">
          <Link href="/settings?section=sharing" prefetch={false}>
            Review account access
          </Link>
        </Button>
      </div>
    </PageShell>
  );
}
