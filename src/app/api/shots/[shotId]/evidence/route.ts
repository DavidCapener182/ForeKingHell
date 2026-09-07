import { getCurrentUser } from "@/lib/current-user";
import { getTodayShotDetailRows } from "@/lib/today-shot-detail-data";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: Promise<{ shotId: string }> }) {
  const user = await getCurrentUser();
  const reply = (body: unknown, status = 200) =>
    Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
  if (!user) return reply({ error: "Sign in to view shot evidence." }, 401);
  const { shotId } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(shotId))
    return reply({ error: "Shot unavailable." }, 404);
  const [shot] = await getTodayShotDetailRows({ userId: user.id, shotIds: [shotId] });
  return shot ? reply({ shot }) : reply({ error: "Shot unavailable." }, 404);
}
