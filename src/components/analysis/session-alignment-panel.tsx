import Link from "next/link";
import { alignmentStatus } from "@/lib/session-data-confidence";
import { getSessionAlignmentEvidence } from "@/lib/session-alignment-data";
import { SessionConfidenceControls } from "./session-confidence-controls";
export async function SessionAlignmentPanel({ sessionId }: { sessionId: string }) {
  const evidence = await getSessionAlignmentEvidence(sessionId);
  if (!evidence) return null;
  const { session, reviewCount } = evidence;
  return (
    <section className="grid gap-3" aria-label="Session data confidence">
      {reviewCount > 0 && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
          {reviewCount} reported finishes need review because the start-to-finish difference is
          large and spin evidence is incomplete. This is a review cue, not proof of a misread.{" "}
          <Link className="underline" href={`/shots?sessionId=${sessionId}`}>
            Review shots
          </Link>
          .
        </p>
      )}
      <SessionConfidenceControls
        sessionId={sessionId}
        label={session.fileName ?? "Session alignment"}
        alignment={alignmentStatus(session.confidence.alignment)}
      />
    </section>
  );
}
