import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ForeKingHell",
    short_name: "FKH",
    description: "Personal golf analytics for launch monitor data, bag mapping, rounds, and progress tracking.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    display_override: ["window-controls-overlay", "standalone", "browser"],
    background_color: "#f7f8fa",
    theme_color: "#111827",
    orientation: "portrait",
    categories: ["sports", "health", "productivity"],
    icons: [
      {
        src: "/icons/fkh-icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/fkh-icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icons/fkh-icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/fkh-icon-maskable-512.png",
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
        icons: [{ src: "/icons/fkh-icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Achievements",
        short_name: "Badges",
        description: "Review achievements, XP, and recent unlocks.",
        url: "/achievements",
        icons: [{ src: "/icons/fkh-icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Rounds",
        short_name: "Rounds",
        description: "Open saved rounds and scorecards.",
        url: "/rounds",
        icons: [{ src: "/icons/fkh-icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
