export type AiCaddieBriefConfidence = "high" | "medium" | "low";
export type AiCaddieBriefStatus = "ready" | "limited" | "missing";

export type AiCaddieBriefDataPoint = {
  label: string;
  value: string;
  detail: string;
  status: AiCaddieBriefStatus;
};

export type AiCaddieBriefPracticeBlock = {
  label: string;
  balls: number;
  task: string;
};

export type AiCaddieBriefAction = {
  label: string;
  href: string;
};

export type AiCaddieBrief = {
  schemaVersion: 1;
  generatedFrom: "rules-v1";
  title: "Today's AI Caddie Brief";
  headline: string;
  summary: string;
  focusClub: string | null;
  confidence: AiCaddieBriefConfidence;
  confidenceReason: string;
  practice: {
    durationMinutes: 30 | 45 | 60;
    ballCount: number;
    successMetric: string;
    blocks: AiCaddieBriefPracticeBlock[];
  };
  actions: {
    primary: AiCaddieBriefAction;
    secondary: AiCaddieBriefAction[];
  };
  dataUsed: AiCaddieBriefDataPoint[];
  warnings: string[];
};

export type AiCaddieBriefInput = {
  stats: {
    shotCount: number;
    sessionCount: number;
    roundCount: number;
  };
  latestSession: {
    fileName: string | null;
    dateLabel: string;
    shotCount: number;
    rawRowCount: number;
  } | null;
  rapsodoInbox: {
    pendingCount: number;
    latest: {
      title: string;
      shotCount: number | null;
    } | null;
  };
  bagSummary: {
    averageConfidence: number;
    trustedClubCount: number;
    mappedClubCount: number;
    leastTrusted: {
      label: string;
      playNumberYd: number | null;
      confidenceScore: number;
      sampleSize: number;
      missLabel: string;
      needsShots: number;
    } | null;
    mostTrusted: {
      label: string;
      confidenceScore: number;
      sampleSize: number;
    } | null;
  };
  coachPreview: {
    clubName: string;
    issueLabel: string;
    reason: string;
    drill: string;
    trustIndex: number;
    sampleSize: number;
    stockCarryYd: number | null;
    usualMiss: string;
    playableRate: number | null;
  } | null;
  dataHealth: {
    metric?: string;
    status?: string;
    detail: string;
    score?: number;
  };
  playContextSummary: {
    recommendation: string;
    onCourseShots: number;
    simulatorShots: number;
    practiceBayShots: number;
  };
  whatChanged: Array<{
    label: string;
    value: string;
    detail: string;
  }>;
  currentPracticePlan: {
    title: string;
    status: string;
    totalBalls: number | null;
    timeMinutes: number;
    focusClubs: string[];
  } | null;
};

const integerFormatter = new Intl.NumberFormat("en-GB");
const percentFormatter = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });

export function buildAiCaddieBrief(input: AiCaddieBriefInput): AiCaddieBrief {
  const pendingInbox = input.rapsodoInbox.pendingCount > 0;
  const focus = selectFocus(input);
  const confidence = resolveConfidence(input, focus);
  const durationMinutes = resolveDuration(input, confidence);
  const blocks = buildPracticeBlocks(input, focus);
  const ballCount = blocks.reduce((total, block) => total + block.balls, 0);
  const practiceHref = `/practice?source=caddie&time=${durationMinutes}&intent=latest_weakness#practice-plan`;
  const dataUsed = buildDataUsed(input);
  const warnings = buildWarnings(input, confidence);

  return {
    schemaVersion: 1,
    generatedFrom: "rules-v1",
    title: "Today's AI Caddie Brief",
    headline: buildHeadline(input, focus),
    summary: buildSummary(input, focus),
    focusClub: focus?.label ?? null,
    confidence,
    confidenceReason: confidenceReason(input, confidence),
    practice: {
      durationMinutes,
      ballCount,
      successMetric: buildSuccessMetric(input, focus),
      blocks,
    },
    actions: {
      primary: {
        label: "Start today's practice",
        href: practiceHref,
      },
      secondary: [
        { label: "Why this?", href: "#dashboard-caddie-evidence" },
        pendingInbox ? { label: "Review import", href: "/rapsodo" } : null,
        { label: "Change focus", href: "/practice#practice-plan" },
        { label: "Mark complete", href: "/practice#practice-plan" },
      ].filter((action): action is AiCaddieBriefAction => Boolean(action)),
    },
    dataUsed,
    warnings,
  };
}

function selectFocus(input: AiCaddieBriefInput) {
  if (input.coachPreview) {
    return {
      label: input.coachPreview.clubName,
      issue: input.coachPreview.issueLabel,
      reason: input.coachPreview.reason,
      drill: input.coachPreview.drill,
      trust: input.coachPreview.trustIndex,
      sampleSize: input.coachPreview.sampleSize,
      miss: input.coachPreview.usualMiss,
      stockCarryYd: input.coachPreview.stockCarryYd,
    };
  }

  if (input.bagSummary.leastTrusted) {
    const club = input.bagSummary.leastTrusted;
    return {
      label: club.label,
      issue: club.needsShots > 0 ? "trust building" : "stock window",
      reason: `${club.label} has ${club.sampleSize} stock shots and ${club.confidenceScore}% trust.`,
      drill: `Hit stock ${club.label} shots and record carry plus start line.`,
      trust: club.confidenceScore,
      sampleSize: club.sampleSize,
      miss: club.missLabel,
      stockCarryYd: club.playNumberYd,
    };
  }

  return null;
}

function resolveConfidence(
  input: AiCaddieBriefInput,
  focus: ReturnType<typeof selectFocus>,
): AiCaddieBriefConfidence {
  const dataHealthScore = input.dataHealth.score ?? null;

  if (input.stats.shotCount < 20 || !focus || (dataHealthScore !== null && dataHealthScore < 55)) {
    return "low";
  }

  if (
    input.stats.shotCount < 80 ||
    focus.sampleSize < 12 ||
    focus.trust < 65 ||
    input.bagSummary.averageConfidence < 65
  ) {
    return "medium";
  }

  return "high";
}

function resolveDuration(
  input: AiCaddieBriefInput,
  confidence: AiCaddieBriefConfidence,
): AiCaddieBrief["practice"]["durationMinutes"] {
  if (input.currentPracticePlan?.timeMinutes === 60) {
    return 60;
  }

  if (confidence === "low") {
    return 30;
  }

  return 45;
}

function buildPracticeBlocks(
  input: AiCaddieBriefInput,
  focus: ReturnType<typeof selectFocus>,
): AiCaddieBriefPracticeBlock[] {
  if (!focus) {
    return [
      {
        label: "Import",
        balls: 0,
        task: "Upload or connect one launch-monitor session before the app calls a practice focus.",
      },
      {
        label: "Map",
        balls: 0,
        task: "Confirm club mapping so the bag can build stock carry and dispersion.",
      },
      {
        label: "Review",
        balls: 0,
        task: "Open the first coach signal once the import creates normalized shot rows.",
      },
    ];
  }

  const mainBalls = focus.sampleSize < 12 ? 20 : 18;
  const pressureBalls = input.stats.shotCount >= 40 ? 9 : 5;

  return [
    {
      label: "Warm-up",
      balls: 8,
      task: "Start with smooth wedges and call playable or not before checking the screen.",
    },
    {
      label: "Main block",
      balls: mainBalls,
      task: focus.drill,
    },
    {
      label: "Stock check",
      balls: 10,
      task: `Hit normal ${focus.label} shots. Record carry, start line and whether the miss is ${focus.miss.toLowerCase()}.`,
    },
    {
      label: "Pressure finish",
      balls: pressureBalls,
      task: `One-ball ${focus.label} targets. Reset after every ball and count only playable shots.`,
    },
  ];
}

function buildHeadline(input: AiCaddieBriefInput, focus: ReturnType<typeof selectFocus>) {
  if (input.stats.shotCount === 0) {
    return "Import one launch-monitor session before the caddie can coach.";
  }

  if (input.rapsodoInbox.pendingCount > 0) {
    return "Start practice from the current signal, but review the Rapsodo inbox next.";
  }

  if (focus) {
    return `Practice ${focus.label} ${focus.issue.toLowerCase()} today.`;
  }

  return "Build a clean stock-shot baseline today.";
}

function buildSummary(input: AiCaddieBriefInput, focus: ReturnType<typeof selectFocus>) {
  if (input.stats.shotCount === 0) {
    return "The app needs saved shots before it can connect bag trust, dispersion and practice planning.";
  }

  const latest = input.latestSession
    ? `Latest import: ${integerFormatter.format(input.latestSession.shotCount)} shots on ${input.latestSession.dateLabel}.`
    : `${integerFormatter.format(input.stats.shotCount)} saved shots are available.`;
  const change = input.whatChanged[0]
    ? `${input.whatChanged[0].label}: ${input.whatChanged[0].value}.`
    : "Trend comparison is still building.";
  const focusCopy = focus
    ? `${focus.reason} Keep the next session narrow so the next import can prove whether it worked.`
    : "Map clubs first so the next session produces a real coach signal.";

  return `${latest} ${change} ${focusCopy}`;
}

function buildSuccessMetric(input: AiCaddieBriefInput, focus: ReturnType<typeof selectFocus>) {
  if (!focus) {
    return "One imported session with confirmed club mapping.";
  }

  if (focus.sampleSize < 12) {
    return `Add ${Math.max(0, 12 - focus.sampleSize)} more clean ${focus.label} shots and keep big misses named.`;
  }

  if (input.bagSummary.averageConfidence < 65) {
    return `Lift bag confidence above 65% while keeping ${focus.label} playable.`;
  }

  return `Beat ${Math.max(10, Math.round(focus.sampleSize * 0.65))} playable ${focus.label} shots without widening dispersion.`;
}

function buildDataUsed(input: AiCaddieBriefInput): AiCaddieBriefDataPoint[] {
  const latestSession: AiCaddieBriefDataPoint = input.latestSession
    ? {
        label: "Latest import",
        value: `${integerFormatter.format(input.latestSession.shotCount)} shots`,
        detail: `${input.latestSession.fileName ?? "Saved session"} on ${input.latestSession.dateLabel}.`,
        status: input.latestSession.shotCount > 0 ? "ready" : "limited",
      }
    : {
        label: "Latest import",
        value: "Missing",
        detail: "No saved launch-monitor session is available yet.",
        status: "missing",
      };
  const coachSignal: AiCaddieBriefDataPoint = input.coachPreview
    ? {
        label: "Coach signal",
        value: `${input.coachPreview.clubName} ${input.coachPreview.issueLabel}`,
        detail: `${input.coachPreview.trustIndex}% trust from ${input.coachPreview.sampleSize} stock shots.`,
        status: input.coachPreview.sampleSize >= 8 ? "ready" : "limited",
      }
    : {
        label: "Coach signal",
        value: "Building",
        detail: "Add mapped stock shots to unlock a specific club diagnosis.",
        status: "limited",
      };

  return [
    latestSession,
    {
      label: "Bag confidence",
      value: `${percentFormatter.format(input.bagSummary.averageConfidence)}%`,
      detail: `${input.bagSummary.trustedClubCount}/${input.bagSummary.mappedClubCount} mapped clubs are trusted for decisions.`,
      status: input.bagSummary.averageConfidence >= 65 ? "ready" : "limited",
    },
    coachSignal,
    {
      label: "Data health",
      value: input.dataHealth.metric ?? input.dataHealth.status ?? "Review",
      detail: input.dataHealth.detail,
      status: (input.dataHealth.score ?? 0) >= 70 ? "ready" : "limited",
    },
    {
      label: "Play context",
      value: `${integerFormatter.format(input.playContextSummary.practiceBayShots + input.playContextSummary.simulatorShots)} bay/sim shots`,
      detail: input.playContextSummary.recommendation,
      status: input.playContextSummary.onCourseShots >= 20 ? "ready" : "limited",
    },
    {
      label: "Practice plan",
      value: input.currentPracticePlan?.title ?? "Generated on demand",
      detail: input.currentPracticePlan
        ? `${input.currentPracticePlan.status} plan, ${input.currentPracticePlan.timeMinutes} minutes.`
        : "Open Practice Planner to save today's caddie plan.",
      status: input.currentPracticePlan ? "ready" : "limited",
    },
  ];
}

function buildWarnings(input: AiCaddieBriefInput, confidence: AiCaddieBriefConfidence): string[] {
  const warnings: string[] = [];

  if (input.rapsodoInbox.pendingCount > 0) {
    warnings.push(
      `${integerFormatter.format(input.rapsodoInbox.pendingCount)} Rapsodo session${input.rapsodoInbox.pendingCount === 1 ? "" : "s"} still need review before the bag is fully current.`,
    );
  }

  if (input.stats.shotCount < 20) {
    warnings.push(
      "Shot sample is still small, so the brief is a baseline request, not a strong diagnosis.",
    );
  }

  if (input.bagSummary.averageConfidence < 60 && input.stats.shotCount > 0) {
    warnings.push(
      "Bag confidence is below launch-day target; trust the practice task more than the yardage call.",
    );
  }

  if (confidence === "low" && warnings.length === 0) {
    warnings.push("Confidence is low because at least one core evidence source is missing.");
  }

  return warnings.slice(0, 3);
}

function confidenceReason(input: AiCaddieBriefInput, confidence: AiCaddieBriefConfidence) {
  if (confidence === "high") {
    return "Recent shots, bag trust and coach signal are all strong enough for a specific practice call.";
  }

  if (confidence === "medium") {
    return "The brief has enough saved data to choose a focus, but the next import still needs to prove the result.";
  }

  if (input.stats.shotCount === 0) {
    return "No saved shot rows are available yet.";
  }

  return "The brief is limited by sample size, bag trust or data-health warnings.";
}
