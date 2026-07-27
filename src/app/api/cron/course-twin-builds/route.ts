import { dispatchNextCourseTwinBuild } from "@/lib/course-twin-worker";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  return dispatchBuild(request);
}

export async function POST(request: Request) {
  return dispatchBuild(request);
}

async function dispatchBuild(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected || request.headers.get("authorization") !== `Bearer ${expected}`) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }
  const dispatched = await dispatchNextCourseTwinBuild();
  return Response.json({ ok: true, dispatched }, { headers: { "Cache-Control": "no-store" } });
}
