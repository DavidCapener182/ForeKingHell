export function isShotPatternFeatureEnabled() {
  return process.env.NEXT_PUBLIC_ENABLE_SHOT_PATTERN !== "false";
}
