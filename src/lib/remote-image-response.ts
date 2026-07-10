import "server-only";

import type { LookupAddress } from "node:dns";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

import { BRAND_NAME, BRAND_PUBLIC_URL } from "@/lib/brand";

export const DEFAULT_REMOTE_IMAGE_CACHE_CONTROL =
  "public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800";

const DEFAULT_MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const DEFAULT_FETCH_TIMEOUT_MS = 4500;
const DEFAULT_MAX_REDIRECTS = 3;
const DEFAULT_USER_AGENT = `Mozilla/5.0 (compatible; ${BRAND_NAME} image resolver; +${BRAND_PUBLIC_URL})`;

type RemoteImageResponseOptions = {
  cacheControl?: string;
  maxBytes?: number;
  maxRedirects?: number;
  minHeight?: number;
  minWidth?: number;
  source?: string;
  sourceHeaderName?: string;
  timeoutMs?: number;
  userAgent?: string;
};

export async function remoteImageResponseFromUrl(
  candidate: string,
  options: RemoteImageResponseOptions = {},
) {
  const image = await fetchRemoteImage(candidate, options);

  if (!image) {
    return null;
  }

  const headers = new Headers({
    "Cache-Control": options.cacheControl ?? DEFAULT_REMOTE_IMAGE_CACHE_CONTROL,
    "Content-Length": image.body.byteLength.toString(),
    "Content-Type": image.contentType,
  });

  if (options.source && options.sourceHeaderName) {
    headers.set(options.sourceHeaderName, options.source);
  }

  return new Response(image.body, { headers });
}

export async function fetchRemoteImage(
  candidate: string,
  options: RemoteImageResponseOptions = {},
) {
  const initialUrl = safeRemoteResourceUrl(candidate);

  if (!initialUrl) {
    return null;
  }

  let currentUrl: URL = initialUrl;
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_IMAGE_BYTES;

  for (let redirects = 0; redirects < maxRedirects; redirects += 1) {
    try {
      if (!(await isSafeResolvedRemoteUrl(currentUrl))) return null;

      const response = await fetchWithTimeout(
        currentUrl,
        options.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS,
        {
          headers: {
            Accept:
              "image/avif,image/webp,image/png,image/jpeg,image/svg+xml,image/*;q=0.8,*/*;q=0.5",
            "User-Agent": options.userAgent ?? DEFAULT_USER_AGENT,
          },
          redirect: "manual",
        },
      );

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        const redirectedUrl: URL | null = location
          ? safeRemoteResourceUrl(location, currentUrl)
          : null;

        if (!redirectedUrl) {
          return null;
        }

        currentUrl = redirectedUrl;
        continue;
      }

      if (!response.ok) {
        return null;
      }

      const contentType =
        response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "";

      if (!contentType.startsWith("image/")) {
        return null;
      }

      const contentLength = Number(response.headers.get("content-length") ?? 0);

      if (contentLength > maxBytes) {
        return null;
      }

      const body = await response.arrayBuffer();

      if (body.byteLength === 0 || body.byteLength > maxBytes) {
        return null;
      }

      const dimensions = imageDimensions(body, contentType);

      if (dimensions) {
        if (options.minWidth && dimensions.width < options.minWidth) {
          return null;
        }

        if (options.minHeight && dimensions.height < options.minHeight) {
          return null;
        }
      }

      return {
        body,
        contentType,
      };
    } catch {
      return null;
    }
  }

  return null;
}

export async function fetchWithTimeout(input: URL, timeoutMs: number, init: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export function safeRemoteResourceUrl(
  value: string,
  base?: URL,
  options: { allowHttp?: boolean } = {},
) {
  try {
    const url = new URL(value, base);
    const allowedProtocols = options.allowHttp ? new Set(["http:", "https:"]) : new Set(["https:"]);

    if (
      !allowedProtocols.has(url.protocol) ||
      url.username ||
      url.password ||
      isBlockedHost(url.hostname)
    ) {
      return null;
    }

    return url;
  } catch {
    return null;
  }
}

export async function isSafeResolvedRemoteUrl(
  url: URL,
  resolver: (hostname: string) => Promise<LookupAddress[]> = (hostname) =>
    lookup(hostname, { all: true, verbatim: true }),
) {
  if (isBlockedHost(url.hostname)) return false;
  if (isIP(url.hostname.replace(/^\[|\]$/g, ""))) return true;

  try {
    const addresses = await resolver(url.hostname);
    return addresses.length > 0 && addresses.every((entry) => !isBlockedHost(entry.address));
  } catch {
    return false;
  }
}

function isBlockedHost(hostname: string) {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "");

  if (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized.endsWith(".local") ||
    normalized === "0.0.0.0"
  ) {
    return true;
  }

  const ipVersion = isIP(normalized);

  if (ipVersion === 4) {
    return isBlockedIpv4(normalized);
  }

  if (ipVersion === 6) {
    return (
      normalized === "::1" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("fe80:")
    );
  }

  return false;
}

function isBlockedIpv4(value: string) {
  const [first = 0, second = 0] = value.split(".").map((part) => Number(part));

  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}

function imageDimensions(body: ArrayBuffer, contentType: string) {
  const bytes = new Uint8Array(body);

  if (contentType === "image/png") {
    return pngDimensions(bytes);
  }

  if (contentType === "image/jpeg" || contentType === "image/jpg") {
    return jpegDimensions(bytes);
  }

  if (contentType === "image/webp") {
    return webpDimensions(bytes);
  }

  if (contentType === "image/x-icon" || contentType === "image/vnd.microsoft.icon") {
    return icoDimensions(bytes);
  }

  return null;
}

function pngDimensions(bytes: Uint8Array) {
  if (
    bytes.length < 24 ||
    bytes[0] !== 0x89 ||
    bytes[1] !== 0x50 ||
    bytes[2] !== 0x4e ||
    bytes[3] !== 0x47
  ) {
    return null;
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  return {
    height: view.getUint32(20),
    width: view.getUint32(16),
  };
}

function jpegDimensions(bytes: Uint8Array) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    return null;
  }

  let offset = 2;

  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = bytes[offset + 1];
    const segmentLength = (bytes[offset + 2] << 8) + bytes[offset + 3];

    if (segmentLength < 2) {
      return null;
    }

    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return {
        height: (bytes[offset + 5] << 8) + bytes[offset + 6],
        width: (bytes[offset + 7] << 8) + bytes[offset + 8],
      };
    }

    offset += 2 + segmentLength;
  }

  return null;
}

function webpDimensions(bytes: Uint8Array) {
  if (bytes.length < 30 || ascii(bytes, 0, 4) !== "RIFF" || ascii(bytes, 8, 12) !== "WEBP") {
    return null;
  }

  const chunkType = ascii(bytes, 12, 16);

  if (chunkType === "VP8X" && bytes.length >= 30) {
    return {
      height: 1 + littleEndian24(bytes, 27),
      width: 1 + littleEndian24(bytes, 24),
    };
  }

  if (chunkType === "VP8 " && bytes.length >= 30) {
    return {
      height: bytes[26] + ((bytes[27] & 0x3f) << 8),
      width: bytes[24] + ((bytes[25] & 0x3f) << 8),
    };
  }

  if (chunkType === "VP8L" && bytes.length >= 25) {
    const bits = bytes[21] | (bytes[22] << 8) | (bytes[23] << 16) | (bytes[24] << 24);

    return {
      height: 1 + ((bits >> 14) & 0x3fff),
      width: 1 + (bits & 0x3fff),
    };
  }

  return null;
}

function icoDimensions(bytes: Uint8Array) {
  if (bytes.length < 8 || bytes[0] !== 0 || bytes[1] !== 0 || bytes[2] !== 1 || bytes[3] !== 0) {
    return null;
  }

  return {
    height: bytes[7] === 0 ? 256 : bytes[7],
    width: bytes[6] === 0 ? 256 : bytes[6],
  };
}

function littleEndian24(bytes: Uint8Array, offset: number) {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function ascii(bytes: Uint8Array, start: number, end: number) {
  return String.fromCharCode(...bytes.slice(start, end));
}
