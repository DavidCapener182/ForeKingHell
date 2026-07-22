import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export type CoachReportAccessConfig = {
  template: "coach" | "club_fitting" | "monthly" | "tournament" | "personal_best";
  passwordHash: string | null;
  disableDownload: boolean;
  hideExactShotData: boolean;
  hideSocialInformation: boolean;
  accessHistory: string[];
};

export const coachReportTemplates: Array<{
  value: CoachReportAccessConfig["template"];
  label: string;
}> = [
  { value: "coach", label: "Coach report" },
  { value: "club_fitting", label: "Club fitting report" },
  { value: "monthly", label: "Monthly progress report" },
  { value: "tournament", label: "Tournament preparation" },
  { value: "personal_best", label: "Personal best card" },
];

export function hashReportPassword(password: string) {
  const clean = password.trim();
  if (!clean) return null;
  if (clean.length < 8 || clean.length > 128)
    throw new Error("Report password must be 8 to 128 characters.");
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(clean, salt, 32).toString("hex")}`;
}

export function verifyReportPassword(password: string, stored: string) {
  const [salt, expectedHex] = stored.split(":");
  if (!salt || !expectedHex || !/^[a-f0-9]{64}$/i.test(expectedHex)) return false;
  const expected = Buffer.from(expectedHex, "hex");
  const actual = scryptSync(password, salt, expected.length);
  return timingSafeEqual(actual, expected);
}

export function reportAccessCookieName(exportId: string) {
  return `fkh_report_${exportId.replace(/[^a-z0-9]/gi, "").slice(0, 32)}`;
}

export function reportAccessGrant(tokenHash: string, passwordHash: string) {
  return createHash("sha256").update(`${tokenHash}:${passwordHash}`).digest("hex");
}

export function parseCoachReportAccessConfig(value: unknown): CoachReportAccessConfig {
  const record =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const template = coachReportTemplates.some((item) => item.value === record.template)
    ? (record.template as CoachReportAccessConfig["template"])
    : "coach";
  return {
    template,
    passwordHash:
      typeof record.passwordHash === "string" && record.passwordHash.includes(":")
        ? record.passwordHash
        : null,
    disableDownload: record.disableDownload === true,
    hideExactShotData: record.hideExactShotData !== false,
    hideSocialInformation: record.hideSocialInformation !== false,
    accessHistory: Array.isArray(record.accessHistory)
      ? record.accessHistory
          .filter(
            (item): item is string => typeof item === "string" && !Number.isNaN(Date.parse(item)),
          )
          .slice(-50)
      : [],
  };
}
