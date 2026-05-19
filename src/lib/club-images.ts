import { formatClubType } from "@/lib/club-format";

type ClubArtworkView = "side" | "top";
type ClubArtworkSource = "panel" | "generated-v2";

type ClubImageInput = {
  type: string | null | undefined;
  brand?: string | null | undefined;
  model?: string | null | undefined;
};

const knownClubArt = new Set(["driver", "5w", "5i", "6i", "7i", "8i", "9i", "pw", "sw"]);

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

  return `/api/club-images?${params.toString()}`;
}

export function buildClubProductImageSearchQuery({ type, brand, model }: ClubImageInput) {
  const parts = [normalizePart(brand), normalizePart(model), formatSearchClubType(type)].filter(
    (part): part is string => Boolean(part),
  );

  if (parts.length < 2) {
    return null;
  }

  return `${parts.join(" ")} golf club product image`;
}

export function buildBrandLogoSearchQuery(brand: string | null | undefined) {
  const normalized = normalizePart(brand);

  return normalized ? `${normalized} golf logo` : null;
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

function formatSearchClubType(value: string | null | undefined) {
  const normalized = normalizePart(value);

  if (!normalized) {
    return null;
  }

  return formatClubType(normalized).toLowerCase();
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
