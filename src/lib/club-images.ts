import type { GoogleImageCandidate } from "@/lib/google-image-search";

type ClubArtworkView = "side" | "top";
type ClubArtworkSource = "panel" | "generated-v2";

type ClubImageInput = {
  type: string | null | undefined;
  brand?: string | null | undefined;
  model?: string | null | undefined;
};

export type BrandLogoSearchCandidate = Pick<
  GoogleImageCandidate,
  "url" | "title" | "displayLink" | "contextLink" | "mime" | "source"
>;

const knownClubArt = new Set(["driver", "5w", "5i", "6i", "7i", "8i", "9i", "pw", "sw"]);
const CLUB_IMAGE_ROUTE_VERSION = "9";

const clubArtAliases: Record<string, string> = {
  "3w": "5w",
  "7w": "5w",
  "3h": "5i",
  "4h": "5i",
  "5h": "5i",
  "4i": "5i",
  gw: "pw",
  aw: "pw",
  lw: "sw",
};

const brandLogoDomains: Record<string, string> = {
  adams: "adamsgolf.com",
  bettinardi: "bettinardi.com",
  bridgestone: "bridgestonegolf.com",
  callaway: "callawaygolf.com",
  cleveland: "clevelandgolf.com",
  cobra: "cobragolf.com",
  honma: "honmagolf.com",
  macgreggor: "macgregorgolf.com",
  macgregor: "macgregorgolf.com",
  mizuno: "mizunogolf.com",
  miura: "miuragolf.com",
  nike: "nike.com",
  odyssey: "odysseyeu.com",
  ping: "ping.com",
  pxg: "pxg.com",
  srixon: "srixon.com",
  "scotty cameron": "scottycameron.com",
  taylormade: "taylormadegolf.com",
  titleist: "titleist.com",
  "tour edge": "touredge.com",
  wilson: "wilson.com",
  xxio: "xxiogolf.com",
  yonex: "yonex.com",
};

const brandPreferredLogoUrls: Record<string, string[]> = {
  titleist: ["https://upload.wikimedia.org/wikipedia/commons/7/70/Titleist_logo.svg"],
};

const brandLogoAliases: Record<string, string> = {
  macgreggor: "macgregor",
  macgreoor: "macgregor",
  "mac gregor": "macgregor",
  scottycameron: "scotty cameron",
  taylormade: "taylormade",
  "taylor made": "taylormade",
  titlest: "titleist",
  titlist: "titleist",
};

const brandLogoTerms = ["logo", "wordmark", "brand", "mark"];
const poorBrandLogoTerms = [
  "ball",
  "balls",
  "driver",
  "fairway",
  "hybrid",
  "iron",
  "irons",
  "wedge",
  "wedges",
  "putter",
  "putters",
  "bag",
  "bags",
  "cap",
  "cart",
  "glove",
  "pro v1",
  "product",
];
export function clubArtworkPath(
  clubType: string | null | undefined,
  view: ClubArtworkView = "side",
  source: ClubArtworkSource = "panel",
) {
  const normalized = (clubType ?? "").trim().toLowerCase();
  const artType = knownClubArt.has(normalized) ? normalized : (clubArtAliases[normalized] ?? "7i");

  return `/assets/clubs/${source}/${artType}-${view}.png`;
}

export function clubImageRoutePath({
  type,
  brand,
  model,
  fallback,
}: ClubImageInput & {
  fallback: string;
}) {
  const hasProductSignal = Boolean(normalizePart(brand) || normalizePart(model));

  if (!hasProductSignal) {
    return null;
  }

  const params = new URLSearchParams();
  addSearchParam(params, "type", type);
  addSearchParam(params, "brand", brand);
  addSearchParam(params, "model", model);
  params.set("fallback", fallback);
  params.set("v", CLUB_IMAGE_ROUTE_VERSION);

  return `/api/club-images?${params.toString()}`;
}

export function buildBrandLogoSearchQuery(brand: string | null | undefined) {
  const normalized = normalizePart(brand);

  return normalized ? `${normalized} golf logo` : null;
}

export function brandPreferredLogoImageUrls(brand: string | null | undefined) {
  return [
    ...new Set(
      brandLookupKeys(brand).flatMap((lookupKey) => brandPreferredLogoUrls[lookupKey] ?? []),
    ),
  ];
}

export function brandLogoIconUrl(brand: string | null | undefined) {
  return brandLogoIconUrls(brand)[0] ?? null;
}

export function brandLogoIconUrls(brand: string | null | undefined) {
  return brandDomainCandidates(brand).map((domain) => {
    const url = new URL("https://www.google.com/s2/favicons");
    url.searchParams.set("domain", domain);
    url.searchParams.set("sz", "256");

    return url.toString();
  });
}

function brandDomainCandidates(brand: string | null | undefined) {
  const normalized = normalizeBrandKey(brand);

  if (!normalized) {
    return [];
  }

  const domains: string[] = [];
  const compact = compactBrandKey(normalized);
  const lookupKeys = [
    normalized,
    compact,
    brandLogoAliases[normalized],
    brandLogoAliases[compact],
  ].filter((key): key is string => Boolean(key));

  for (const lookupKey of [...new Set(lookupKeys)]) {
    if (brandLogoDomains[lookupKey]) {
      domains.push(brandLogoDomains[lookupKey]);
    }
  }

  const fuzzyKey = Object.keys(brandLogoDomains).find(
    (key) =>
      normalized.includes(key) ||
      key.includes(normalized) ||
      compact.includes(compactBrandKey(key)) ||
      compactBrandKey(key).includes(compact),
  );

  if (fuzzyKey) {
    domains.push(brandLogoDomains[fuzzyKey]);
  }

  const hyphenated = normalized.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  if (compact) {
    domains.push(`${compact}golf.com`, `${compact}.com`);
  }

  if (hyphenated && hyphenated !== compact) {
    domains.push(`${hyphenated}golf.com`, `${hyphenated}.com`);
  }

  return [...new Set(domains)];
}

export function rankBrandLogoSearchCandidates(
  candidates: BrandLogoSearchCandidate[],
  brand: string | null | undefined,
) {
  return candidates
    .map((candidate, index) => ({
      candidate,
      index,
      score: scoreBrandLogoSearchCandidate(candidate, brand),
    }))
    .filter((entry) => entry.score >= 12)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.candidate);
}

export function scoreBrandLogoSearchCandidate(
  candidate: BrandLogoSearchCandidate,
  brand: string | null | undefined,
) {
  const normalized = normalizeBrandKey(brand);

  if (!normalized) {
    return 0;
  }

  const compactBrand = compactBrandKey(normalized);
  const canonicalBrand = canonicalBrandKey(brand) ?? normalized;
  const compactCanonicalBrand = compactBrandKey(canonicalBrand);
  const title = normalizeForMatching(candidate.title);
  const displayLink = normalizeForMatching(candidate.displayLink);
  const contextLink = normalizeForMatching(candidate.contextLink);
  const url = normalizeForMatching(candidate.url);
  const haystack = [title, displayLink, contextLink, url].filter(Boolean).join(" ");
  const compactHaystack = compactBrandKey(haystack);
  let score = 0;

  if (haystack.includes(normalized) || haystack.includes(canonicalBrand)) {
    score += 14;
  }

  if (
    (compactBrand && compactHaystack.includes(compactBrand)) ||
    (compactCanonicalBrand && compactHaystack.includes(compactCanonicalBrand))
  ) {
    score += 10;
  }

  if (brandLogoTerms.some((term) => haystack.includes(term))) {
    score += 10;
  }

  if (brandLogoTerms.some((term) => url.includes(term))) {
    score += 4;
  }

  const compactDisplayLink = compactBrandKey(displayLink);

  if (
    brandDomainCandidates(brand).some((domain) =>
      compactDisplayLink.includes(compactBrandKey(domain)),
    )
  ) {
    score += 6;
  }

  if (
    candidate.mime === "image/png" ||
    candidate.mime === "image/svg+xml" ||
    candidate.mime === "image/webp"
  ) {
    score += 2;
  }

  if (candidate.source === "thumbnail") {
    score -= 1;
  }

  if (poorBrandLogoTerms.some((term) => haystack.includes(term))) {
    score -= 20;
  }

  return score;
}

function addSearchParam(params: URLSearchParams, key: string, value: string | null | undefined) {
  const normalized = normalizePart(value);

  if (normalized) {
    params.set(key, normalized);
  }
}

function brandLookupKeys(brand: string | null | undefined) {
  const normalized = normalizeBrandKey(brand);

  if (!normalized) {
    return [];
  }

  const compact = compactBrandKey(normalized);

  return [normalized, compact, brandLogoAliases[normalized], brandLogoAliases[compact]].filter(
    (key): key is string => Boolean(key),
  );
}

function canonicalBrandKey(brand: string | null | undefined) {
  const normalized = normalizeBrandKey(brand);

  if (!normalized) {
    return null;
  }

  const compact = compactBrandKey(normalized);

  return brandLogoAliases[normalized] ?? brandLogoAliases[compact] ?? normalized;
}

function normalizePart(value: string | null | undefined) {
  const normalized = value?.trim().replace(/\s+/g, " ");

  return normalized || null;
}

function normalizeBrandKey(value: string | null | undefined) {
  return (
    normalizePart(value)
      ?.toLowerCase()
      .replace(/golf\b/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim() ?? null
  );
}

function compactBrandKey(value: string) {
  return value.replace(/[^a-z0-9]+/g, "");
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
