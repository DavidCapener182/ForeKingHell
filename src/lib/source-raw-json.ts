/** Historical imports sometimes stored an encoded object inside the JSON column.
 * Decode one layer without inventing fields or accepting arrays/nested values.
 */
export function normaliseSourceRawJson(value: unknown): Record<string, string> {
  let decoded = value;
  if (typeof decoded === "string") {
    try {
      decoded = JSON.parse(decoded);
    } catch {
      return {};
    }
  }
  if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) return {};
  return Object.fromEntries(
    Object.entries(decoded).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}
