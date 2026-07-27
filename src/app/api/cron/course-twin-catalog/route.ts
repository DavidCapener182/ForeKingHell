import { processNextCourseTwinCatalogJob } from "@/lib/course-twin-catalog-import";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  return processCatalogQueue(request);
}

export async function POST(request: Request) {
  return processCatalogQueue(request);
}

async function processCatalogQueue(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected || request.headers.get("authorization") !== `Bearer ${expected}`) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }
  const processed = await processNextCourseTwinCatalogJob();
  return Response.json(
    { ok: true, processed },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
