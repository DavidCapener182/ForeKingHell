import { syncTourEventLeaderboards } from "@/lib/tour-event-sync";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");

  if (!expected || authorization !== `Bearer ${expected}`) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const result = await syncTourEventLeaderboards();

  return Response.json({
    ok: true,
    result,
  });
}
