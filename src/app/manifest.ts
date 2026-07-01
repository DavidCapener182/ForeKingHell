import type { MetadataRoute } from "next";

import { BRAND_DESCRIPTION, BRAND_NAME, BRAND_SHORT_NAME } from "@/lib/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND_NAME,
    short_name: BRAND_SHORT_NAME,
    description: BRAND_DESCRIPTION,
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    display_override: ["window-controls-overlay", "standalone", "browser"],
    background_color: "#f7f8fa",
    theme_color: "#f7f8fa",
    orientation: "portrait",
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
        name: "Import shots",
        short_name: "Import",
        description: "Import a launch-monitor session.",
        url: "/import",
        icons: [{ src: "/icons/lmwt-icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Achievements",
        short_name: "Badges",
        description: "Review achievements, XP, and recent unlocks.",
        url: "/achievements",
        icons: [{ src: "/icons/lmwt-icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Rounds",
        short_name: "Rounds",
        description: "Open saved rounds and scorecards.",
        url: "/rounds",
        icons: [{ src: "/icons/lmwt-icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
