import Link from "next/link";
import { MobileSection } from "@/components/app/mobile-screen";
import { MobileGroupedList, MobileListRow, MobileStatus } from "@/components/app/mobile-primitives";
import { PageShell } from "@/components/app/page-shell";
import { UntitledPageHeader as PageHeader } from "@/components/untitled-ui/headers";
import { Button } from "@/components/ui/button";
import type { SessionReviewMetadata } from "@/lib/session-review-metadata";

export function MobileUnmeasuredSession({
  session,
  plan,
}: {
  session: SessionReviewMetadata;
  plan: { id: string; title: string } | null;
}) {
  const hasStoredShots = session.shotCount > 0;
  const shotHref = `/shots?sessionId=${encodeURIComponent(session.id)}`;
  const importHref = plan ? `/import?practicePlanId=${encodeURIComponent(plan.id)}` : "/import";
  return (
    <PageShell>
      <section className="grid min-w-0 gap-6 [&>*]:min-w-0" data-mobile-unmeasured-session>
        <PageHeader
          title={session.fileName ?? session.courseName ?? plan?.title ?? "Practice recorded"}
          description={new Intl.DateTimeFormat("en-GB", {
            dateStyle: "long",
            timeZone: "Europe/London",
          }).format(session.date)}
        />
        <section className="grid gap-3" aria-label="Session status">
          <MobileStatus
            tone="neutral"
            label={hasStoredShots ? `${session.shotCount} shots saved` : "Activity saved"}
          />
          <h2 className="mobile-type-title2">
            {hasStoredShots ? "Your measurements need a check" : "No measurements yet"}
          </h2>
          <p className="mobile-type-callout text-muted-foreground">
            {hasStoredShots
              ? "The saved shots are not available in this review. Check their club mapping and evidence status to see what can be used."
              : "Your activity is saved. Import measured shots to review your distances, patterns and progress."}
          </p>
          <Button asChild className="min-h-12">
            <Link href={hasStoredShots ? shotHref : importHref}>
              {hasStoredShots ? "Review imported shots" : "Import measured shots"}
            </Link>
          </Button>
        </section>
        {session.notes || session.equipmentNotes ? (
          <MobileSection title="Your notes">
            {session.notes ? (
              <p className="mobile-type-body whitespace-pre-wrap break-words">{session.notes}</p>
            ) : null}
            {session.equipmentNotes ? (
              <MobileGroupedList>
                <MobileListRow
                  label="Equipment"
                  detail={
                    <span className="whitespace-pre-wrap break-words">
                      {session.equipmentNotes}
                    </span>
                  }
                />
              </MobileGroupedList>
            ) : null}
          </MobileSection>
        ) : null}
        <MobileGroupedList label="Session actions">
          {plan ? (
            <MobileListRow
              label="Open practice plan"
              detail={plan.title}
              href={`/practice?planId=${encodeURIComponent(plan.id)}`}
            />
          ) : null}
          <MobileListRow label="All sessions" href="/sessions" />
          <MobileListRow label="Choose practice" href="/practice" />
        </MobileGroupedList>
      </section>
    </PageShell>
  );
}
