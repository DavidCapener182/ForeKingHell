import type { GoogleImageCandidate } from "@/lib/google-image-search";

type CourseLogoInput = {
  name: string | null | undefined;
  country?: string | null | undefined;
};

export type CourseLogoSearchCandidate = Pick<
  GoogleImageCandidate,
  "url" | "title" | "displayLink" | "contextLink" | "mime" | "source"
>;

const logoTerms = ["logo", "crest", "badge", "emblem", "mark", "icon"];
const poorResultTerms = [
  "scorecard",
  "course map",
  "yardage",
  "flyover",
  "green fee",
  "tee time",
  "tripadvisor",
  "golfpass",
  "leadingcourses",
  "top100golf",
  "where2golf",
];
const lowSignalCourseTerms = new Set([
  "and",
  "club",
  "course",
  "golf",
  "golfclub",
  "golfcourse",
  "centre",
  "center",
  "links",
  "the",
]);
const COURSE_MEDIA_VERSION = "3";

export function courseLogoRoutePath(input: CourseLogoInput) {
  const name = normalizePart(input.name);

  if (!name) {
    return null;
  }

  const params = new URLSearchParams();
  params.set("name", name);
  addSearchParam(params, "country", input.country);
  params.set("v", COURSE_MEDIA_VERSION);

  return `/api/course-logos?${params.toString()}`;
}

export function buildCourseLogoSearchQueries(input: CourseLogoInput) {
  const name = normalizePart(input.name);

  if (!name) {
    return [];
  }

  const country = normalizePart(input.country);
  const exactName = quoteSearchPhrase(name);
  const exactNameWithCountry = country ? `${exactName} ${country}` : exactName;

  return uniqueStrings([
    `${exactNameWithCountry} golf course logo`,
    `${exactNameWithCountry} logo`,
    `${exactName} golf club crest`,
  ]);
}

export function rankCourseLogoSearchCandidates(
  candidates: CourseLogoSearchCandidate[],
  input: CourseLogoInput,
) {
  return candidates
    .map((candidate, index) => ({
      candidate,
      index,
      score: scoreCourseLogoSearchCandidate(candidate, input),
    }))
    .filter((entry) => entry.score >= 6)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.candidate);
}

export function scoreCourseLogoSearchCandidate(
  candidate: CourseLogoSearchCandidate,
  input: CourseLogoInput,
) {
  const name = normalizeForMatching(input.name);

  if (!name) {
    return 0;
  }

  const title = normalizeForMatching(candidate.title);
  const displayLink = normalizeForMatching(candidate.displayLink);
  const contextLink = normalizeForMatching(candidate.contextLink);
  const url = normalizeForMatching(candidate.url);
  const haystack = [title, displayLink, contextLink, url].filter(Boolean).join(" ");
  const compactHaystack = compactKey(haystack);
  const compactName = compactKey(name);
  const tokens = significantCourseTokens(name);
  let score = 0;

  if (haystack.includes(name)) {
    score += 12;
  }

  if (compactName && compactHaystack.includes(compactName)) {
    score += 10;
  }

  const matchedTokens = tokens.filter((token) => haystack.includes(token) || compactHaystack.includes(token));
  score += matchedTokens.length * 2;

  if (tokens.length > 0 && tokens.every((token) => compactKey(displayLink).includes(token))) {
    score += 8;
  }

  if (logoTerms.some((term) => haystack.includes(term))) {
    score += 10;
  }

  if (logoTerms.some((term) => url.includes(term))) {
    score += 4;
  }

  if (candidate.mime === "image/png" || candidate.mime === "image/svg+xml" || candidate.mime === "image/webp") {
    score += 2;
  }

  if (candidate.source === "thumbnail") {
    score -= 1;
  }

  if (poorResultTerms.some((term) => haystack.includes(term))) {
    score -= 8;
  }

  return score;
}

function significantCourseTokens(name: string) {
  const tokens = name
    .split(" ")
    .filter((token) => token.length > 2 && !lowSignalCourseTerms.has(token));

  return tokens.length > 0 ? tokens : name.split(" ").filter((token) => token.length > 2);
}

function addSearchParam(params: URLSearchParams, key: string, value: string | null | undefined) {
  const normalized = normalizePart(value);

  if (normalized) {
    params.set(key, normalized);
  }
}

function normalizePart(value: string | null | undefined) {
  const normalized = value?.trim().replace(/\s+/g, " ");

  return normalized || null;
}

function quoteSearchPhrase(value: string) {
  return `"${value.replace(/"/g, "")}"`;
}

function normalizeForMatching(value: string | null | undefined) {
  return (
    value
      ?.normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, " ")
      .trim() ?? ""
  );
}

function compactKey(value: string) {
  return value.replace(/[^a-z0-9]+/g, "");
}

function uniqueStrings(values: string[]) {
  return [...new Set(values)];
}
