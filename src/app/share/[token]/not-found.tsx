import Link from "next/link";
import { PageHeader, PageShell } from "@/components/premium";
import { Button } from "@/components/ui/button";
export default function UnavailableSharedRound() {
  return (
    <PageShell>
      <PageHeader
        title="Shared round unavailable"
        description="This link cannot open a shared round. Ask the sender for a current link."
        actions={
          <Button asChild>
            <Link href="/">Product home</Link>
          </Button>
        }
      />
    </PageShell>
  );
}
