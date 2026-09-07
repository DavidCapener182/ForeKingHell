import Link from "next/link";
import { PageHeader, PageShell } from "@/components/premium";
import { Button } from "@/components/ui/button";
import { DiagnosisClient } from "@/app/coach/diagnosis/diagnosis-client";
import { buildCoachSummary } from "@/lib/coach";
import { requireCurrentUserId } from "@/lib/current-user";
import { getProgressData } from "@/lib/progress-data";
export const dynamic = "force-dynamic";
export default async function CoachDiagnosisPage() {
  const userId = await requireCurrentUserId();
  const data = await getProgressData(userId);
  const coach = buildCoachSummary(data.clubs);
  return (
    <PageShell>
      <PageHeader
        title="Club improvement centre"
        description="Inspect the evidence, select one drill, then retest with measured shots."
        actions={
          <Button asChild variant="outline">
            <Link href="/coach?tab=evidence">Back to Coach evidence</Link>
          </Button>
        }
      />
      {coach.clubCards.length ? (
        <DiagnosisClient cards={coach.clubCards} />
      ) : (
        <div className="grid gap-3 rounded-lg border p-4">
          <h2 className="text-xl font-semibold">Diagnosis is waiting for measured data</h2>
          <p>Import a comparable launch-monitor session to establish your club evidence.</p>
          <Button asChild>
            <Link href="/import">Import a session</Link>
          </Button>
        </div>
      )}
    </PageShell>
  );
}
