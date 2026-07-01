export type WindEffect = "calm" | "helping" | "hurting" | "cross";

export type PlaysLikeConditions = {
  temperatureC?: number | null;
  altitudeM?: number | null;
  humidityPct?: number | null;
  windSpeedMph?: number | null;
  windDirectionDeg?: number | null;
  windDirectionLabel?: string | null;
  windEffect?: WindEffect | null;
};

export type PlaysLikeAdjustment = {
  baseYards: number;
  playsLikeYards: number;
  deltaYards: number;
  components: {
    temperatureYards: number;
    altitudeYards: number;
    humidityYards: number;
    windYards: number;
  };
  confidence: "measured" | "estimated" | "neutral";
  summary: string;
};

const neutralTemperatureC = 18;

export function calculatePlaysLikeYards(
  baseYards: number | null | undefined,
  conditions: PlaysLikeConditions,
): PlaysLikeAdjustment | null {
  if (typeof baseYards !== "number" || !Number.isFinite(baseYards) || baseYards <= 0) {
    return null;
  }

  const temperatureYards = temperatureAdjustment(baseYards, conditions.temperatureC);
  const altitudeYards = altitudeAdjustment(baseYards, conditions.altitudeM);
  const humidityYards = humidityAdjustment(baseYards, conditions.humidityPct);
  const windYards = windAdjustment(baseYards, conditions.windSpeedMph, conditions.windEffect);
  const deltaYards = roundOne(temperatureYards + altitudeYards + humidityYards + windYards);
  const playsLikeYards = Math.max(1, roundOne(baseYards + deltaYards));
  const measuredInputs = [
    conditions.temperatureC,
    conditions.altitudeM,
    conditions.humidityPct,
    conditions.windSpeedMph,
  ].filter((value) => typeof value === "number" && Number.isFinite(value)).length;
  const confidence =
    measuredInputs >= 3 ? "measured" : measuredInputs > 0 ? "estimated" : "neutral";

  return {
    baseYards: roundOne(baseYards),
    playsLikeYards,
    deltaYards,
    components: {
      temperatureYards,
      altitudeYards,
      humidityYards,
      windYards,
    },
    confidence,
    summary: adjustmentSummary(deltaYards, confidence),
  };
}

export function parsePlaysLikeConditions(
  weatherJson: Record<string, unknown> | null | undefined,
): PlaysLikeConditions {
  const temperatureC = numberFromUnknown(weatherJson?.temperatureC ?? weatherJson?.temperature_c);
  const temperatureText = stringFromUnknown(weatherJson?.temperature);
  const windSpeedMph = numberFromUnknown(weatherJson?.windSpeedMph ?? weatherJson?.wind_speed_mph);
  const windText = stringFromUnknown(weatherJson?.wind);

  return {
    temperatureC: temperatureC ?? parseTemperatureC(temperatureText),
    windSpeedMph: windSpeedMph ?? parseWindSpeedMph(windText),
    windDirectionDeg: numberFromUnknown(
      weatherJson?.windDirectionDeg ?? weatherJson?.wind_direction_deg,
    ),
    windDirectionLabel:
      stringFromUnknown(weatherJson?.windDirectionLabel ?? weatherJson?.wind_direction_label) ??
      null,
    windEffect: inferWindEffect(windText),
    humidityPct: numberFromUnknown(weatherJson?.humidityPct ?? weatherJson?.humidity_pct),
    altitudeM: numberFromUnknown(weatherJson?.altitudeM ?? weatherJson?.altitude_m),
  };
}

function temperatureAdjustment(baseYards: number, temperatureC: number | null | undefined) {
  if (typeof temperatureC !== "number" || !Number.isFinite(temperatureC)) {
    return 0;
  }

  return roundOne(((neutralTemperatureC - temperatureC) / 5) * (baseYards * 0.01));
}

function altitudeAdjustment(baseYards: number, altitudeM: number | null | undefined) {
  if (typeof altitudeM !== "number" || !Number.isFinite(altitudeM)) {
    return 0;
  }

  const altitudeFt = altitudeM * 3.28084;
  return roundOne(-(altitudeFt / 1000) * (baseYards * 0.02));
}

function humidityAdjustment(baseYards: number, humidityPct: number | null | undefined) {
  if (typeof humidityPct !== "number" || !Number.isFinite(humidityPct)) {
    return 0;
  }

  return roundOne(((50 - humidityPct) / 50) * (baseYards * 0.003));
}

function windAdjustment(
  baseYards: number,
  windSpeedMph: number | null | undefined,
  windEffect: WindEffect | null | undefined,
) {
  if (typeof windSpeedMph !== "number" || !Number.isFinite(windSpeedMph) || windSpeedMph <= 0) {
    return 0;
  }

  const capped = Math.min(windSpeedMph, 35);
  if (windEffect === "hurting") {
    return roundOne(capped * Math.max(0.35, baseYards / 300));
  }
  if (windEffect === "helping") {
    return roundOne(-capped * Math.max(0.25, baseYards / 420));
  }
  if (windEffect === "cross") {
    return roundOne(capped * 0.08);
  }

  return 0;
}

function adjustmentSummary(deltaYards: number, confidence: PlaysLikeAdjustment["confidence"]) {
  if (Math.abs(deltaYards) < 1) {
    return confidence === "neutral" ? "Neutral until weather is known" : "Playing close to stock";
  }

  return deltaYards > 0
    ? `Playing ${Math.round(deltaYards)} yd longer`
    : `Playing ${Math.abs(Math.round(deltaYards))} yd shorter`;
}

function parseTemperatureC(value: string | null) {
  if (!value) {
    return null;
  }

  const match = value.match(/-?\d+(?:\.\d+)?/);
  if (!match) {
    return null;
  }

  const parsed = Number(match[0]);
  return /f\b/i.test(value) ? ((parsed - 32) * 5) / 9 : parsed;
}

function parseWindSpeedMph(value: string | null) {
  if (!value) {
    return null;
  }

  const match = value.match(/\d+(?:\.\d+)?/);
  if (!match) {
    return null;
  }

  const parsed = Number(match[0]);
  return /kph|km\/h/i.test(value) ? parsed * 0.621371 : parsed;
}

function inferWindEffect(value: string | null): WindEffect {
  if (!value) {
    return "calm";
  }

  const normalized = value.toLowerCase();
  if (/\b(headwind|head|into|against|hurting)\b/.test(normalized)) {
    return "hurting";
  }
  if (/\b(tailwind|tail|downwind|helping|behind)\b/.test(normalized)) {
    return "helping";
  }
  if (/\b(cross|left|right)\b/.test(normalized)) {
    return "cross";
  }

  return "calm";
}

function stringFromUnknown(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberFromUnknown(value: unknown) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function roundOne(value: number) {
  return Math.round(value * 10) / 10;
}
