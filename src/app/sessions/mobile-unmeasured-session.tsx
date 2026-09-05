import Link from "next/link";
import { MobileLargeTitle, MobileSection } from "@/components/app/mobile-screen";
import { MobileGroupedList, MobileListRow, MobileStatus } from "@/components/app/mobile-primitives";
import { MobileAppShell } from "@/components/mobile-sports";
import { PageShell } from "@/components/premium";
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
      <MobileAppShell className="gap-6" data-mobile-unmeasured-session>
        <MobileLargeTitle
          title={plan?.title ?? session.courseName ?? "Practice recorded"}
          eyebrow={new Intl.DateTimeFormat("en-GB", {
            dateStyle: "long",
            timeZone: "Europe/London",
          }).format(session.date)}
          detail={session.location ?? undefined}
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
      </MobileAppShell>
    </PageShell>
  );
}
