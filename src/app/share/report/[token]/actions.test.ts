import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ load: vi.fn(), set: vi.fn() }));
vi.mock("@/db/client", () => ({ getDb: () => ({ select: () => ({ from: () => ({ innerJoin: () => ({ where: () => ({ limit: mocks.load }) }) }) }) }) }));
vi.mock("next/headers", () => ({ cookies: async () => ({ set: mocks.set }) }));
import { hashReportPassword, reportAccessCookieName, reportAccessGrant } from "@/lib/coach-report-access";
import { hashShareToken } from "@/lib/share-links";
import { unlockCoachReportAction, unlockCoachReportStateAction } from "./actions";
const token = "synthetic-report-token-for-testing";
const passwordHash = hashReportPassword("test-password")!;
function form(password = "test-password") { const data = new FormData(); data.set("password", password); return data; }
beforeEach(() => { vi.resetAllMocks(); mocks.load.mockResolvedValue([{ exportId: "synthetic-export", config: { passwordHash } }]); });
it("returns an inline password error without granting access", async () => {
  expect(await unlockCoachReportStateAction(token, {}, form("wrong"))).toEqual({ error: "That password did not unlock this report. Try again." });
  expect(mocks.set).not.toHaveBeenCalled();
});
it("retains the legacy incorrect-password redirect", async () => {
  await expect(unlockCoachReportAction(token, form("wrong"))).rejects.toMatchObject({ digest: expect.stringContaining("?error=password&attempt=") });
  expect(mocks.set).not.toHaveBeenCalled();
});
it("grants the existing scoped cookie and preserves the successful redirect", async () => {
  await expect(unlockCoachReportStateAction(token, { error: "old" }, form())).rejects.toMatchObject({ digest: expect.stringContaining(`/share/report/${token};`) });
  expect(mocks.set).toHaveBeenCalledWith(reportAccessCookieName("synthetic-export"), reportAccessGrant(hashShareToken(token), passwordHash), { httpOnly: true, sameSite: "strict", secure: false, path: `/share/report/${token}`, maxAge: 43200 });
});
it("keeps an unavailable token unavailable without granting access", async () => {
  mocks.load.mockResolvedValue([]);
  await expect(unlockCoachReportStateAction(token, {}, form())).rejects.toMatchObject({ digest: expect.stringContaining("/privacy;") });
  expect(mocks.set).not.toHaveBeenCalled();
});
it("rejects malformed tokens before reading data", async () => {
  await expect(unlockCoachReportStateAction("short", {}, form())).rejects.toMatchObject({ digest: expect.stringContaining("/privacy;") });
  expect(mocks.load).not.toHaveBeenCalled(); expect(mocks.set).not.toHaveBeenCalled();
});
it("redacts service errors while allowing retry", async () => {
  mocks.load.mockRejectedValue(new Error("private database details"));
  expect(await unlockCoachReportStateAction(token, {}, form())).toEqual({ error: "This report could not be unlocked. Try again later." });
  expect(mocks.set).not.toHaveBeenCalled();
});
