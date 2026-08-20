import { and, asc, eq, getTableColumns, gt, inArray, or } from "drizzle-orm";
import type { PgTableWithColumns, TableConfig } from "drizzle-orm/pg-core";

import * as schema from "@/db/schema";
import { shots, users } from "@/db/schema";
import { getDb } from "@/db/client";
import { getOptionalCurrentUserId } from "@/lib/current-user";
import { dataGovernanceManifest, exportRulesForGovernance } from "@/lib/data-governance-manifest";
import { createPersonalDataExport } from "@/lib/personal-data-export";
import { recordProductWorkflowEvent } from "@/lib/product-events";

export const dynamic = "force-dynamic";

const SHOT_PAGE_LIMIT = 5_000;
type ExportTable = PgTableWithColumns<TableConfig>;

export async function GET(request?: Request) {
  const userId = await getOptionalCurrentUserId();

  if (!userId) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  const shotCursor = parseShotCursor(request);
  const exportedAt = new Date();
  const db = getDb();
  const [profile] = await db.select().from(users).where(eq(users.id, userId));

  const exportableDatasets = dataGovernanceManifest.filter(
    (entry) => entry.export && entry.dataset !== "users" && entry.dataset !== "shots",
  );
  const queriedDatasets = await Promise.all(
    exportableDatasets.map(async (entry) => {
      const table = schema[entry.dataset as keyof typeof schema] as unknown as
        | ExportTable
        | undefined;
      if (!table) {
        throw new Error(`Export table binding missing for ${entry.dataset}.`);
      }

      const columns = getTableColumns(table) as Record<string, Parameters<typeof eq>[0]>;
      const exportRules = exportRulesForGovernance(entry);
      const ownerConditions = exportRules.map((rule) => {
        const column = columns[rule.ownerField];
        if (!column) {
          throw new Error(
            `Export owner field ${entry.dataset}.${rule.ownerField} is not in the schema.`,
          );
        }
        const ownerCondition = eq(column, userId);
        if (!rule.requiredField || !rule.allowedValues?.length) return ownerCondition;

        const requiredColumn = columns[rule.requiredField];
        if (!requiredColumn) {
          throw new Error(
            `Export rule field ${entry.dataset}.${rule.requiredField} is not in the schema.`,
          );
        }

        return and(ownerCondition, inArray(requiredColumn, rule.allowedValues));
      });
      if (ownerConditions.length === 0) {
        throw new Error(`Exportable dataset ${entry.dataset} has no owner field.`);
      }

      const rows = await db
        .select()
        .from(table)
        .where(ownerConditions.length === 1 ? ownerConditions[0] : or(...ownerConditions));
      return [entry.dataset, rows] as const;
    }),
  );

  const shotPageRows = await db
    .select()
    .from(shots)
    .where(
      shotCursor
        ? and(eq(shots.userId, userId), gt(shots.id, shotCursor))
        : eq(shots.userId, userId),
    )
    .orderBy(asc(shots.id))
    .limit(SHOT_PAGE_LIMIT + 1);
  const hasMoreShots = shotPageRows.length > SHOT_PAGE_LIMIT;
  const shotRows = shotPageRows.slice(0, SHOT_PAGE_LIMIT);
  const nextShotCursor = hasMoreShots ? (shotRows.at(-1)?.id ?? null) : null;

  const payload = createPersonalDataExport({
    userId,
    exportedAt,
    profile: profile ?? null,
    data: {
      ...Object.fromEntries(queriedDatasets),
      shots: shotRows,
    },
  });

  recordProductWorkflowEvent("personal_export_completed", {
    datasets: queriedDatasets.length + 2,
    count: shotRows.length,
    hasMore: hasMoreShots,
  });

  return Response.json(
    {
      ...payload,
      pagination: {
        shots: {
          limit: SHOT_PAGE_LIMIT,
          cursor: shotCursor,
          nextCursor: nextShotCursor,
          hasMore: hasMoreShots,
          nextPath: nextShotCursor
            ? `/api/settings/export?shotCursor=${encodeURIComponent(nextShotCursor)}`
            : null,
        },
      },
    },
    {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `attachment; filename="forekinghell-personal-export-${exportedAt.toISOString().slice(0, 10)}.json"`,
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}

function parseShotCursor(request?: Request) {
  if (!request) return null;

  const value = new URL(request.url).searchParams.get("shotCursor")?.trim() ?? "";
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null;
}
