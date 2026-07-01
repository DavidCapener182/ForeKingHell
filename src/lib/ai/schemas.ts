import type { JsonSchema } from "@/lib/ai/client";

const stringOrNull = { type: ["string", "null"] };
const numberOrNull = { type: ["number", "null"] };
const integerOrNull = { type: ["integer", "null"] };
const booleanOrNull = { type: ["boolean", "null"] };

export const aiCoachSummarySchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "headline",
    "recommendation",
    "evidence",
    "coachNote",
    "drill",
    "timeNeeded",
    "retest",
    "practicePlan",
    "watchOut",
    "confidence",
  ],
  properties: {
    headline: { type: "string" },
    recommendation: { type: "string" },
    evidence: { type: "string" },
    coachNote: { type: "string" },
    drill: { type: "string" },
    timeNeeded: { type: "string" },
    retest: { type: "string" },
    practicePlan: { type: "array", items: { type: "string" } },
    watchOut: { type: "string" },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
  },
} satisfies JsonSchema;

export const coachChatAnswerSchema = {
  type: "object",
  additionalProperties: false,
  required: ["answer"],
  properties: {
    answer: { type: "string" },
  },
} satisfies JsonSchema;

export const dataChatAnswerSchema = {
  type: "object",
  additionalProperties: false,
  required: ["answer", "tips", "drills", "followUpQuestions", "confidence"],
  properties: {
    answer: { type: "string" },
    tips: { type: "array", items: { type: "string" } },
    drills: { type: "array", items: { type: "string" } },
    followUpQuestions: { type: "array", items: { type: "string" } },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
  },
} satisfies JsonSchema;

const scorecardHoleSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "holeNumber",
    "par",
    "yards",
    "strokeIndex",
    "score",
    "netScore",
    "fairwayHit",
    "gir",
    "putts",
  ],
  properties: {
    holeNumber: { type: "integer" },
    par: integerOrNull,
    yards: integerOrNull,
    strokeIndex: integerOrNull,
    score: integerOrNull,
    netScore: integerOrNull,
    fairwayHit: booleanOrNull,
    gir: booleanOrNull,
    putts: integerOrNull,
  },
};

export const scorecardExtractionSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "courseName",
    "dateIso",
    "teeName",
    "totalYards",
    "courseRating",
    "slopeRating",
    "totalScore",
    "totalPutts",
    "fairwaysHitTotal",
    "girTotal",
    "holes",
    "confidence",
  ],
  properties: {
    courseName: stringOrNull,
    dateIso: stringOrNull,
    teeName: stringOrNull,
    totalYards: integerOrNull,
    courseRating: numberOrNull,
    slopeRating: integerOrNull,
    totalScore: integerOrNull,
    totalPutts: integerOrNull,
    fairwaysHitTotal: integerOrNull,
    girTotal: integerOrNull,
    holes: { type: "array", items: scorecardHoleSchema },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
  },
} satisfies JsonSchema;

export const recapSchema = {
  type: "object",
  additionalProperties: false,
  required: ["headline", "coachNote", "practicePlan", "watchOut"],
  properties: {
    headline: { type: "string" },
    coachNote: { type: "string" },
    practicePlan: { type: "array", items: { type: "string" } },
    watchOut: { type: "string" },
  },
} satisfies JsonSchema;

export const practiceRecapSchema = {
  type: "object",
  additionalProperties: false,
  required: ["headline", "coachNote", "strongestSignal", "risk", "nextDrill", "confidence"],
  properties: {
    headline: { type: "string" },
    coachNote: { type: "string" },
    strongestSignal: { type: "string" },
    risk: { type: "string" },
    nextDrill: { type: "string" },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
  },
} satisfies JsonSchema;

export const courseStrategySchema = {
  type: "object",
  additionalProperties: false,
  required: ["recommendation", "reason", "risk", "alternative", "confidence"],
  properties: {
    recommendation: { type: "string" },
    reason: { type: "string" },
    risk: { type: "string", enum: ["Conservative", "Balanced", "Aggressive"] },
    alternative: { type: "string" },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
  },
} satisfies JsonSchema;

export const socialCaptionSchema = {
  type: "object",
  additionalProperties: false,
  required: ["headline", "caption", "shortCaption", "hashtags", "safetyNote"],
  properties: {
    headline: { type: "string" },
    caption: { type: "string" },
    shortCaption: { type: "string" },
    hashtags: { type: "array", items: { type: "string" } },
    safetyNote: { type: "string" },
  },
} satisfies JsonSchema;

export const sessionRoastSchema = {
  type: "object",
  additionalProperties: false,
  required: ["headline", "roast", "shortCaption", "safetyNote"],
  properties: {
    headline: { type: "string" },
    roast: { type: "string" },
    shortCaption: { type: "string" },
    safetyNote: { type: "string" },
  },
} satisfies JsonSchema;

export const challengeCopySchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "description", "encouragement", "sessionFrame"],
  properties: {
    title: { type: "string" },
    description: { type: "string" },
    encouragement: { type: "string" },
    sessionFrame: { type: "string" },
  },
} satisfies JsonSchema;
