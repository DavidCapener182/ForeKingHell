import "server-only";
import { isDeepStrictEqual } from "node:util";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { adminAuditLog, challengeTemplates, challenges } from "@/db/schema";
import { requireAdminUser } from "@/lib/admin";

export const editableChallengeKinds = [
  "longest_drive",
  "straightest_drive",
  "wedge_ladder",
  "wedge_window",
  "consistency",
  "closest_to_pin",
  "practice_streak",
] as const;
export type AdminChallengeTemplateInput = {
  id?: string;
  expectedUpdatedAt?: string;
  slug: string;
  name: string;
  description: string;
  challengeType: string;
  scoringDirection: string;
  active: boolean;
  rulesJson: Record<string, unknown>;
};
export class TemplateValidationError extends Error {}
const invalid = (message: string): never => {
  throw new TemplateValidationError(message);
};
function validate(input: AdminChallengeTemplateInput) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug) || input.slug.length > 80)
    invalid("Use a unique lowercase slug with letters, numbers and hyphens.");
  if (!input.name.trim() || input.name.length > 160)
    invalid("Enter a template name of up to 160 characters.");
  if (!input.description.trim() || input.description.length > 5000)
    invalid("Enter a description of up to 5,000 characters.");
  if (input.scoringDirection !== "asc" && input.scoringDirection !== "desc")
    invalid("Choose ascending or descending scoring.");
  if (typeof input.active !== "boolean") invalid("Choose whether this template is available.");
  if (!input.rulesJson || typeof input.rulesJson !== "object" || Array.isArray(input.rulesJson))
    invalid("Rules must be a JSON object.");
  if (JSON.stringify(input.rulesJson).length > 16000) invalid("Template rules are too large.");
}
function validateScoring(input: AdminChallengeTemplateInput) {
  if (!(editableChallengeKinds as readonly string[]).includes(input.challengeType))
    invalid("Choose a supported challenge type.");
  const allowed = new Set([
    "minShots",
    "clubTypes",
    "metric",
    "targetYards",
    "targetYardage",
    "targetLadderYards",
    "targetRangeYards",
  ]);
  for (const [key, value] of Object.entries(input.rulesJson)) {
    if (!allowed.has(key)) invalid(`Unsupported rule: ${key}.`);
    if (
      key === "minShots" &&
      (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1 || value > 100000)
    )
      invalid("Minimum shots must be a whole number between 1 and 100,000.");
    if (
      (key === "targetYards" || key === "targetYardage") &&
      (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || value > 1000)
    )
      invalid("Target distance must be greater than zero and at most 1,000 yards.");
    if (
      key === "clubTypes" &&
      (!Array.isArray(value) ||
        value.length > 30 ||
        value.some((item) => typeof item !== "string" || !item.trim() || item.length > 40))
    )
      invalid("Club types must be a list of valid club names.");
    if (key === "metric" && value !== "carry_stddev" && value !== "carry_spread")
      invalid("Choose carry_stddev or carry_spread as the metric.");
    if (key === "targetLadderYards" || key === "targetRangeYards") {
      if (
        !Array.isArray(value) ||
        !value.length ||
        value.length > 100 ||
        value.some(
          (item) => typeof item !== "number" || !Number.isFinite(item) || item <= 0 || item > 1000,
        )
      )
        invalid("Target distances must be a nonempty list of distances up to 1,000 yards.");
      if (
        key === "targetRangeYards" &&
        Array.isArray(value) &&
        (value.length !== 2 || value[0] >= value[1])
      )
        invalid("Target range must contain a lower and higher distance.");
    }
  }
  const reserved: Record<string, string> = {
    "longest-drive": "longest_drive",
    "straightest-drive": "straightest_drive",
    "demo-straightest-drive": "straightest_drive",
    "wedge-window": "wedge_window",
    "wedge-ladder": "wedge_ladder",
    "demo-wedge-ladder": "wedge_ladder",
    "7i-consistency": "consistency",
    "demo-7i-consistency": "consistency",
    "closest-to-pin": "closest_to_pin",
    "monthly-practice-streak": "practice_streak",
  };
  if (reserved[input.slug] && reserved[input.slug] !== input.challengeType)
    invalid("This reserved slug requires its original challenge type.");
}
export async function saveAdminChallengeTemplate(input: AdminChallengeTemplateInput) {
  const actor = await requireAdminUser();
  validate(input);
  return getDb().transaction(async (tx) => {
    const [previous] = input.id
      ? await tx
          .select()
          .from(challengeTemplates)
          .where(eq(challengeTemplates.id, input.id))
          .limit(1)
          .for("update")
      : [];
    if (input.id && !previous) invalid("Template not found.");
    if (previous && previous.updatedAt.toISOString() !== input.expectedUpdatedAt)
      invalid("This template has changed. Reload it before saving.");
    if (previous && previous.slug !== input.slug)
      invalid("An existing template slug cannot change. Create a new template instead.");
    const scoringChanged =
      !previous ||
      previous.challengeType !== input.challengeType ||
      previous.scoringDirection !== input.scoringDirection ||
      !isDeepStrictEqual(previous.rulesJson, input.rulesJson);
    if (previous && scoringChanged) {
      const [reference] = await tx
        .select({ id: challenges.id })
        .from(challenges)
        .where(eq(challenges.templateId, previous.id))
        .limit(1);
      if (reference)
        invalid(
          "This template is used by a challenge. Create a new template to change scoring rules.",
        );
    }
    if (scoringChanged) validateScoring(input);
    const [duplicate] = await tx
      .select({ id: challengeTemplates.id })
      .from(challengeTemplates)
      .where(eq(challengeTemplates.slug, input.slug))
      .limit(1);
    if (duplicate && duplicate.id !== previous?.id)
      invalid("That template slug is already in use.");
    const values = {
      slug: input.slug,
      name: input.name.trim(),
      description: input.description.trim(),
      challengeType: input.challengeType,
      scoringDirection: input.scoringDirection,
      rulesJson: input.rulesJson,
      active: input.active,
      updatedAt: new Date(Math.max(Date.now(), (previous?.updatedAt.getTime() ?? 0) + 1)),
    };
    const [saved] = previous
      ? await tx
          .update(challengeTemplates)
          .set(values)
          .where(eq(challengeTemplates.id, previous.id))
          .returning()
      : await tx.insert(challengeTemplates).values(values).returning();
    await tx.insert(adminAuditLog).values({
      actorUserId: actor.userId,
      action: previous ? "challenge_template_updated" : "challenge_template_created",
      targetType: "challenge_template",
      targetId: saved.id,
      metadataJson: { scoringChanged, active: saved.active },
    });
    return saved;
  });
}
