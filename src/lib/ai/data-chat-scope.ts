export type DataChatScope =
  | "bag"
  | "shots"
  | "rounds"
  | "strokes-gained"
  | "speed"
  | "equipment"
  | "practice"
  | "social"
  | "records";

const scopeKeywords: Record<DataChatScope, string[]> = {
  bag: ["bag", "club", "carry", "yardage", "gapping", "gap", "stock distance"],
  shots: [
    "shot",
    "dispersion",
    "offline",
    "launch",
    "spin",
    "smash",
    "strike",
    "pattern",
    "direction",
    "draw",
    "fade",
    "hook",
    "slice",
    "consistency",
    "ball speed",
  ],
  rounds: ["round", "score", "handicap", "fairway", "gir", "putt", "course", "hole"],
  "strokes-gained": ["strokes gained", "approach", "around the green"],
  speed: ["speed", "mph", "faster", "fastest"],
  equipment: ["equipment", "shaft", "loft", "lie angle", "ball model", "gear change"],
  practice: ["practice", "drill", "coach", "training", "plan", "work on"],
  social: ["achievement", "challenge", "feed", "social", "xp", "badge", "weekly recap"],
  records: ["record", "personal best", " pb", "pb "],
};

export function selectDataChatScopes(question: string) {
  const normalized = ` ${question.toLowerCase().replace(/\s+/g, " ").trim()} `;
  const scopes = new Set<DataChatScope>();

  for (const [scope, keywords] of Object.entries(scopeKeywords) as Array<
    [DataChatScope, string[]]
  >) {
    if (keywords.some((keyword) => normalized.includes(keyword))) scopes.add(scope);
  }

  if (/\b(improv|better|worse|declin|trend|change|progress)/.test(normalized)) {
    scopes.add("shots");
    scopes.add("bag");
    scopes.add("practice");
  }

  if (scopes.size === 0) {
    scopes.add("shots");
    scopes.add("bag");
    scopes.add("practice");
  }

  return scopes;
}
