import "dotenv/config";

import process from "node:process";

import postgres, { type TransactionSql } from "postgres";

import { isShortGameTouchClubType, isTrackedClubType } from "../src/lib/club-format";
import { calculateStockYardage } from "../src/lib/stock-yardage";

type StockGroup = {
  userId: string;
  clubId: string;
  clubType: string;
  playContext: string;
};

type RebuildSummary = {
  groups: number;
  updated: number;
  inserted: number;
  empty: number;
};

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required.");
}

const apply = process.argv.includes("--apply");
const rebuildAll = process.argv.includes("--all");
const sql = postgres(databaseUrl, { max: 1, prepare: false });

async function main() {
  try {
    const summary = apply
      ? await sql.begin((tx) => rebuildCurrentStockYardages(tx, true))
      : await rebuildCurrentStockYardages(
          sql as unknown as TransactionSql<Record<string, never>>,
          false,
        );

    console.log(
      JSON.stringify(
        {
          mode: apply ? "apply" : "dry-run",
          scope: rebuildAll ? "all" : "lifecycle-affected",
          ...summary,
        },
        null,
        2,
      ),
    );
  } finally {
    await sql.end();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Stock-yardage rebuild failed.");
  process.exitCode = 1;
});

async function rebuildCurrentStockYardages(
  connection: TransactionSql<Record<string, never>>,
  mutate: boolean,
): Promise<RebuildSummary> {
  const groups = (
    await connection<StockGroup[]>`
    select distinct
      shot.user_id as "userId",
      shot.club_id as "clubId",
      club.type as "clubType",
      shot.play_context as "playContext"
    from fkh_shots shot
    inner join fkh_clubs club
      on club.id = shot.club_id
     and club.user_id = shot.user_id
    where (${rebuildAll} or shot.review_status <> 'included')
    order by shot.user_id, shot.club_id, shot.play_context
  `
  ).filter(
    (group) => isTrackedClubType(group.clubType) && !isShortGameTouchClubType(group.clubType),
  );
  const summary: RebuildSummary = {
    groups: groups.length,
    updated: 0,
    inserted: 0,
    empty: 0,
  };
  const calculatedAt = new Date();

  for (const group of groups) {
    const shotRows = await connection<
      Array<{
        clubType: string;
        carryYd: number | null;
        totalYd: number | null;
        sideCarryYd: number | null;
        ballSpeedMph: number | null;
        launchAngleDeg: number | null;
        courseHoleNumber: number | null;
        playContext: string;
        sessionType: string;
        reviewStatus:
          | "included"
          | "suggested_exclusion"
          | "user_excluded"
          | "restored"
          | "calibration"
          | "warm_up"
          | "launch_monitor_error";
        shotCategory: string | null;
        qualityTag: string | null;
        shotAt: Date;
      }>
    >`
      select
        shot.club_type as "clubType",
        shot.carry_yd as "carryYd",
        shot.total_yd as "totalYd",
        shot.side_carry_yd as "sideCarryYd",
        shot.ball_speed_mph as "ballSpeedMph",
        shot.launch_angle_deg as "launchAngleDeg",
        shot.course_hole_number as "courseHoleNumber",
        shot.play_context as "playContext",
        session.type as "sessionType",
        shot.review_status as "reviewStatus",
        shot.shot_category as "shotCategory",
        shot.quality_tag as "qualityTag",
        shot.shot_at as "shotAt"
      from fkh_shots shot
      inner join fkh_sessions session
        on session.id = shot.session_id
       and session.user_id = shot.user_id
      where shot.user_id = ${group.userId}
        and shot.club_id = ${group.clubId}
        and shot.play_context = ${group.playContext}
      order by shot.shot_at desc
    `;
    const stock = calculateStockYardage(shotRows, 50, { clubType: group.clubType });
    const [latest] = await connection<Array<{ id: string }>>`
      select id
      from fkh_stock_yardages
      where user_id = ${group.userId}
        and club_id = ${group.clubId}
        and play_context = ${group.playContext}
      order by calculated_at desc, created_at desc, id desc
      limit 1
    `;

    if (stock.sampleSize === 0) {
      summary.empty += 1;
    }

    if (latest) {
      summary.updated += 1;

      if (mutate) {
        await connection`
          update fkh_stock_yardages
          set
            calculated_at = ${calculatedAt},
            sample_size = ${stock.sampleSize},
            carry_median_yd = ${stock.carryMedianYd},
            carry_mean_yd = ${stock.carryMeanYd},
            carry_p75_yd = ${stock.carryP75Yd},
            carry_p25_yd = ${stock.carryP25Yd},
            total_median_yd = ${stock.totalMedianYd},
            dispersion_left_yd = ${stock.dispersionLeftYd},
            dispersion_right_yd = ${stock.dispersionRightYd},
            confidence_score = ${stock.confidenceScore},
            recommended_play_number_yd = ${stock.recommendedPlayNumberYd}
          where id = ${latest.id}
            and user_id = ${group.userId}
        `;
      }

      continue;
    }

    summary.inserted += 1;

    if (mutate) {
      await connection`
        insert into fkh_stock_yardages (
          user_id,
          club_id,
          play_context,
          calculated_at,
          sample_size,
          carry_median_yd,
          carry_mean_yd,
          carry_p75_yd,
          carry_p25_yd,
          total_median_yd,
          dispersion_left_yd,
          dispersion_right_yd,
          confidence_score,
          recommended_play_number_yd
        ) values (
          ${group.userId},
          ${group.clubId},
          ${group.playContext},
          ${calculatedAt},
          ${stock.sampleSize},
          ${stock.carryMedianYd},
          ${stock.carryMeanYd},
          ${stock.carryP75Yd},
          ${stock.carryP25Yd},
          ${stock.totalMedianYd},
          ${stock.dispersionLeftYd},
          ${stock.dispersionRightYd},
          ${stock.confidenceScore},
          ${stock.recommendedPlayNumberYd}
        )
      `;
    }
  }

  return summary;
}
