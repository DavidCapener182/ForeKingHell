const dismissalKey = "fkh:install-notice-dismissed-until";
const dismissalDuration = 7 * 24 * 60 * 60 * 1000;

export function installNoticeDismissed(storage: Pick<Storage, "getItem">, now = Date.now()) {
  try {
    const until = Number(storage.getItem(dismissalKey));
    return Number.isFinite(until) && until > now;
  } catch { return false; }
}

export function dismissInstallNotice(storage: Pick<Storage, "setItem">, now = Date.now()) {
  try { storage.setItem(dismissalKey, String(now + dismissalDuration)); } catch { /* Optional storage. */ }
}

export function isActiveEntryRoute(pathname: string) {
  return /^\/(?:import(?:\/|$)|rounds\/new(?:\/|$)|play\/[^/]+|practice\/quick-range(?:\/|$))/.test(pathname);
}

export function canApplyAppUpdate({ pathname, queued, hasDraft }: {
  pathname: string; queued: number | null; hasDraft: boolean;
}) {
  return queued === 0 && !hasDraft && !isActiveEntryRoute(pathname);
}
