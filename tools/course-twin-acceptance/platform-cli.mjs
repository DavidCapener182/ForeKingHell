#!/usr/bin/env node

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import postgres from "postgres";

const options = parseArguments(process.argv.slice(2));
const sql = postgres(requiredEnv("DATABASE_URL"), { prepare: false });
const ids = {
  temporaryCourse: randomUUID(),
  temporaryTeeSet: randomUUID(),
  tournament: randomUUID(),
  shareLink: null,
  round: null,
  session: null,
  submission: null,
};
const report = {
  reportVersion: 1,
  product: "ForeKingHell Course Twin live platform acceptance",
  startedAt: new Date().toISOString(),
  baseUrl: options.baseUrl,
  checks: [],
  cleanup: { completed: false },
};

try {
  await requireAcceptanceUser();
  await verifyGradeAPuttingWorkflow();
  await verifyPublicReplaySharing();
  await verifyTournamentWorkflow();
  report.passed = report.checks.every((check) => check.passed);
} catch (error) {
  report.passed = false;
  report.error = error instanceof Error ? error.message : "Live platform acceptance failed.";
} finally {
  try {
    await cleanup();
    report.cleanup = { completed: true };
  } catch (error) {
    report.passed = false;
    report.cleanup = {
      completed: false,
      error: error instanceof Error ? error.message : "Acceptance cleanup failed.",
    };
  }
  report.completedAt = new Date().toISOString();
  const outputPath = resolve(options.output);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  await sql.end();
  process.stdout.write(
    `${report.passed ? "PASS" : "FAIL"}: ${outputPath}\n${report.checks
      .map((check) => `${check.passed ? "✓" : "✗"} ${check.name}: ${check.evidence}`)
      .join("\n")}\n${report.cleanup.completed ? "✓" : "✗"} disposable data cleanup\n`,
  );
  if (!report.passed) process.exitCode = 2;
}

async function requireAcceptanceUser() {
  const [user] = await sql`
    select u.id, a.status, a.role
    from fkh_users u
    join fkh_admin_users a on a.user_id = u.id
    where u.id = ${options.userId}
      and a.status = 'active'
    limit 1
  `;
  addCheck("active-admin-user", Boolean(user), user ? `${user.role} ${user.id}` : "not found");
  if (!user) throw new Error("The local acceptance user must be an active administrator.");

  const response = await api("/api/course-twins/00000000-0000-4000-8000-000000000000/manifest");
  addCheck("authenticated-api-session", response.status === 404, `HTTP ${response.status}`);
  if (response.status !== 404) {
    throw new Error("The server is not accepting the local authenticated acceptance session.");
  }
}

async function verifyGradeAPuttingWorkflow() {
  const latitude = 53.453;
  const longitude = -2.978;
  await sql`
    insert into fkh_courses (
      id, name, country, latitude, longitude, provider, external_id,
      visibility, created_by_user_id, google_metadata_json
    ) values (
      ${ids.temporaryCourse}, 'Course Twin Grade A Acceptance', 'England', ${latitude}, ${longitude},
      'course_twin_acceptance', ${`acceptance-${ids.temporaryCourse}`}, 'private', ${options.userId}, '{}'::jsonb
    )
  `;
  await sql`
    insert into fkh_tee_sets (id, course_id, name, par, yards)
    values (${ids.temporaryTeeSet}, ${ids.temporaryCourse}, 'Acceptance', 3, 150)
  `;
  await sql`
    insert into fkh_holes (
      course_id, tee_set_id, hole_number, par, stroke_index, yards,
      tee_lat, tee_lng, green_lat, green_lng, centerline_geojson
    ) values (
      ${ids.temporaryCourse}, ${ids.temporaryTeeSet}, 1, 3, 1, 150,
      ${latitude - 0.001}, ${longitude}, ${latitude}, ${longitude},
      ${sql.json({
        type: "LineString",
        coordinates: [
          [longitude, latitude - 0.001],
          [longitude, latitude],
        ],
      })}
    )
  `;

  const imported = await api(`/api/course-twins/${ids.temporaryCourse}/putting-surveys`, {
    method: "POST",
    body: {
      holeNumber: 1,
      sourceName: "Course Twin synthetic acceptance grid",
      sourceUrl: null,
      capturedAt: "2026-07-22T12:00:00.000Z",
      coordinateSystem: "EPSG:4326",
      gridSpacingM: 0.25,
      verticalAccuracyMm: 10,
      grid: {
        bounds: {
          minLatitude: latitude - 0.00001,
          maxLatitude: latitude + 0.00001,
          minLongitude: longitude - 0.00001,
          maxLongitude: longitude + 0.00001,
        },
        width: 3,
        height: 3,
        elevationsM: [9.98, 9.99, 10, 9.99, 10, 10.01, 10, 10.01, 10.02],
      },
    },
  });
  const survey = await requireJson(imported, 201, "Grade A survey import");
  addCheck(
    "grade-a-survey-import",
    survey.status === "pending" && survey.gridSpacingM === 0.25,
    `HTTP ${imported.status}; ${survey.gridSpacingM} m; ${survey.verticalAccuracyMm} mm`,
  );

  const reviewed = await api(`/api/course-twins/${ids.temporaryCourse}/putting-surveys`, {
    method: "PATCH",
    body: { surveyId: survey.id, status: "verified", scorecardVerified: true },
  });
  const review = await requireJson(reviewed, 200, "Grade A survey review");
  const puttingSurveyCount = Number(
    review.build?.plan?.sourceGeometry?.puttingSurveys?.length ?? 0,
  );
  addCheck(
    "grade-a-review-and-rebuild",
    review.survey?.status === "verified" &&
      review.build?.status === "queued" &&
      puttingSurveyCount === 1,
    `survey ${review.survey?.status}; build ${review.build?.status}; ${puttingSurveyCount} grid(s)`,
  );
  if (review.survey?.status !== "verified" || review.build?.status !== "queued") {
    throw new Error("Verified Grade A survey did not queue an immutable Course Twin rebuild.");
  }
}

async function verifyTournamentWorkflow() {
  const [course] = await sql`
    select c.id, t.id as tee_set_id
    from fkh_courses c
    join fkh_tee_sets t on t.course_id = c.id
    where c.id = ${options.courseId}
    order by t.created_at asc
    limit 1
  `;
  if (!course) throw new Error("The acceptance course or tee set was not found.");
  const holes = await sql`
    select hole_number, par, yards
    from fkh_holes
    where course_id = ${options.courseId}
      and tee_set_id = ${course.tee_set_id}
    order by hole_number asc
    limit 9
  `;
  if (holes.length !== 9) throw new Error("Tournament acceptance requires nine mapped holes.");

  const active = await api(`/api/course-twins/${options.courseId}/rounds`);
  const activeRound = await requireJson(active, 200, "active Course Twin round check");
  if (activeRound) {
    throw new Error(
      `Finish or abandon active Course Twin round ${activeRound.id} before acceptance.`,
    );
  }

  await sql`
    insert into fkh_tournaments (
      id, title, description, course_id, tee_set_id, format, visibility, status,
      starts_at, ends_at, round_count, verification_policy, screenshot_required,
      direct_rapsodo_required, created_by_user_id, metadata_json
    ) values (
      ${ids.tournament}, 'Course Twin Tournament Acceptance',
      'Disposable live acceptance tournament. It is removed automatically.',
      ${options.courseId}, ${course.tee_set_id}, 'one_round_open', 'private', 'open',
      now() - interval '1 hour', now() + interval '1 hour', 1, 'silver', false, false,
      ${options.userId}, ${sql.json({ courseTwinAcceptance: true })}
    )
  `;
  await sql`
    insert into fkh_tournament_entries (
      tournament_id, user_id, status, metadata_json
    ) values (
      ${ids.tournament}, ${options.userId}, 'entered',
      ${sql.json({
        entryTermsAccepted: true,
        entryTermsAcceptedAt: new Date().toISOString(),
        entryTermsVersion: "2026-05-15-no-mulligans",
      })}
    )
  `;

  const created = await api(`/api/course-twins/${options.courseId}/rounds`, {
    method: "POST",
    body: {
      mode: "play",
      holeCount: 9,
      startingHole: 1,
      rules: {
        windSpeedMph: 0,
        windDirectionDeg: 0,
        greenRule: "competition_gimmes",
        mulligansAllowed: false,
        competition: true,
      },
    },
  });
  let round = await requireJson(created, 201, "competition round creation");
  ids.round = round.id;
  addCheck(
    "competition-round-ledger",
    round.rulesJson?.competition === true && round.rulesJson?.mulligansAllowed === false,
    `round ${round.id}; version ${round.version}`,
  );

  for (const hole of holes) {
    round = await appendRoundEvent(round, {
      type: "hole.completed",
      clientEventId: randomUUID(),
      payload: {
        holeNumber: hole.hole_number,
        par: hole.par,
        yards: hole.yards,
        strokes: 2,
        putts: 2,
        penalties: 0,
        fairwayHit: null,
        gir: null,
      },
    });
  }
  round = await appendRoundEvent(round, {
    type: "round.completed",
    clientEventId: randomUUID(),
    payload: {},
  });
  ids.session = round.sessionId;
  addCheck(
    "completed-hash-chained-round",
    round.status === "complete" && /^[0-9a-f]{64}$/.test(round.finalEventHash ?? ""),
    `status ${round.status}; hash ${round.finalEventHash}`,
  );

  const submitted = await api(`/api/course-twins/rounds/${round.id}/tournament`, {
    method: "POST",
    body: { tournamentId: ids.tournament, roundNumber: 1 },
  });
  const submission = await requireJson(submitted, 201, "Course Twin tournament submission");
  ids.submission = submission.submission;
  const [stored] = await sql`
    select verification_status, proof_status, gross_score, session_id
    from fkh_tournament_submissions
    where id = ${ids.submission}
  `;
  addCheck(
    "verified-tournament-submission",
    stored?.verification_status === "verified" && stored?.session_id === ids.session,
    `HTTP ${submitted.status}; ${stored?.verification_status}; gross ${stored?.gross_score}`,
  );
  if (stored?.verification_status !== "verified") {
    throw new Error("The Course Twin tournament submission was not verified.");
  }
}

async function verifyPublicReplaySharing() {
  const [session] = await sql`
    select id
    from fkh_sessions
    where user_id = ${options.userId}
      and course_id = ${options.courseId}
      and round_status = 'complete'
    order by date desc, created_at desc
    limit 1
  `;
  if (!session) throw new Error("Public replay acceptance requires a completed mapped round.");
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const [link] = await sql`
    insert into fkh_share_links (
      user_id, token_hash, resource_type, resource_id, title, expires_at
    ) values (
      ${options.userId}, ${tokenHash}, 'course_twin_replay', ${session.id},
      'Course Twin public replay acceptance', now() + interval '10 minutes'
    )
    returning id
  `;
  ids.shareLink = link.id;
  const response = await fetch(new URL(`/share/course-twin/${token}`, options.baseUrl), {
    headers: { Accept: "text/html" },
    redirect: "manual",
    signal: AbortSignal.timeout(30_000),
  });
  const html = await response.text();
  addCheck(
    "public-read-only-replay",
    response.status === 200 &&
      html.includes("Read-only replay") &&
      html.includes("Shared 3D round replay"),
    `HTTP ${response.status}; token stored as SHA-256 only`,
  );
}

async function appendRoundEvent(round, event) {
  const response = await api(`/api/course-twins/rounds/${round.id}/events`, {
    method: "POST",
    body: { expectedVersion: round.version, event },
  });
  return requireJson(response, 201, event.type);
}

async function cleanup() {
  if (ids.shareLink) await sql`delete from fkh_share_links where id = ${ids.shareLink}`;
  if (ids.submission) {
    await sql`
      delete from fkh_feed_items
      where source_type = 'tournament_submission'
        and source_id = ${ids.submission}
    `;
  }
  await sql`delete from fkh_tournaments where id = ${ids.tournament}`;
  if (ids.round) await sql`delete from fkh_course_twin_rounds where id = ${ids.round}`;
  if (ids.session) await sql`delete from fkh_sessions where id = ${ids.session}`;
  await sql`delete from fkh_courses where id = ${ids.temporaryCourse}`;

  const [counts] = await sql`
    select
      (select count(*)::int from fkh_tournaments where id = ${ids.tournament}) as tournaments,
      (select count(*)::int from fkh_share_links where id = ${ids.shareLink}) as share_links,
      (select count(*)::int from fkh_course_twin_rounds where id = ${ids.round}) as rounds,
      (select count(*)::int from fkh_sessions where id = ${ids.session}) as sessions,
      (select count(*)::int from fkh_courses where id = ${ids.temporaryCourse}) as courses
  `;
  if (Object.values(counts).some((count) => Number(count) !== 0)) {
    throw new Error(`Disposable records remain: ${JSON.stringify(counts)}`);
  }
}

async function api(pathname, { method = "GET", body } = {}) {
  return fetch(new URL(pathname, options.baseUrl), {
    method,
    headers: {
      Accept: "application/json",
      Cookie: localAuthCookie(options.userId),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
}

async function requireJson(response, expectedStatus, label) {
  const value = await response.json().catch(() => null);
  if (response.status !== expectedStatus) {
    throw new Error(`${label} returned HTTP ${response.status}: ${JSON.stringify(value)}`);
  }
  return value;
}

function localAuthCookie(userId) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const token = [
    encode({ alg: "none", typ: "JWT" }),
    encode({
      sub: userId,
      email: "playwright@forekinghell.local",
      user_metadata: { name: "Course Twin Acceptance" },
    }),
    "playwright",
  ].join(".");
  const value = encodeURIComponent(JSON.stringify({ access_token: token }));
  return `sb-playwright-auth-token=${value}`;
}

function addCheck(name, passed, evidence) {
  report.checks.push({ name, passed: Boolean(passed), evidence: String(evidence) });
  if (!passed) throw new Error(`${name} failed: ${evidence}`);
}

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function parseArguments(argumentsList) {
  const values = Object.fromEntries(
    argumentsList.flatMap((argument, index) =>
      argument.startsWith("--") ? [[argument.slice(2), argumentsList[index + 1]]] : [],
    ),
  );
  const baseUrl = new URL(values["base-url"] ?? "http://localhost:3200");
  if (!["localhost", "127.0.0.1"].includes(baseUrl.hostname)) {
    throw new Error("Live platform acceptance is restricted to a local server.");
  }
  return {
    baseUrl,
    userId: values.user ?? "c0c02d1e-605a-47c5-a023-83a1c0d18195",
    courseId: values.course ?? "4de11156-16fd-4a36-84e0-fadda53456b0",
    output:
      values.output ?? `dist/course-twin-acceptance/platform-${new Date().toISOString()}.json`,
  };
}
