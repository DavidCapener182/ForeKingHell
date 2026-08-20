import nextEnv from "@next/env";
import postgres from "postgres";

const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd());

const ACHIEVEMENTS = {
  practice_planner_first_plan: {
    xp: 100,
    name: "Session Architect",
  },
  practice_planner_first_completed: {
    xp: 100,
    name: "Planned Practice",
  },
  practice_planner_five_completed: {
    xp: 200,
    name: "Practice Habit",
  },
  practice_planner_target_beaten: {
    xp: 200,
    name: "Beat The Plan",
  },
  practice_planner_priority_fixed: {
    xp: 250,
    name: "Priority Fixed",
  },
  practice_planner_drill_winner: {
    xp: 100,
    name: "Drill Winner",
  },
  practice_planner_three_drills_won: {
    xp: 200,
    name: "Block Hat-Trick",
  },
  practice_planner_five_drills_won: {
    xp: 300,
    name: "Range Sweep",
  },
  practice_planner_clean_card: {
    xp: 400,
    name: "Clean Card",
  },
};

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not configured.");
}

const sql = postgres(databaseUrl, { prepare: false, max: 1, idle_timeout: 5 });

try {
  const rows = await sql`
    select
      pp.user_id,
      pp.id as practice_plan_id,
      pp.title as plan_title,
      pp.created_at as plan_created_at,
      (
        select count(*)::int
        from fkh_practice_blocks pb_count
        where pb_count.practice_plan_id = pp.id
      ) as plan_block_count,
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'title', pb_plan.title,
              'clubs', pb_plan.clubs_json,
              'ballCount', pb_plan.ball_count,
              'scoringRules', pb_plan.scoring_rules_json
            )
            order by pb_plan.block_order
          )
          from fkh_practice_blocks pb_plan
          where pb_plan.practice_plan_id = pp.id
        ),
        '[]'::jsonb
      ) as plan_blocks,
      pr.id as practice_result_id,
      pr.source_session_id,
      pr.completion_status,
      pr.practice_score,
      pr.created_at as result_created_at,
      pr.comparison_json,
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'clubType', s.club_type,
              'carryYd', s.carry_yd,
              'launchDirectionDeg', s.launch_direction_deg,
              'sideCarryYd', s.side_carry_yd,
              'clubPathDeg', s.club_path_deg
            )
            order by s.shot_number nulls last, s.shot_at
          )
          from fkh_shots s
          where s.user_id = pp.user_id and s.session_id = pr.source_session_id
            and (
              coalesce(s.review_status, 'included') = 'restored'
              or (
                coalesce(s.review_status, 'included') = 'included'
                and lower(trim(coalesce(s.quality_tag, ''))) not like 'exclude%'
                and lower(trim(coalesce(s.quality_tag, ''))) not in (
                  'exclude', 'excluded', 'delete', 'deleted', 'calibration',
                  'warm-up', 'warmup', 'warm_up', 'bad-data', 'bad_data',
                  'invalid', 'launch-monitor-error', 'misread', 'fat', 'mishit', 'thin', 'top'
                )
                and lower(trim(coalesce(s.shot_category, ''))) not in ('warm-up', 'warmup', 'warm_up')
              )
            )
        ),
        '[]'::jsonb
      ) as shot_rows,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'title', pb.title,
            'actualBalls', pbr.actual_balls,
            'passed', pbr.passed,
            'result', pbr.result
          )
          order by pb.block_order
        ) filter (where pbr.id is not null),
        '[]'::jsonb
      ) as block_results
    from fkh_practice_plans pp
    left join fkh_practice_results pr on pr.practice_plan_id = pp.id
    left join fkh_practice_block_results pbr on pbr.practice_result_id = pr.id
    left join fkh_practice_blocks pb on pb.id = pbr.practice_block_id
    group by pp.id, pr.id
    order by pp.user_id, pp.created_at, pr.created_at
  `;

  const byUser = groupBy(rows, (row) => row.user_id);
  const plannedAwards = [];

  for (const [userId, userRows] of byUser.entries()) {
    const planRows = userRows.filter((row) => row.practice_plan_id);
    const resultRows = userRows.filter(
      (row) =>
        row.practice_result_id && row.source_session_id && row.completion_status === "complete",
    );
    const candidateMap = new Map();
    const earliestPlan = planRows[0];

    if (earliestPlan) {
      addCandidate(candidateMap, "practice_planner_first_plan", {
        userId,
        unlockedAt: earliestPlan.plan_created_at,
        metadata: {
          source: "practice_planner_backfill",
          event: "created",
          practicePlanId: earliestPlan.practice_plan_id,
        },
      });
    }

    if (resultRows.length >= 1) {
      const firstResult = resultRows[0];
      addResultCandidate(candidateMap, "practice_planner_first_completed", userId, firstResult, {
        event: "completed",
      });
    }

    if (resultRows.length >= 5) {
      const fifthResult = resultRows[4];
      addResultCandidate(candidateMap, "practice_planner_five_completed", userId, fifthResult, {
        event: "completed",
        completedCount: resultRows.length,
      });
    }

    for (const row of resultRows) {
      const stats = bestPracticeResultStats(row);
      const practiceScore = Number(row.practice_score ?? 0);

      if (practiceScore >= 80) {
        addResultCandidate(candidateMap, "practice_planner_target_beaten", userId, row, stats);
      }

      if (priorityImproved(row, stats)) {
        addResultCandidate(candidateMap, "practice_planner_priority_fixed", userId, row, stats);
      }

      if (stats.wonDrills >= 1) {
        addResultCandidate(candidateMap, "practice_planner_drill_winner", userId, row, stats);
      }

      if (stats.wonDrills >= 3) {
        addResultCandidate(candidateMap, "practice_planner_three_drills_won", userId, row, stats);
      }

      if (stats.wonDrills >= 5) {
        addResultCandidate(candidateMap, "practice_planner_five_drills_won", userId, row, stats);
      }

      if (
        stats.planBlocks >= 3 &&
        stats.scoredDrills >= stats.planBlocks &&
        stats.wonDrills === stats.planBlocks
      ) {
        addResultCandidate(candidateMap, "practice_planner_clean_card", userId, row, stats);
      }
    }

    plannedAwards.push(...candidateMap.values());
  }

  let insertedAchievements = 0;
  let insertedXpRows = 0;

  await sql.begin(async (tx) => {
    for (const award of plannedAwards) {
      const definition = ACHIEVEMENTS[award.achievementId];

      if (!definition) {
        continue;
      }

      const [inserted] = await tx`
        insert into fkh_user_achievements (
          user_id,
          achievement_id,
          first_unlocked_at,
          last_unlocked_at,
          unlock_count,
          source_session_id,
          xp_awarded,
          metadata_json,
          created_at,
          updated_at
        )
        values (
          ${award.userId},
          ${award.achievementId},
          ${award.unlockedAt},
          ${award.unlockedAt},
          1,
          ${award.sourceSessionId},
          ${definition.xp},
          ${sql.json(award.metadata)},
          ${award.unlockedAt},
          now()
        )
        on conflict (user_id, achievement_id) do nothing
        returning achievement_id
      `;

      if (!inserted) {
        continue;
      }

      insertedAchievements += 1;

      const [xpRow] = await tx`
        insert into fkh_xp_ledger (
          user_id,
          amount,
          reason,
          achievement_id,
          session_id,
          dedupe_key,
          metadata_json,
          created_at
        )
        values (
          ${award.userId},
          ${definition.xp},
          'achievement',
          ${award.achievementId},
          ${award.sourceSessionId},
          ${`achievement:${award.achievementId}`},
          ${sql.json({ achievementName: definition.name, ...award.metadata })},
          ${award.unlockedAt}
        )
        on conflict (user_id, dedupe_key) do nothing
        returning id
      `;

      if (xpRow) {
        insertedXpRows += 1;
      }
    }
  });

  console.log(
    JSON.stringify(
      {
        usersScanned: byUser.size,
        candidateAwards: plannedAwards.length,
        insertedAchievements,
        insertedXpRows,
      },
      null,
      2,
    ),
  );
} finally {
  await sql.end();
}

function groupBy(items, keyFn) {
  const grouped = new Map();

  for (const item of items) {
    const key = keyFn(item);

    if (!key) {
      continue;
    }

    const bucket = grouped.get(key) ?? [];
    bucket.push(item);
    grouped.set(key, bucket);
  }

  return grouped;
}

function addCandidate(map, achievementId, award) {
  if (map.has(achievementId)) {
    return;
  }

  map.set(achievementId, {
    achievementId,
    sourceSessionId: null,
    ...award,
  });
}

function addResultCandidate(map, achievementId, userId, row, extraMetadata = {}) {
  addCandidate(map, achievementId, {
    userId,
    unlockedAt: row.result_created_at ?? row.plan_created_at,
    sourceSessionId: row.source_session_id,
    metadata: {
      source: "practice_planner_backfill",
      event: "completed",
      practicePlanId: row.practice_plan_id,
      practiceResultId: row.practice_result_id,
      practiceScore: row.practice_score,
      ...extraMetadata,
    },
  });
}

function bestPracticeResultStats(row) {
  const blockStats = statsFromBlockResults(row.block_results ?? [], row.plan_block_count);
  const comparisonStats = statsFromComparison(row.comparison_json, row.plan_block_count);
  const aggregateStats = statsFromAggregateShots(
    row.plan_blocks ?? [],
    row.shot_rows ?? [],
    row.plan_block_count,
  );

  return [blockStats, comparisonStats, aggregateStats].sort((left, right) => {
    if (left.wonDrills !== right.wonDrills) {
      return right.wonDrills - left.wonDrills;
    }

    return right.scoredDrills - left.scoredDrills;
  })[0];
}

function statsFromBlockResults(blockResults, fallbackPlanBlocks) {
  let wonDrills = 0;
  let scoredDrills = 0;

  for (const block of blockResults) {
    const actualBalls = Number(block.actualBalls ?? 0);
    const result = block.result;

    if (actualBalls > 0 || result === "passed" || result === "mixed" || result === "failed") {
      scoredDrills += 1;
    }

    if (block.passed === true || result === "passed") {
      wonDrills += 1;
    }
  }

  return {
    wonDrills,
    scoredDrills,
    planBlocks: Number(fallbackPlanBlocks ?? blockResults.length ?? 0),
  };
}

function statsFromComparison(comparisonJson, fallbackPlanBlocks) {
  const decisions = Array.isArray(comparisonJson?.decisions) ? comparisonJson.decisions : [];
  let wonDrills = 0;
  let scoredDrills = 0;

  for (const decision of decisions) {
    const actualBalls = Number(decision.actualBalls ?? 0);
    const result = decision.result;

    if (actualBalls > 0 || result === "passed" || result === "mixed" || result === "failed") {
      scoredDrills += 1;
    }

    if (result === "passed") {
      wonDrills += 1;
    }
  }

  return {
    wonDrills,
    scoredDrills,
    planBlocks: Number(fallbackPlanBlocks ?? decisions.length ?? 0),
  };
}

function priorityImproved(row, stats) {
  const decisions = Array.isArray(row.comparison_json?.decisions)
    ? row.comparison_json.decisions
    : [];
  const firstDecision = decisions[0]?.decision;

  return firstDecision === "maintain" || firstDecision === "move_down" || stats.wonDrills >= 3;
}

function statsFromAggregateShots(planBlocks, shotRows, fallbackPlanBlocks) {
  if (!Array.isArray(planBlocks) || !Array.isArray(shotRows) || planBlocks.length === 0) {
    return {
      wonDrills: 0,
      scoredDrills: 0,
      planBlocks: Number(fallbackPlanBlocks ?? 0),
    };
  }

  let wonDrills = 0;
  let scoredDrills = 0;

  for (const block of planBlocks) {
    const clubs = Array.isArray(block.clubs) ? block.clubs.map(normalizeClubType) : [];
    const clubSet = new Set(clubs);
    const relevantRows =
      clubSet.size > 0
        ? shotRows.filter((row) => clubSet.has(normalizeClubType(row.clubType)))
        : shotRows;
    const result = evaluateAggregateBlock(block, relevantRows);

    if (result.actualBalls > 0 || result.result !== "insufficient_data") {
      scoredDrills += 1;
    }

    if (result.result === "passed") {
      wonDrills += 1;
    }
  }

  return {
    wonDrills,
    scoredDrills,
    planBlocks: Number(fallbackPlanBlocks ?? planBlocks.length),
  };
}

function evaluateAggregateBlock(block, rows) {
  const actualBalls = rows.length;
  const plannedBalls = Number(block.ballCount ?? actualBalls);
  const matchedPlannedVolume = actualBalls >= plannedBalls;
  const enoughSignal = actualBalls >= Math.ceil(plannedBalls * 0.65);

  if (actualBalls === 0 || !enoughSignal) {
    return { actualBalls, result: "insufficient_data" };
  }

  const metrics = blockMetrics(rows);
  const scoringRules =
    block.scoringRules && typeof block.scoringRules === "object" ? block.scoringRules : {};
  const target = Number(scoringRules.target ?? Math.ceil(plannedBalls * 0.65));
  const maxBigMisses = Number(
    scoringRules.maxBigMisses ?? Math.max(1, Math.floor(plannedBalls * 0.18)),
  );
  const metric = scoringRules.metric;
  const metricPassed =
    metric === "corridor"
      ? metrics.corridorCount >= target && metrics.bigMisses <= maxBigMisses
      : metric === "playable" || metric === "baseline"
        ? metrics.playableCount >= target || (metrics.playableRate ?? 0) >= 70
        : metric === "carry_ladder"
          ? (metrics.playableRate ?? 0) >= 65 && (metrics.offlineAverageYd ?? 99) <= 20
          : (metrics.playableRate ?? 0) >= 65 || metrics.corridorCount >= target;

  if (matchedPlannedVolume && metricPassed) {
    return { actualBalls, result: "passed" };
  }

  if (
    metricPassed ||
    (metrics.playableRate ?? 0) >= 60 ||
    metrics.corridorCount >= Math.ceil(target * 0.75)
  ) {
    return { actualBalls, result: "mixed" };
  }

  return { actualBalls, result: "failed" };
}

function blockMetrics(rows) {
  const actualBalls = rows.length;
  const playableRows = rows.filter(
    (row) => row.sideCarryYd !== null && Math.abs(Number(row.sideCarryYd)) <= 32,
  );
  const offlineRows = rows.filter((row) => row.sideCarryYd !== null);
  const launchRows = rows.filter((row) => row.launchDirectionDeg !== null);
  const corridorRows =
    launchRows.length > 0
      ? launchRows.filter((row) => Math.abs(Number(row.launchDirectionDeg)) <= 5)
      : offlineRows.filter((row) => Math.abs(Number(row.sideCarryYd)) <= 15);
  const carryRows = rows.filter((row) => row.carryYd !== null);
  const bigMissRows = offlineRows.filter((row) => Math.abs(Number(row.sideCarryYd)) > 32);

  return {
    playableCount: playableRows.length,
    playableRate:
      actualBalls > 0 && offlineRows.length > 0
        ? Math.round((playableRows.length / actualBalls) * 100)
        : null,
    corridorCount: corridorRows.length,
    bigMisses: bigMissRows.length,
    offlineAverageYd:
      offlineRows.length > 0
        ? roundOne(
            offlineRows.reduce((total, row) => total + Math.abs(Number(row.sideCarryYd)), 0) /
              offlineRows.length,
          )
        : null,
    carryAverageYd:
      carryRows.length > 0
        ? roundOne(
            carryRows.reduce((total, row) => total + Number(row.carryYd), 0) / carryRows.length,
          )
        : null,
  };
}

function normalizeClubType(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replaceAll(" ", "");
}

function roundOne(value) {
  return Math.round(value * 10) / 10;
}
