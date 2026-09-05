export type MobileSpeedSaveReceipt = { draftId: string; revision: number };

export function readMobileSpeedSaveReceipt(value: unknown): MobileSpeedSaveReceipt | null {
  if (!value || typeof value !== "object") return null;
  const receipt = value as MobileSpeedSaveReceipt;
  if (
    typeof receipt.draftId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      receipt.draftId,
    ) ||
    !Number.isSafeInteger(receipt.revision) ||
    receipt.revision < 0
  )
    return null;
  return { draftId: receipt.draftId, revision: receipt.revision };
}

/** Call only with the current user's owned session projection, never query-string metadata. */
export function resolveMobileSpeedSaveReceipt(
  sessions: { id: string; mobileSaveReceipt?: MobileSpeedSaveReceipt | null }[],
  sessionId: string | null | undefined,
) {
  return readMobileSpeedSaveReceipt(
    sessions.find((session) => session.id === sessionId)?.mobileSaveReceipt,
  );
}

/** Readings or notes added while a save is pending must survive its older acknowledgement. */
export function matchesMobileSpeedSaveReceipt(
  draft: unknown,
  receipt: MobileSpeedSaveReceipt | null | undefined,
) {
  const current = readMobileSpeedSaveReceipt(draft);
  return !!(
    current &&
    receipt &&
    current.draftId === receipt.draftId &&
    current.revision === receipt.revision
  );
}
