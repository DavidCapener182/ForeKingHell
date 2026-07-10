const REDIRECT_BASE = "https://forekinghell.invalid";
const CONTROL_CHARACTER = /[\u0000-\u001f\u007f]/;

/**
 * Accept only a path that the browser will resolve on the current origin.
 * Backslashes are rejected because URL parsers can treat them as authority separators.
 */
export function safeNextPath(value: string) {
  if (
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    CONTROL_CHARACTER.test(value)
  ) {
    return null;
  }

  try {
    const base = new URL(REDIRECT_BASE);
    const resolved = new URL(value, base);
    return resolved.origin === base.origin ? value : null;
  } catch {
    return null;
  }
}
