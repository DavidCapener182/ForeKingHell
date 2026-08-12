const UNTRACKED_CLUB_TYPES = new Set(["ot", "other", "unknown", "putter"]);
const SHORT_GAME_TOUCH_CLUB_TYPES = new Set(["sw", "lw", "wedge"]);

function normalizedClubType(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

export function isTrackedClubType(value: string | null | undefined) {
  const normalized = normalizedClubType(value);
  return normalized.length > 0 && !UNTRACKED_CLUB_TYPES.has(normalized);
}

export function isShortGameTouchClubType(value: string | null | undefined) {
  return SHORT_GAME_TOUCH_CLUB_TYPES.has(normalizedClubType(value));
}

export function formatClubType(value: string) {
  if (value === "driver") {
    return "Driver";
  }

  if (normalizedClubType(value) === "other" || normalizedClubType(value) === "ot") {
    return "Other";
  }

  if (/^[1-9]w$/.test(value)) {
    return value.toUpperCase();
  }

  if (/^[1-9]h$/.test(value)) {
    return value.toUpperCase();
  }

  if (/^[1-9]i$/.test(value)) {
    return `${value[0]}i`;
  }

  if (["pw", "gw", "aw", "sw", "lw"].includes(value)) {
    return value.toUpperCase();
  }

  return value
    .split("-")
    .filter(Boolean)
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(" ");
}

export function formatCompanionClubType(value: string) {
  const normalized = normalizedClubType(value);
  const numbered = normalized.match(/^([1-9])([iwh])$/);
  if (numbered) {
    const kind = numbered[2] === "i" ? "Iron" : numbered[2] === "w" ? "Wood" : "Hybrid";
    return `${numbered[1]} ${kind}`;
  }

  const wedges: Record<string, string> = {
    pw: "Pitching Wedge",
    gw: "Gap Wedge",
    aw: "Approach Wedge",
    sw: "Sand Wedge",
    lw: "Lob Wedge",
  };
  return wedges[normalized] ?? formatClubType(normalized || value);
}

export function formatClubModelName(club: {
  type: string;
  brand?: string | null;
  model?: string | null;
}) {
  return (
    [club.brand, club.model]
      .map((part) => part?.trim())
      .filter(Boolean)
      .join(" ") || formatClubType(club.type)
  );
}

export function clubSortValue(value: string) {
  if (value === "driver") {
    return 10;
  }

  const wood = value.match(/^([1-9])w$/);
  if (wood) {
    return 20 + Number(wood[1]);
  }

  const hybrid = value.match(/^([1-9])h$/);
  if (hybrid) {
    return 35 + Number(hybrid[1]);
  }

  const iron = value.match(/^([1-9])i$/);
  if (iron) {
    return 50 + Number(iron[1]);
  }

  const wedgeOrder: Record<string, number> = {
    pw: 90,
    gw: 91,
    aw: 92,
    sw: 93,
    lw: 94,
  };

  return wedgeOrder[value] ?? 120;
}

export function clubAccent(value: string) {
  if (value === "driver") {
    return "#0369A1";
  }

  if (value.endsWith("w") || value.endsWith("h")) {
    return "#BE185D";
  }

  if (value.endsWith("i")) {
    return "#15803D";
  }

  return "#C2410C";
}
