import { NextRequest, NextResponse } from "next/server";

export type RateLimitOptions = {
  keyPrefix: string;
  limit: number;
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

export function rateLimitRequest(request: NextRequest, options: RateLimitOptions) {
  const now = Date.now();
  const ip = clientIp(request);
  const key = `${options.keyPrefix}:${ip}`;
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

function clientIp(request: NextRequest) {
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
