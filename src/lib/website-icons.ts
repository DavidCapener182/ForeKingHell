import "server-only";

import { BRAND_NAME, BRAND_PUBLIC_URL } from "@/lib/brand";
import { fetchWithTimeout, safeRemoteResourceUrl } from "@/lib/remote-image-response";

const WEBSITE_ICON_TIMEOUT_MS = 3500;
const WEBSITE_ICON_MAX_HTML_BYTES = 1024 * 1024;
const WEBSITE_ICON_USER_AGENT = `Mozilla/5.0 (compatible; ${BRAND_NAME} website icon resolver; +${BRAND_PUBLIC_URL})`;

type WebsiteIconOptions = {
  includeGoogleFavicon?: boolean;
  includeLegacyFavicon?: boolean;
};

type WebsiteImageOptions = {
  keywords?: Array<string | null | undefined>;
};

export async function findWebsiteIconUrls(website: string, options: WebsiteIconOptions = {}) {
  const pageUrl = safeRemoteResourceUrl(website, undefined, { allowHttp: true });

  if (!pageUrl) {
    return [];
  }

  pageUrl.protocol = "https:";

  const html = await fetchWebsiteHtml(pageUrl);
  const iconUrls = html ? iconUrlsFromHtml(html, pageUrl) : [];
  const fallbackUrls = options.includeGoogleFavicon ? [googleFaviconUrl(pageUrl)] : [];

  return uniqueStrings([...iconUrls, ...defaultIconUrls(pageUrl, options), ...fallbackUrls]);
}

export async function findWebsiteImageUrls(website: string, options: WebsiteImageOptions = {}) {
  const pageUrl = safeRemoteResourceUrl(website, undefined, { allowHttp: true });

  if (!pageUrl) {
    return [];
  }

  pageUrl.protocol = "https:";

  const html = await fetchWebsiteHtml(pageUrl);

  return html
    ? uniqueStrings([
        ...imageUrlsFromHtml(html, pageUrl),
        ...jsonLdImageUrlsFromHtml(html, pageUrl),
        ...contentImageUrlsFromHtml(html, pageUrl, imageKeywords(options.keywords ?? [])),
      ])
    : [];
}

async function fetchWebsiteHtml(initialUrl: URL) {
  let currentUrl = initialUrl;

  for (let redirects = 0; redirects < 3; redirects += 1) {
    try {
      const response = await fetchWithTimeout(currentUrl, WEBSITE_ICON_TIMEOUT_MS, {
        headers: {
          Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
          "User-Agent": WEBSITE_ICON_USER_AGENT,
        },
        redirect: "manual",
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        const redirectedUrl = location
          ? safeRemoteResourceUrl(location, currentUrl, { allowHttp: true })
          : null;

        if (!redirectedUrl) {
          return null;
        }

        redirectedUrl.protocol = "https:";
        currentUrl = redirectedUrl;
        continue;
      }

      if (!response.ok) {
        return null;
      }

      const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";

      if (!contentType.includes("text/html")) {
        return null;
      }

      const contentLength = Number(response.headers.get("content-length") ?? 0);

      if (contentLength > WEBSITE_ICON_MAX_HTML_BYTES) {
        return null;
      }

      const body = await response.arrayBuffer();

      if (body.byteLength > WEBSITE_ICON_MAX_HTML_BYTES) {
        return null;
      }

      return new TextDecoder().decode(body);
    } catch {
      return null;
    }
  }

  return null;
}

function iconUrlsFromHtml(html: string, pageUrl: URL) {
  const links = [...html.matchAll(/<link\b[^>]*>/gi)].map((match) => match[0]);

  return links
    .map((tag) => ({
      href: attributeValue(tag, "href"),
      rel: attributeValue(tag, "rel")?.toLowerCase() ?? "",
      sizes: attributeValue(tag, "sizes")?.toLowerCase() ?? "",
    }))
    .filter((link) => link.href && isIconRel(link.rel) && hasUsableDeclaredSize(link.sizes))
    .sort((a, b) => iconPriority(b) - iconPriority(a))
    .map((link) => safeRemoteResourceUrl(link.href ?? "", pageUrl))
    .filter((url): url is URL => Boolean(url))
    .map((url) => url.toString());
}

function imageUrlsFromHtml(html: string, pageUrl: URL) {
  const metaUrls = [...html.matchAll(/<meta\b[^>]*>/gi)]
    .map((match) => match[0])
    .map((tag) => ({
      content: attributeValue(tag, "content"),
      key: (
        attributeValue(tag, "property") ??
        attributeValue(tag, "name") ??
        attributeValue(tag, "itemprop") ??
        ""
      ).toLowerCase(),
    }))
    .filter((meta) => meta.content && isImageMetaKey(meta.key))
    .sort((a, b) => imageMetaPriority(b.key) - imageMetaPriority(a.key))
    .map((meta) => safeRemoteResourceUrl(meta.content ?? "", pageUrl))
    .filter((url): url is URL => Boolean(url))
    .map((url) => url.toString());

  const linkUrls = [...html.matchAll(/<link\b[^>]*>/gi)]
    .map((match) => match[0])
    .map((tag) => ({
      href: attributeValue(tag, "href"),
      rel: attributeValue(tag, "rel")?.toLowerCase() ?? "",
    }))
    .filter((link) => link.href && link.rel.split(/\s+/).includes("image_src"))
    .map((link) => safeRemoteResourceUrl(link.href ?? "", pageUrl))
    .filter((url): url is URL => Boolean(url))
    .map((url) => url.toString());

  return [...metaUrls, ...linkUrls];
}

function jsonLdImageUrlsFromHtml(html: string, pageUrl: URL) {
  return [
    ...html.matchAll(
      /<script\b[^>]*type\s*=\s*(?:"application\/ld\+json"|'application\/ld\+json')[^>]*>([\s\S]*?)<\/script>/gi,
    ),
  ]
    .flatMap((match) => jsonLdImageValues(match[1] ?? ""))
    .map((value) => safeRemoteResourceUrl(value, pageUrl))
    .filter((url): url is URL => Boolean(url))
    .map((url) => url.toString());
}

function contentImageUrlsFromHtml(html: string, pageUrl: URL, keywords: string[]) {
  const imageUrls = [
    ...imageAttributesFromHtml(html),
    ...cssImageUrlsFromHtml(html),
    ...absoluteImageUrlsFromHtml(html),
  ];

  return uniqueStrings(imageUrls)
    .map((value, index) => ({
      index,
      score: scoreContentImageUrl(value, keywords),
      url: safeRemoteResourceUrl(value, pageUrl),
    }))
    .filter(
      (entry): entry is { index: number; score: number; url: URL } =>
        Boolean(entry.url) && entry.score > 0,
    )
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.url.toString());
}

function defaultIconUrls(pageUrl: URL, options: WebsiteIconOptions) {
  const paths = [
    "/apple-touch-icon.png",
    "/favicon-512x512.png",
    "/favicon-192x192.png",
    "/favicon-32x32.png",
    "/favicon.png",
    ...(options.includeLegacyFavicon ? ["/favicon.ico"] : []),
  ];

  return paths
    .map((path) => safeRemoteResourceUrl(path, pageUrl))
    .filter((url): url is URL => Boolean(url))
    .map((url) => url.toString());
}

function googleFaviconUrl(pageUrl: URL) {
  const url = new URL("https://www.google.com/s2/favicons");
  url.searchParams.set("domain", pageUrl.hostname);
  url.searchParams.set("sz", "256");

  return url.toString();
}

function isIconRel(rel: string) {
  return rel
    .split(/\s+/)
    .some((part) => part === "icon" || part === "shortcut" || part === "apple-touch-icon");
}

function isImageMetaKey(key: string) {
  return new Set([
    "image",
    "logo",
    "og:image",
    "og:image:secure_url",
    "og:image:url",
    "thumbnailurl",
    "twitter:image",
    "twitter:image:src",
  ]).has(key);
}

function imageAttributesFromHtml(html: string) {
  return [...html.matchAll(/<(?:img|source)\b[^>]*>/gi)].flatMap((match) => {
    const tag = match[0];

    return [
      attributeValue(tag, "src"),
      attributeValue(tag, "data-src"),
      attributeValue(tag, "data-lazy-src"),
      ...srcSetUrls(attributeValue(tag, "srcset")),
      ...srcSetUrls(attributeValue(tag, "data-srcset")),
    ].filter((value): value is string => Boolean(value));
  });
}

function cssImageUrlsFromHtml(html: string) {
  return [...html.matchAll(/url\((?:"([^"]+)"|'([^']+)'|([^)'"]+))\)/gi)]
    .map((match) => match[1] ?? match[2] ?? match[3])
    .filter((value): value is string => Boolean(value));
}

function absoluteImageUrlsFromHtml(html: string) {
  return [
    ...html
      .replace(/\\\//g, "/")
      .matchAll(/https?:\/\/[^\s"'<>\\)]+?\.(?:avif|jpe?g|png|svg|webp)(?:\?[^\s"'<>\\)]*)?/gi),
  ].map((match) => match[0]);
}

function srcSetUrls(value: string | null) {
  return value
    ? value
        .split(",")
        .map((entry) => entry.trim().split(/\s+/)[0])
        .filter(Boolean)
    : [];
}

function scoreContentImageUrl(value: string, keywords: string[]) {
  const normalized = normalizeForImageMatching(value);

  if (!isLikelyContentImage(normalized)) {
    return -100;
  }

  let score = /\.(?:jpe?g|webp|avif)(?:[?#]|$)/i.test(value) ? 3 : 1;

  for (const keyword of keywords) {
    if (normalized.includes(keyword)) {
      score += keyword.length > 5 ? 5 : 3;
    }
  }

  for (const term of [
    "hero",
    "banner",
    "course",
    "golf",
    "club",
    "resort",
    "ocean",
    "players",
    "green",
    "fairway",
    "hole",
    "view",
  ]) {
    if (normalized.includes(term)) {
      score += 3;
    }
  }

  return score;
}

function isLikelyContentImage(normalizedUrl: string) {
  return (
    /\.(?:avif|jpe?g|png|svg|webp)(?:[?#]|$)/i.test(normalizedUrl) &&
    !/\b(icon|sprite|favicon|facebook|instagram|youtube|twitter|x logo|logo gold|payment|paypal|spa|treatment|wellness|pool|wedding|bedroom|suite|restaurant|salon|gift)\b/.test(
      normalizedUrl,
    )
  );
}

function imageKeywords(values: Array<string | null | undefined>) {
  return values
    .flatMap((value) => normalizeForImageMatching(value ?? "").split(" "))
    .filter(
      (token) =>
        token.length > 2 && !["and", "club", "course", "golf", "the", "usa"].includes(token),
    );
}

function imageMetaPriority(key: string) {
  if (key === "og:image" || key === "og:image:secure_url" || key === "og:image:url") {
    return 10;
  }

  if (key === "twitter:image" || key === "twitter:image:src") {
    return 8;
  }

  if (key === "image" || key === "thumbnailurl") {
    return 6;
  }

  if (key === "logo") {
    return 4;
  }

  return 0;
}

function hasUsableDeclaredSize(sizes: string) {
  const declaredSize = largestDeclaredSize(sizes);

  return declaredSize === 0 || declaredSize >= 64;
}

function iconPriority(link: { rel: string; sizes: string }) {
  let score = 0;

  if (link.rel.includes("apple-touch-icon")) {
    score += 10;
  }

  if (link.rel.includes("icon")) {
    score += 8;
  }

  const size = largestDeclaredSize(link.sizes);

  return score + Math.min(size, 512) / 64;
}

function largestDeclaredSize(sizes: string) {
  return [...sizes.matchAll(/\b(\d+)x(\d+)\b/g)].reduce((largest, match) => {
    const width = Number(match[1] ?? 0);
    const height = Number(match[2] ?? 0);

    return Math.max(largest, width, height);
  }, 0);
}

function attributeValue(tag: string, attribute: string) {
  const match = tag.match(
    new RegExp(`\\b${attribute}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'=<>` + "`" + `]+))`, "i"),
  );

  return match?.[1] ?? match?.[2] ?? match?.[3] ?? null;
}

function jsonLdImageValues(source: string) {
  try {
    return collectJsonLdImageValues(JSON.parse(source));
  } catch {
    return [];
  }
}

function collectJsonLdImageValues(value: unknown): string[] {
  if (!value || typeof value !== "object") {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap(collectJsonLdImageValues);
  }

  const record = value as Record<string, unknown>;
  const directValues = ["image", "logo", "thumbnailUrl"].flatMap((key) =>
    stringValues(record[key]),
  );
  const graphValues = collectJsonLdImageValues(record["@graph"]);

  return [...directValues, ...graphValues];
}

function normalizeForImageMatching(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9.]+/g, " ")
    .trim();
}

function stringValues(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap(stringValues);
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;

    return stringValues(record.url ?? record.contentUrl);
  }

  return [];
}

function uniqueStrings(values: string[]) {
  return [...new Set(values)];
}
