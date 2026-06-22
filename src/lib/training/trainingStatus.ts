import { calculateGolfForm, type FitnessFreshnessPoint } from "@/lib/training/fitnessFreshness";

export type TrainingStatusKey = "very_fresh" | "fresh" | "balanced" | "productive" | "load_high";

export type TrainingStatus = {
  key: TrainingStatusKey;
  label: string;
  detail: string;
  advice: string;
  tone: "green" | "sky" | "amber" | "slate";
};

export type TrainingTrendKey =
  | "form_improving"
  | "form_dropping"
  | "fitness_rising"
  | "fitness_dropping"
  | "acute_load_spike"
  | "peaking"
  | "overloaded"
  | "detraining"
  | "steady";

export type TrainingTrend = {
  key: TrainingTrendKey;
  label: string;
  detail: string;
};

export function getTrainingStatus(
  fitness: number,
  fatigue: number,
  form = calculateGolfForm(fitness, fatigue),
): TrainingStatus {
  if (form >= 120) {
    return {
      key: "very_fresh",
      label: "Peak Form",
      detail: "Comparable golf sessions are at the top end of your current range.",
      advice:
        "This is a good window for quality practice, scoring work, or a competitive round if the swing feels ready.",
      tone: "sky",
    };
  }

  if (form >= 110) {
    return {
      key: "fresh",
      label: "Very good",
      detail: "Recent comparable golf is clearly above your baseline.",
      advice:
        "Keep the next session specific. If the latest comparable session was strong, build on that same pattern.",
      tone: "green",
    };
  }

  if (form >= 100) {
    return {
      key: "balanced",
      label: "Good",
      detail: "Your golf form is at or above your current baseline.",
      advice:
        "A normal practice session should keep momentum. Look to the session-quality signal for what to repeat or clean up.",
      tone: "green",
    };
  }

  if (form >= 90) {
    return {
      key: "productive",
      label: "Below baseline",
      detail: "Comparable golf has slipped below your baseline.",
      advice:
        "Consider a focused session rather than just more volume. Short game or a clear range block may rebuild the signal.",
      tone: "amber",
    };
  }

  return {
    key: "load_high",
    label: "Poor form",
    detail: "The comparable-session signal is well below baseline.",
    advice: "Review what was worse than the previous comparable session before adding more volume.",
    tone: "amber",
  };
}

export function getTrainingTrend(series: FitnessFreshnessPoint[]): TrainingTrend {
  const latest = series.at(-1);
  const sevenDaysAgo = series.at(Math.max(0, series.length - 8));
  const twoWeeksAgo = series.at(Math.max(0, series.length - 15));

  if (!latest || !sevenDaysAgo) {
    return {
      key: "steady",
      label: "Building baseline",
      detail: "Log a few more sessions to make the trend more useful.",
    };
  }

  const sevenDayLoad = series.slice(-7).reduce((total, point) => total + point.load, 0);
  const previousSevenDayLoad = series
    .slice(-14, -7)
    .reduce((total, point) => total + point.load, 0);
  const fitnessChange = latest.fitness - sevenDaysAgo.fitness;
  const fatigueChange = latest.fatigue - sevenDaysAgo.fatigue;
  const formChange = latest.form - sevenDaysAgo.form;
  const twoWeekFitnessChange = twoWeeksAgo ? latest.fitness - twoWeeksAgo.fitness : fitnessChange;

  if (formChange > 2) {
    return {
      key: "form_improving",
      label: "Golf Form improving",
      detail: `Golf Form is up ${Math.round(formChange).toLocaleString("en-GB")} points versus a week ago.`,
    };
  }

  if (formChange < -2) {
    return {
      key: "form_dropping",
      label: "Golf Form dropping",
      detail: `Golf Form is down ${Math.abs(Math.round(formChange)).toLocaleString("en-GB")} points versus a week ago.`,
    };
  }

  if (fatigueChange > 15 || sevenDayLoad > previousSevenDayLoad * 1.75) {
    return {
      key: "acute_load_spike",
      label: "Acute load spike",
      detail: "Workload is up sharply. Use this for practice planning, not as a form score.",
    };
  }

  if (latest.fatigue > latest.fitness * 1.8 && latest.fatigue > 80) {
    return {
      key: "overloaded",
      label: "Load watch",
      detail: "Short-term load is high compared with your baseline. Consider managing volume.",
    };
  }

  if (latest.form >= 105 && fatigueChange < -5) {
    return {
      key: "peaking",
      label: "Peaking",
      detail: "Golf Form is holding while short-term load is easing.",
    };
  }

  if (twoWeekFitnessChange < -5 && sevenDayLoad === 0) {
    return {
      key: "detraining",
      label: "Conditioning easing",
      detail: "Long-term golf workload is easing after a quiet spell.",
    };
  }

  if (fitnessChange > 5) {
    return {
      key: "fitness_rising",
      label: "Conditioning building",
      detail: "Your long-term golf workload is trending upward.",
    };
  }

  if (fitnessChange < -5) {
    return {
      key: "fitness_dropping",
      label: "Conditioning easing",
      detail: "Your long-term golf workload is easing after a lighter spell.",
    };
  }

  return {
    key: "steady",
    label: "Steady",
    detail: "Training load is moving gradually without a sharp spike.",
  };
}
