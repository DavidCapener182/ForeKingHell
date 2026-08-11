import type { MetadataRoute } from "next";

import { BRAND_DESCRIPTION, BRAND_NAME, BRAND_SHORT_NAME } from "@/lib/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND_NAME,
    short_name: BRAND_SHORT_NAME,
    description: BRAND_DESCRIPTION,
    start_url: "/surface/companion?next=%2Ftoday",
    scope: "/",
    display: "standalone",
    display_override: ["window-controls-overlay", "standalone", "browser"],
    background_color: "#f2f2f7",
    theme_color: "#f2f2f7",
    categories: ["sports", "health", "productivity"],
    icons: [
      {
        src: "/icons/lmwt-icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/lmwt-icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icons/lmwt-icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/lmwt-icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Plan practice",
        short_name: "Practice",
        description: "Build and start a recommended range session.",
        url: "/surface/companion?next=%2Fpractice",
        icons: [{ src: "/icons/lmwt-icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Course strategy",
        short_name: "Strategy",
        description: "Review the plan for your selected course.",
        url: "/surface/companion?next=%2Fplay",
        icons: [{ src: "/icons/lmwt-icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Latest session",
        short_name: "Latest",
        description: "Review your latest practice session or round.",
        url: "/surface/companion?next=%2Fsessions",
        icons: [{ src: "/icons/lmwt-icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Import data",
        short_name: "Import",
        description: "Import or sync launch-monitor evidence.",
        url: "/surface/companion?next=%2Fimport",
        icons: [{ src: "/icons/lmwt-icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
