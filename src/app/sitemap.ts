import type { MetadataRoute } from "next";

import { BRAND_PUBLIC_URL } from "@/lib/brand";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: BRAND_PUBLIC_URL, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    {
      url: `${BRAND_PUBLIC_URL}/privacy`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.4,
    },
    { url: `${BRAND_PUBLIC_URL}/terms`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BRAND_PUBLIC_URL}/cookies`, changeFrequency: "yearly", priority: 0.3 },
  ];
}
