type LongestShotLinkTarget = {
  clubId: string;
  clubType: string;
  sessionId?: string | null;
  fileName?: string | null;
};

export function clubHref(notification: LongestShotLinkTarget) {
  return `/bag/${notification.clubId}`;
}

export function shotRowsHref(notification: LongestShotLinkTarget) {
  const params = new URLSearchParams();
  params.set("club", notification.clubType);

  if (notification.sessionId) {
    params.set("sessionId", notification.sessionId);
  } else if (notification.fileName) {
    params.set("q", notification.fileName);
  }

  return `/shots?${params.toString()}`;
}

export function achievementUnlockHref(achievementId: string) {
  const params = new URLSearchParams({ achievement: achievementId });
  return `/achievements?${params.toString()}#${achievementDomId(achievementId)}`;
}

export function achievementDomId(achievementId: string) {
  return `achievement-${achievementId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}
