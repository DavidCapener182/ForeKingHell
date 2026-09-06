import Link from "next/link";
import { UntitledPageHeader, UntitledSectionHeader } from "@/components/untitled-ui/headers";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/premium";
import type { getPracticePlanReviewForSourceSession } from "@/lib/practice-planner";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableCaption,
} from "@/components/ui/table";
export function ImportResultRecovery() {
  return (
    <PageShell>
      <UntitledPageHeader
        title="Import result unavailable"
        description="Choose a saved session from history, or return to Import to start another upload."
        actions={
          <Button asChild>
            <Link href="/import">Return to Import</Link>
          </Button>
        }
      />
      <Button asChild variant="outline" className="min-h-11">
        <Link href="/sessions">Open session history</Link>
      </Button>
    </PageShell>
  );
}
export function ImportPracticeReview({
  review,
  sessionId,
}: {
  review: NonNullable<Awaited<ReturnType<typeof getPracticePlanReviewForSourceSession>>>;
  sessionId: string;
}) {
  const decisions = review.comparison?.decisions ?? [];
  return (
    <section
      className="min-w-0 rounded-xl border border-border bg-card"
      data-import-practice-review
    >
      <UntitledSectionHeader
        title="Planned practice review"
        description={`${review.title} · ${review.score}/100`}
        action={
          <Button asChild variant="outline" className="min-h-11">
            <Link
              href={`/practice?planId=${encodeURIComponent(review.planId)}&sourceSessionId=${encodeURIComponent(sessionId)}&source=import`}
            >
              Open matched plan
            </Link>
          </Button>
        }
      />
      <div className="grid gap-3 p-4">
        <p className="text-sm">{review.verdict}</p>
        <p className="text-sm font-medium">{review.nextAction}</p>
        <div
          className="hidden overflow-x-auto lg:block"
          role="region"
          aria-label="Matched practice blocks"
          tabIndex={0}
        >
          <Table>
            <TableCaption>
              All {decisions.length} recorded block decisions for this matched plan.
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Block</TableHead>
                <TableHead scope="col">Target</TableHead>
                <TableHead scope="col">Measured result</TableHead>
                <TableHead scope="col">Next decision</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {decisions.map((decision) => (
                <TableRow key={decision.blockId}>
                  <TableCell className="whitespace-normal font-medium">{decision.title}</TableCell>
                  <TableCell className="whitespace-normal">{decision.target}</TableCell>
                  <TableCell className="whitespace-normal">{decision.actual}</TableCell>
                  <TableCell>{decision.decision.replaceAll("_", " ")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="divide-y divide-border lg:hidden">
          {decisions.map((decision) => (
            <details key={decision.blockId} className="py-2">
              <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold">
                {decision.title}
                <span className="mt-1 block text-xs text-muted-foreground">
                  {decision.decision.replaceAll("_", " ")}
                </span>
              </summary>
              <dl className="grid gap-3 py-2 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Target</dt>
                  <dd>{decision.target}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Measured result</dt>
                  <dd>{decision.actual}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Source session</dt>
                  <dd>
                    <Link
                      className="inline-flex min-h-11 items-center text-primary underline"
                      href={`/sessions/${sessionId}`}
                    >
                      Review imported evidence
                    </Link>
                  </dd>
                </div>
              </dl>
            </details>
          ))}
        </div>
        {!decisions.length ? (
          <p className="text-sm text-muted-foreground">
            This review has no recorded block comparisons. Open the matched plan to inspect its
            saved evidence.
          </p>
        ) : null}
      </div>
    </section>
  );
}
