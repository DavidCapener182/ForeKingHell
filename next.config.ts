import type { NextConfig } from "next";

const allowedDevOrigins = parseAllowedDevOrigins(process.env.NEXT_ALLOWED_DEV_ORIGINS);

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  ...(process.env.NODE_ENV === "development" && allowedDevOrigins.length > 0
    ? { allowedDevOrigins }
    : {}),
  experimental: {
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
          },
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
          },
        ],
      },
    ];
  },
};

export default nextConfig;

function parseAllowedDevOrigins(value: string | undefined) {
  const configuredOrigins = (value ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return Array.from(new Set(["127.0.0.1", ...configuredOrigins]));
}
