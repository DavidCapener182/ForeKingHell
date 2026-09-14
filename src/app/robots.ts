import type { MetadataRoute } from "next";

import { BRAND_PUBLIC_URL } from "@/lib/brand";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/privacy", "/terms", "/cookies"],
      disallow: [
        "/admin/",
        "/api/",
        "/dashboard",
        "/today",
        "/sessions",
        "/analyse",
        "/bag",
        "/practice",
        "/data-chat",
        "/share/",
        "/shared/",
        "/settings/",
        "/billing",
        "/login",
        "/thank-you",
        "/404",
      ],
    },
    sitemap: `${BRAND_PUBLIC_URL}/sitemap.xml`,
  };
}
