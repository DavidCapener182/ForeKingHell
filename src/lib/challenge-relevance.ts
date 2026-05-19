type ChallengeLike = {
  status?: string | null;
  templateSlug?: string | null;
  templateName?: string | null;
  title: string;
  description?: string | null;
};

export function findRelevantChallenge<TChallenge extends ChallengeLike>(
  challenges: TChallenge[],
  clubType: string | null | undefined,
) {
  return (
    challenges.find(
      (challenge) =>
        (challenge.status ?? "open") === "open" && challengeMatchesClub(challenge, clubType),
    ) ?? null
  );
}

export function challengeMatchesClub(
  challenge: ChallengeLike,
  clubType: string | null | undefined,
) {
  const normalizedClub = clubType?.toLowerCase() ?? "";
  const text = [
    challenge.templateSlug,
    challenge.templateName,
    challenge.title,
    challenge.description,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (!normalizedClub) {
    return false;
  }

  if (normalizedClub === "driver") {
    return /\b(driver|drive|longest)\b/.test(text);
  }

  if (isWedgeClub(normalizedClub)) {
    return /\b(wedge|ladder|window)\b/.test(text);
  }

  if (/^\d+i$/.test(normalizedClub)) {
    if (text.includes(normalizedClub)) {
      return true;
    }

    if (/\b\d+i\b/.test(text)) {
      return false;
    }

    return /\b(iron|consistency)\b/.test(text);
  }

  return text.includes(normalizedClub);
}

function isWedgeClub(clubType: string) {
  return (
    clubType === "pw" ||
    clubType === "gw" ||
    clubType === "aw" ||
    clubType === "sw" ||
    clubType === "lw" ||
    clubType === "wedge" ||
    clubType.endsWith("-wedge")
  );
}
