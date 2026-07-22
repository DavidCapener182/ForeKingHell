import { isCourseTwinRoundId } from "@/lib/course-twin-round";
import { getCourseTwinRound as loadCourseTwinRound } from "@/lib/course-twin-round-store";
import { getCurrentUser } from "@/lib/current-user";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ roundId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
  const { roundId } = await params;
  if (!isCourseTwinRoundId(roundId)) {
    return Response.json({ error: "Course Twin round not found" }, { status: 404 });
  }
  const round = await loadCourseTwinRound(roundId, user.id);
  if (!round) return Response.json({ error: "Course Twin round not found" }, { status: 404 });
  return Response.json(round, { headers: { "Cache-Control": "private, no-store" } });
}
