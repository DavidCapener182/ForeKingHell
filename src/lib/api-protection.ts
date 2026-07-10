import { NextRequest, NextResponse } from "next/server";

export type RateLimitOptions = {
  keyPrefix: string;
  limit: number;
  subject?: string;
  windowMs: number;
};

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

export function rejectOversizedRequest(request: NextRequest, maxBytes: number) {
  const contentLength = request.headers.get("content-length");

  if (contentLength && Number(contentLength) > maxBytes) {
    return NextResponse.json(
      { message: `Request body is too large. Limit is ${formatBytes(maxBytes)}.` },
      { status: 413 },
    );
  }

  return null;
}

export type BoundedJsonResult =
  | { ok: true; value: unknown }
  | { ok: false; response: NextResponse };

/** Reads JSON while enforcing the byte limit on the consumed stream, even when
 * Content-Length is absent or incorrect. Invalid JSON is returned as null so
 * each route can keep its own payload-specific 400 response. */
export async function readBoundedJsonBody(
  request: Request,
  maxBytes: number,
): Promise<BoundedJsonResult> {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength && Number(declaredLength) > maxBytes) {
    return { ok: false, response: oversizedResponse(maxBytes) };
  }

  if (!request.body) return { ok: true, value: null };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        return { ok: false, response: oversizedResponse(maxBytes) };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: true, value: null };
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return { ok: true, value: JSON.parse(new TextDecoder().decode(body)) };
  } catch {
    return { ok: true, value: null };
  }
}

export function rejectOversizedDataUrl(dataUrl: string, maxBytes: number) {
  const estimatedBytes = estimateDataUrlBytes(dataUrl);

  if (estimatedBytes > maxBytes) {
    return NextResponse.json(
      { message: `Image is too large. Limit is ${formatBytes(maxBytes)}.` },
      { status: 413 },
    );
  }

  return null;
}

export function rateLimitRequest(request: Request, options: RateLimitOptions) {
  const now = Date.now();
  const ip = clientIp(request);
  const key = `${options.keyPrefix}:${options.subject ?? "anonymous"}:${ip}`;
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + options.windowMs });
    return null;
  }

  if (current.count >= options.limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
    return NextResponse.json(
      { message: "Too many requests. Please wait and try again." },
      {
        status: 429,
        headers: {
          "retry-after": retryAfterSeconds.toString(),
        },
      },
    );
  }

  current.count += 1;
  buckets.set(key, current);
  return null;
}

function clientIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function estimateDataUrlBytes(dataUrl: string) {
  const base64 = dataUrl.split(",", 2)[1] ?? "";
  return Math.ceil((base64.length * 3) / 4);
}

function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${Math.round((bytes / 1024 / 1024) * 10) / 10} MB`;
  }

  if (bytes >= 1024) {
    return `${Math.round((bytes / 1024) * 10) / 10} KB`;
  }

  return `${bytes} bytes`;
}

function oversizedResponse(maxBytes: number) {
  return NextResponse.json(
    { message: `Request body is too large. Limit is ${formatBytes(maxBytes)}.` },
    { status: 413 },
  );
}
