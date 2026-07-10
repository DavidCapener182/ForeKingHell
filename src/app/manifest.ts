import type { MetadataRoute } from "next";

import { BRAND_DESCRIPTION, BRAND_NAME, BRAND_SHORT_NAME } from "@/lib/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND_NAME,
    short_name: BRAND_SHORT_NAME,
    description: BRAND_DESCRIPTION,
    start_url: "/today",
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
        name: "Analyse progress",
        short_name: "Analyse",
        description: "Find the strongest signal in your golf data.",
        url: "/analyse",
        icons: [{ src: "/icons/lmwt-icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Review sessions",
        short_name: "Sessions",
        description: "Open practice sessions and rounds in one history.",
        url: "/sessions",
        icons: [{ src: "/icons/lmwt-icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
