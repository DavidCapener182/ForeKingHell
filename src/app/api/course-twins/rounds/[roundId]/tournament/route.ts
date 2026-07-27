import { rateLimitRequest, readBoundedJsonBody } from "@/lib/api-protection";
import { getCourseTwinRound } from "@/lib/course-twin-round-store";
import { isCourseTwinRoundId } from "@/lib/course-twin-round";
import { getCurrentUser } from "@/lib/current-user";
import { submitTournamentRound } from "@/lib/tournaments";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ roundId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
  const { roundId } = await params;
  if (!isCourseTwinRoundId(roundId)) {
    return Response.json({ error: "Course Twin round not found" }, { status: 404 });
  }
  const rejection = rateLimitRequest(request, {
    keyPrefix: "course-twin-tournament-submit",
    subject: user.id,
    limit: 12,
    windowMs: 60 * 60 * 1000,
  });
  if (rejection) return rejection;
  const body = await readBoundedJsonBody(request, 4_096);
  if (!body.ok) return body.response;
  const input = parseInput(body.value);
  if (!input) return Response.json({ error: "Invalid tournament submission" }, { status: 400 });
  const round = await getCourseTwinRound(roundId, user.id);
  if (!round) return Response.json({ error: "Course Twin round not found" }, { status: 404 });
  if (
    round.status !== "complete" ||
    !round.sessionId ||
    !round.rulesJson.competition ||
    round.rulesJson.mulligansAllowed ||
    round.summary.mulliganCount > 0
  ) {
    return Response.json(
      { error: "Only a completed no-mulligan competition round can be submitted." },
      { status: 409 },
    );
  }
  const grossScore = round.summary.scorecard.reduce((total, hole) => total + hole.strokes, 0);
  try {
    const submission = await submitTournamentRound({
      tournamentId: input.tournamentId,
      roundNumber: input.roundNumber,
      grossScore,
      sessionId: round.sessionId,
    });
    return Response.json(
      { ok: true, submission, finalEventHash: round.finalEventHash },
      { status: 201, headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Tournament submission failed." },
      { status: 422 },
    );
  }
}

function parseInput(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as { tournamentId?: unknown; roundNumber?: unknown };
  if (
    typeof candidate.tournamentId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      candidate.tournamentId,
    ) ||
    !Number.isInteger(candidate.roundNumber) ||
    Number(candidate.roundNumber) < 1 ||
    Number(candidate.roundNumber) > 20
  ) {
    return null;
  }
  return { tournamentId: candidate.tournamentId, roundNumber: Number(candidate.roundNumber) };
}
