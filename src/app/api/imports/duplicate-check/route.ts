import { getOptionalCurrentUserId } from "@/lib/current-user";
import { readBoundedJsonBody } from "@/lib/api-protection";
import { checkImportDuplicate } from "@/lib/imports/check-import-duplicate";
import { MAX_IMPORT_CSV_BYTES } from "@/lib/imports/import-limits";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const userId = await getOptionalCurrentUserId();
  if (!userId) {
    return Response.json({ ok: false, message: "Authentication required." }, { status: 401 });
  }

  const bodyResult = await readBoundedJsonBody(request, MAX_IMPORT_CSV_BYTES + 1024);
  if (!bodyResult.ok) return bodyResult.response;

  const rawCsvText =
    bodyResult.value && typeof bodyResult.value === "object" && "rawCsvText" in bodyResult.value
      ? (bodyResult.value as { rawCsvText?: unknown }).rawCsvText
      : null;

  if (typeof rawCsvText !== "string") {
    return Response.json({ ok: false, message: "A CSV payload is required." }, { status: 400 });
  }

  return Response.json({ ok: true, ...(await checkImportDuplicate(userId, rawCsvText)) });
}
