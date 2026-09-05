import { describe, expect, it } from "vitest";
import {
  matchesMobileSpeedSaveReceipt,
  readMobileSpeedSaveReceipt,
  resolveMobileSpeedSaveReceipt,
} from "./mobile-speed-save-receipt";

const receipt = { draftId: "8a74e8a5-3c68-4cc1-8aa9-82df31521e7f", revision: 4 };
describe("mobile speed save acknowledgement", () => {
  it("resolves only a saved receipt from the supplied owned sessions", () => {
    const sessions = [{ id: "saved-session", mobileSaveReceipt: receipt }];
    expect(resolveMobileSpeedSaveReceipt(sessions, "saved-session")).toEqual(receipt);
    expect(resolveMobileSpeedSaveReceipt(sessions, "another-account-session")).toBeNull();
    expect(resolveMobileSpeedSaveReceipt(sessions, null)).toBeNull();
    expect(resolveMobileSpeedSaveReceipt([{ id: "legacy-session" }], "legacy-session")).toBeNull();
  });
  it("does not discard a newer revision, another draft or a legacy unsaved draft", () => {
    expect(matchesMobileSpeedSaveReceipt(receipt, receipt)).toBe(true);
    expect(matchesMobileSpeedSaveReceipt({ ...receipt, revision: 5 }, receipt)).toBe(false);
    expect(
      matchesMobileSpeedSaveReceipt(
        { ...receipt, draftId: "88612973-63bb-48a2-a9cb-7eeec94d9aab" },
        receipt,
      ),
    ).toBe(false);
    expect(matchesMobileSpeedSaveReceipt({ readings: [101] }, receipt)).toBe(false);
    expect(matchesMobileSpeedSaveReceipt(receipt, null)).toBe(false);
  });
  it.each([
    null,
    {},
    { ...receipt, revision: -1 },
    { ...receipt, revision: 1.5 },
    { ...receipt, revision: "4" },
    { ...receipt, draftId: "query-string" },
  ])("rejects malformed persisted metadata %j", (value) => {
    expect(readMobileSpeedSaveReceipt(value)).toBeNull();
  });
});
