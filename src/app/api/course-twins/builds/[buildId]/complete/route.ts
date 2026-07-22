import { completeCourseTwinBuild } from "@/lib/course-twin-worker";
import { verifyCourseTwinWorkerSignature } from "@/lib/course-twin-worker-protocol";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_COMPLETION_BYTES = 10 * 1024 * 1024;

type RouteContext = { params: Promise<{ buildId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_COMPLETION_BYTES) {
    return Response.json({ message: "Completion body is too large." }, { status: 413 });
  }
  const body = await request.text();
  if (Buffer.byteLength(body, "utf8") > MAX_COMPLETION_BYTES) {
    return Response.json({ message: "Completion body is too large." }, { status: 413 });
  }
  const secret = process.env.COURSE_TWIN_WORKER_SECRET;
  if (
    !secret ||
    !verifyCourseTwinWorkerSignature({
      body,
      timestamp: request.headers.get("x-fkh-timestamp"),
      signature: request.headers.get("x-fkh-signature"),
      secret,
    })
  ) {
    return Response.json({ message: "Not found." }, { status: 404 });
  }
  let completion: unknown;
  try {
    completion = JSON.parse(body);
  } catch {
    return Response.json({ message: "Completion JSON is invalid." }, { status: 400 });
  }
  const { buildId } = await context.params;
  const result = await completeCourseTwinBuild(buildId, completion);
  if (!result) return Response.json({ message: "Active build not found." }, { status: 404 });
  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}
