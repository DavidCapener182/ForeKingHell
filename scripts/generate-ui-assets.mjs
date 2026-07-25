import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const outRoot = "public/assets";

const pageAssets = [
  {
    file: "page-speed-bay.webp",
    accent: "#0B7A3B",
    secondary: "#38BDF8",
    motif: "speed-grid",
    layout: "hero",
  },
  {
    file: "page-groups-clubhouse.webp",
    accent: "#0B7A3B",
    secondary: "#C7972B",
    motif: "league-board",
    layout: "hero",
  },
  {
    file: "page-settings-locker.webp",
    accent: "#0F766E",
    secondary: "#64748B",
    motif: "shield-gear",
    layout: "hero",
  },
  {
    file: "page-friends-match.webp",
    accent: "#2563EB",
    secondary: "#0B7A3B",
    motif: "friends-card",
    layout: "hero",
  },
  {
    file: "page-leaderboard-podium.webp",
    accent: "#C7972B",
    secondary: "#0B7A3B",
    motif: "podium-board",
    layout: "hero",
  },
  {
    file: "page-practice-grid.webp",
    accent: "#0B7A3B",
    secondary: "#EC4899",
    motif: "practice-grid",
    layout: "hero",
  },
  {
    file: "page-stock-yardages-hero.webp",
    accent: "#0B7A3B",
    secondary: "#38BDF8",
    motif: "yardage-rings",
    layout: "hero",
  },
  {
    file: "page-progress-hero.webp",
    accent: "#0B7A3B",
    secondary: "#C7972B",
    motif: "trend-badges",
    layout: "hero",
  },
  {
    file: "page-rounds-hero.webp",
    accent: "#0B7A3B",
    secondary: "#2563EB",
    motif: "scoreband",
    layout: "hero",
  },
  {
    file: "page-equipment-bag-panel.webp",
    accent: "#111827",
    secondary: "#0B7A3B",
    motif: "bag-window",
    layout: "hero",
  },
  {
    file: "page-import-rapsodo.webp",
    title: "Import",
    subtitle: "CSV + launch monitor",
    accent: "#0B7A3B",
    secondary: "#38BDF8",
    motif: "device",
  },
  {
    file: "page-handicap-scorecard.webp",
    title: "Handicap",
    subtitle: "Scorecard trend",
    accent: "#C7972B",
    secondary: "#0B7A3B",
    motif: "scorecard",
  },
  {
    file: "page-course-records-honours.webp",
    title: "Honours",
    subtitle: "Flags + boards",
    accent: "#C7972B",
    secondary: "#0B7A3B",
    motif: "flag",
  },
  {
    file: "page-coach-drill-board.webp",
    title: "Coach",
    subtitle: "Drill board",
    accent: "#0B7A3B",
    secondary: "#EC4899",
    motif: "targets",
  },
  {
    file: "feed-empty-state.webp",
    title: "Feed",
    subtitle: "Verified activity",
    accent: "#38BDF8",
    secondary: "#0B7A3B",
    motif: "cards",
  },
  {
    file: "profile-trophy-shelf.webp",
    title: "Profile",
    subtitle: "Trophy shelf",
    accent: "#C7972B",
    secondary: "#0B7A3B",
    motif: "trophy",
  },
  {
    file: "provider-rapsodo-device.webp",
    title: "Rapsodo",
    subtitle: "Live",
    accent: "#D71920",
    secondary: "#0B7A3B",
    motif: "radar",
  },
  {
    file: "provider-square-device.webp",
    title: "Square",
    subtitle: "Beta",
    accent: "#111827",
    secondary: "#38BDF8",
    motif: "device",
  },
  {
    file: "provider-trackman-radar.webp",
    title: "TrackMan",
    subtitle: "Radar",
    accent: "#F97316",
    secondary: "#0B7A3B",
    motif: "radar",
  },
  {
    file: "course-placeholder-map.webp",
    title: "Course",
    subtitle: "Map placeholder",
    accent: "#0B7A3B",
    secondary: "#38BDF8",
    motif: "map",
  },
  {
    file: "feed-pb-card-bg.webp",
    title: "PB",
    subtitle: "Personal best",
    accent: "#EC4899",
    secondary: "#0B7A3B",
    motif: "trace",
  },
];

const challengeAssets = [
  ["challenge-wedge-window.webp", "Wedge", "Window", "#0B7A3B", "target"],
  ["challenge-longest-drive.webp", "Longest", "Drive", "#2563EB", "trace"],
  ["challenge-closest-pin.webp", "Closest", "Pin", "#C7972B", "flag"],
  ["challenge-seven-iron-consistency.webp", "7i", "Consistency", "#EC4899", "target"],
];

const clubTypes = [
  "driver",
  "3w",
  "5w",
  "7w",
  "3h",
  "4h",
  "5h",
  "4i",
  "5i",
  "6i",
  "7i",
  "8i",
  "9i",
  "pw",
  "gw",
  "aw",
  "sw",
  "lw",
];

mkdirSync(outRoot, { recursive: true });
mkdirSync(path.join(outRoot, "tour-covers"), { recursive: true });
mkdirSync(path.join(outRoot, "clubs", "panel"), { recursive: true });
mkdirSync(path.join(outRoot, "clubs", "generated-v2"), { recursive: true });

for (const asset of pageAssets) {
  await renderWebp(path.join(outRoot, asset.file), pageSvg(asset), 1200, 800);
}

for (const [file, title, subtitle, accent, motif] of challengeAssets) {
  await renderWebp(
    path.join(outRoot, file),
    badgeSvg({ title, subtitle, accent, motif }),
    800,
    800,
  );
}

for (let index = 1; index <= 10; index += 1) {
  const hue = (index * 37) % 360;
  await renderWebp(
    path.join(outRoot, "tour-covers", `tour-cover-${String(index).padStart(2, "0")}.webp`),
    tourCoverSvg(index, hue),
    1400,
    900,
  );
}

for (const source of ["panel", "generated-v2"]) {
  for (const type of clubTypes) {
    for (const view of ["side", "top"]) {
      await renderPng(
        path.join(outRoot, "clubs", source, `${type}-${view}.png`),
        clubSvg({ type, view, source }),
        640,
        360,
      );
    }
  }
}

writeFileSync(path.join(outRoot, "page-shots-shot-trace.svg"), shotTraceSvg());

console.log("Generated LM World Tour UI assets.");

async function renderWebp(file, svg, width, height) {
  await sharp(Buffer.from(svg)).resize(width, height).webp({ quality: 86 }).toFile(file);
}

async function renderPng(file, svg, width, height) {
  await sharp(Buffer.from(svg)).resize(width, height).png().toFile(file);
}

function pageSvg({ title, subtitle, accent, secondary, motif }) {
  const showCard = title && subtitle;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="0.52" stop-color="#f5f6f4"/>
      <stop offset="1" stop-color="${mix(accent, "#ffffff", 0.78)}"/>
    </linearGradient>
    <linearGradient id="green" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0" stop-color="${accent}" stop-opacity="0.92"/>
      <stop offset="1" stop-color="${secondary}" stop-opacity="0.84"/>
    </linearGradient>
    <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="18" stdDeviation="20" flood-color="#0f172a" flood-opacity="0.14"/>
    </filter>
  </defs>
  <rect width="1200" height="800" fill="url(#bg)"/>
  <path d="M0 610 C210 545 314 662 532 590 C744 520 843 402 1200 438 L1200 800 L0 800 Z" fill="${mix(accent, "#ffffff", 0.22)}"/>
  <path d="M0 676 C228 602 380 714 575 642 C777 568 928 520 1200 560 L1200 800 L0 800 Z" fill="${mix(secondary, "#ffffff", 0.36)}"/>
  <g opacity="0.15" stroke="${accent}" stroke-width="3" fill="none">
    <path d="M104 172 C283 96 415 111 590 190 S874 302 1076 196"/>
    <path d="M92 232 C278 164 468 182 610 244 S870 330 1116 270"/>
  </g>
  ${motifSvg(motif, accent, secondary)}
  ${
    showCard
      ? `<g transform="translate(90 88)">
    <rect width="430" height="178" rx="24" fill="#ffffff" opacity="0.86" filter="url(#soft)"/>
    <text x="36" y="74" font-family="Inter,Arial,sans-serif" font-size="52" font-weight="800" fill="#050505">${escapeXml(title)}</text>
    <text x="38" y="124" font-family="Inter,Arial,sans-serif" font-size="26" font-weight="600" fill="#6b7280">${escapeXml(subtitle)}</text>
    <rect x="36" y="144" width="156" height="8" rx="4" fill="url(#green)"/>
  </g>`
      : ""
  }
</svg>`;
}

function badgeSvg({ title, subtitle, accent, motif }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
  <defs>
    <radialGradient id="bg" cx="50%" cy="38%" r="72%">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="0.58" stop-color="#f5f6f4"/>
      <stop offset="1" stop-color="${mix(accent, "#ffffff", 0.58)}"/>
    </radialGradient>
  </defs>
  <rect width="800" height="800" rx="88" fill="url(#bg)"/>
  <circle cx="400" cy="370" r="236" fill="#ffffff" opacity="0.78"/>
  <circle cx="400" cy="370" r="182" fill="${mix(accent, "#ffffff", 0.18)}"/>
  ${motifSvg(motif, accent, "#0B7A3B", 160, 130)}
  <text x="400" y="606" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="70" font-weight="850" fill="#050505">${escapeXml(title)}</text>
  <text x="400" y="674" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="42" font-weight="700" fill="${accent}">${escapeXml(subtitle)}</text>
</svg>`;
}

function tourCoverSvg(index, hue) {
  const accent = hsl(hue, 72, 34);
  const secondary = hsl((hue + 82) % 360, 74, 42);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="900" viewBox="0 0 1400 900">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f8fafc"/>
      <stop offset="0.56" stop-color="${mix(secondary, "#ffffff", 0.6)}"/>
      <stop offset="1" stop-color="${mix(accent, "#000000", 0.24)}"/>
    </linearGradient>
    <linearGradient id="shade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#050505" stop-opacity="0"/>
      <stop offset="1" stop-color="#050505" stop-opacity="0.55"/>
    </linearGradient>
  </defs>
  <rect width="1400" height="900" fill="url(#sky)"/>
  <circle cx="${220 + index * 38}" cy="170" r="72" fill="#ffffff" opacity="0.75"/>
  <path d="M0 565 C234 480 408 540 610 486 C854 421 1012 496 1400 404 L1400 900 L0 900 Z" fill="${mix(accent, "#ffffff", 0.24)}"/>
  <path d="M0 684 C210 594 374 658 612 592 C862 524 1036 578 1400 508 L1400 900 L0 900 Z" fill="${accent}"/>
  <path d="M0 746 C238 708 504 774 762 684 C944 620 1158 652 1400 604 L1400 900 L0 900 Z" fill="${mix("#0B7A3B", accent, 0.48)}"/>
  <path d="M826 545 L826 262" stroke="#ffffff" stroke-width="10" stroke-linecap="round"/>
  <path d="M836 272 L1050 324 L836 374 Z" fill="#ffffff"/>
  <path d="M0 0 H1400 V900 H0 Z" fill="url(#shade)"/>
  <text x="84" y="720" font-family="Inter,Arial,sans-serif" font-size="68" font-weight="850" fill="#ffffff">Tour Cover ${String(index).padStart(2, "0")}</text>
  <text x="88" y="778" font-family="Inter,Arial,sans-serif" font-size="30" font-weight="650" fill="#ffffff" opacity="0.82">Daily, weekly and monthly event art</text>
</svg>`;
}

function clubSvg({ type, view, source }) {
  const accent = source === "generated-v2" ? "#0B7A3B" : "#111827";
  const loft = type.includes("w") || type === "driver" ? 0 : clubTypes.indexOf(type) * 2;
  const head =
    view === "top"
      ? `<ellipse cx="482" cy="178" rx="${type === "driver" ? 92 : 58}" ry="${type === "driver" ? 48 : 34}" fill="${accent}"/><ellipse cx="480" cy="176" rx="${type === "driver" ? 58 : 34}" ry="${type === "driver" ? 23 : 14}" fill="#ffffff" opacity="0.18"/>`
      : `<path d="M442 144 C514 130 578 162 594 212 C548 238 484 226 420 200 Z" fill="${accent}"/><path d="M462 164 C512 156 552 172 568 200" stroke="#ffffff" stroke-opacity="0.24" stroke-width="12" fill="none" stroke-linecap="round"/>`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
  <rect width="640" height="360" fill="none"/>
  <g transform="rotate(${-8 + loft / 8} 320 180)">
    <path d="M70 226 C214 190 338 166 470 172" stroke="#111827" stroke-width="14" stroke-linecap="round"/>
    <path d="M78 226 C218 194 342 172 470 178" stroke="#ffffff" stroke-opacity="0.34" stroke-width="4" stroke-linecap="round"/>
    ${head}
    <circle cx="84" cy="225" r="18" fill="#111827"/>
    <circle cx="84" cy="225" r="7" fill="#ffffff" opacity="0.28"/>
  </g>
  <text x="48" y="304" font-family="Inter,Arial,sans-serif" font-size="38" font-weight="800" fill="#111827" opacity="0.82">${escapeXml(type.toUpperCase())}</text>
</svg>`;
}

function shotTraceSvg() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="720" height="320" viewBox="0 0 720 320" role="img" aria-label="Shot trace">
  <rect width="720" height="320" rx="32" fill="#f5f6f4"/>
  <path d="M48 250 C172 136 334 72 642 60" fill="none" stroke="#0B7A3B" stroke-width="9" stroke-linecap="round" stroke-dasharray="18 16"/>
  <path d="M62 256 C198 226 394 214 672 260" fill="none" stroke="#0B7A3B" stroke-width="26" stroke-linecap="round" opacity="0.12"/>
  <circle cx="642" cy="60" r="15" fill="#0B7A3B"/>
  <circle cx="488" cy="82" r="9" fill="#0B7A3B" opacity="0.45"/>
  <circle cx="328" cy="132" r="7" fill="#0B7A3B" opacity="0.3"/>
</svg>`;
}

function motifSvg(motif, accent, secondary, dx = 0, dy = 0) {
  const transform = `translate(${dx} ${dy})`;
  if (motif === "scorecard") {
    return `<g transform="${transform} translate(720 180)" fill="none" stroke="${accent}" stroke-width="12" opacity="0.9"><rect x="0" y="0" width="300" height="360" rx="28" fill="#ffffff" stroke="${accent}"/><path d="M42 96 H258 M42 168 H258 M42 240 H258 M120 44 V316 M204 44 V316" stroke-opacity="0.28"/><path d="M54 300 C112 224 194 250 248 154" stroke="${secondary}" stroke-linecap="round"/></g>`;
  }
  if (motif === "flag") {
    return `<g transform="${transform} translate(760 150)"><path d="M80 430 V70" stroke="${accent}" stroke-width="14" stroke-linecap="round"/><path d="M92 84 L330 130 L92 196 Z" fill="${secondary}"/><circle cx="80" cy="440" r="52" fill="${mix(accent, "#ffffff", 0.32)}"/><path d="M20 440 C126 394 238 474 366 424" stroke="${accent}" stroke-width="10" fill="none" opacity="0.22"/></g>`;
  }
  if (motif === "targets" || motif === "target") {
    return `<g transform="${transform} translate(742 188)" fill="none" stroke="${accent}" stroke-width="12"><circle cx="190" cy="190" r="172" fill="#ffffff" opacity="0.7"/><circle cx="190" cy="190" r="118" opacity="0.42"/><circle cx="190" cy="190" r="62" opacity="0.62"/><path d="M36 190 H344 M190 36 V344" stroke="${secondary}" stroke-width="8" opacity="0.48"/></g>`;
  }
  if (motif === "cards") {
    return `<g transform="${transform} translate(704 190)"><rect x="0" y="42" width="300" height="190" rx="24" fill="#ffffff" stroke="${accent}" stroke-width="10"/><rect x="54" y="0" width="300" height="190" rx="24" fill="#ffffff" stroke="${secondary}" stroke-width="10"/><circle cx="112" cy="64" r="24" fill="${accent}"/><path d="M158 58 H298 M158 104 H260 M64 270 H270" stroke="${accent}" stroke-width="12" stroke-linecap="round" opacity="0.28"/></g>`;
  }
  if (motif === "trophy") {
    return `<g transform="${transform} translate(756 168)" fill="${accent}"><path d="M86 66 H294 V158 C294 238 252 286 190 286 C128 286 86 238 86 158 Z"/><path d="M78 92 H18 C18 174 58 218 106 218 V186 C78 180 54 154 50 126 H78 Z" opacity="0.72"/><path d="M302 92 H362 C362 174 322 218 274 218 V186 C302 180 326 154 330 126 H302 Z" opacity="0.72"/><rect x="158" y="284" width="64" height="72" rx="12"/><rect x="100" y="344" width="180" height="36" rx="18"/></g>`;
  }
  if (motif === "radar") {
    return `<g transform="${transform} translate(770 198)" fill="none" stroke="${accent}" stroke-width="12"><path d="M12 268 C72 86 240 20 382 88" stroke="${secondary}"/><path d="M78 276 C126 154 242 104 344 154" opacity="0.52"/><path d="M150 286 C194 214 264 192 322 224" opacity="0.34"/><rect x="136" y="270" width="150" height="58" rx="20" fill="${accent}" stroke="none"/></g>`;
  }
  if (motif === "map") {
    return `<g transform="${transform} translate(700 170)" fill="none" stroke="${accent}" stroke-width="10"><path d="M30 330 C92 190 204 230 236 102 C282 172 392 154 428 36" stroke="${secondary}"/><path d="M38 84 C156 32 284 62 420 118"/><path d="M72 402 C166 328 286 362 442 290"/><circle cx="238" cy="102" r="18" fill="${accent}" stroke="none"/><circle cx="428" cy="36" r="18" fill="${secondary}" stroke="none"/></g>`;
  }
  if (motif === "trace") {
    return `<g transform="${transform} translate(650 244)" fill="none" stroke="${accent}" stroke-width="14" stroke-linecap="round"><path d="M18 250 C154 74 328 42 510 30" stroke-dasharray="24 18"/><path d="M28 264 C190 212 334 226 540 278" stroke-width="30" opacity="0.14"/><circle cx="510" cy="30" r="18" fill="${secondary}" stroke="none"/></g>`;
  }
  if (motif === "speed-grid") {
    return `<g transform="${transform} translate(622 120)">
      <rect x="30" y="220" width="498" height="232" rx="38" fill="#ffffff" opacity="0.62"/>
      <path d="M86 380 C154 274 246 226 360 198 C392 192 426 190 462 190" fill="none" stroke="${accent}" stroke-width="18" stroke-linecap="round"/>
      <path d="M102 392 C186 334 276 312 406 306" fill="none" stroke="${secondary}" stroke-width="12" stroke-linecap="round" opacity="0.82"/>
      <path d="M440 152 C502 152 554 204 554 270" fill="none" stroke="${secondary}" stroke-width="14" opacity="0.34"/>
      <path d="M414 126 C516 126 598 208 598 310" fill="none" stroke="${accent}" stroke-width="14" opacity="0.46"/>
      <path d="M386 94 C526 94 640 208 640 348" fill="none" stroke="${accent}" stroke-width="14" opacity="0.2"/>
      <circle cx="128" cy="388" r="20" fill="#111827"/>
      <rect x="84" y="422" width="126" height="16" rx="8" fill="${mix(accent, "#ffffff", 0.12)}"/>
      <rect x="252" y="354" width="128" height="16" rx="8" fill="${mix(secondary, "#ffffff", 0.1)}"/>
      <rect x="410" y="284" width="112" height="16" rx="8" fill="${mix(accent, "#ffffff", 0.18)}"/>
    </g>`;
  }
  if (motif === "league-board") {
    return `<g transform="${transform} translate(628 116)">
      <rect x="44" y="144" width="504" height="296" rx="40" fill="#ffffff" opacity="0.78"/>
      <rect x="82" y="182" width="428" height="68" rx="22" fill="${mix(accent, "#ffffff", 0.16)}"/>
      <rect x="82" y="270" width="428" height="56" rx="20" fill="${mix(secondary, "#ffffff", 0.18)}"/>
      <rect x="82" y="344" width="428" height="56" rx="20" fill="${mix(accent, "#ffffff", 0.26)}"/>
      <circle cx="132" cy="216" r="16" fill="${accent}"/>
      <circle cx="132" cy="298" r="14" fill="${secondary}"/>
      <circle cx="132" cy="372" r="14" fill="${accent}"/>
      <path d="M176 216 H420 M176 298 H466 M176 372 H446" stroke="#0f172a" stroke-width="14" stroke-linecap="round" opacity="0.64"/>
      <path d="M452 184 V404" stroke="${mix("#0f172a", "#ffffff", 0.72)}" stroke-width="6" opacity="0.42"/>
      <path d="M496 198 V396" stroke="${mix("#0f172a", "#ffffff", 0.72)}" stroke-width="6" opacity="0.42"/>
    </g>`;
  }
  if (motif === "shield-gear") {
    return `<g transform="${transform} translate(644 118)">
      <rect x="50" y="154" width="486" height="276" rx="40" fill="#ffffff" opacity="0.72"/>
      <path d="M194 156 H392 V236 C392 310 344 354 292 378 C240 354 194 310 194 236 Z" fill="${mix(accent, "#ffffff", 0.1)}" stroke="${accent}" stroke-width="12"/>
      <circle cx="418" cy="308" r="76" fill="${mix(secondary, "#ffffff", 0.18)}"/>
      <circle cx="418" cy="308" r="42" fill="none" stroke="${secondary}" stroke-width="16"/>
      <path d="M418 214 V248 M418 368 V402 M324 308 H358 M478 308 H512 M352 242 L378 268 M458 348 L484 374 M352 374 L378 348 M458 268 L484 242" stroke="${secondary}" stroke-width="12" stroke-linecap="round"/>
      <path d="M248 236 L284 272 L340 210" fill="none" stroke="${accent}" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>
    </g>`;
  }
  if (motif === "friends-card") {
    return `<g transform="${transform} translate(638 132)">
      <rect x="56" y="152" width="220" height="246" rx="34" fill="#ffffff" opacity="0.78"/>
      <rect x="250" y="118" width="240" height="268" rx="36" fill="#ffffff" opacity="0.88"/>
      <circle cx="164" cy="230" r="38" fill="${secondary}"/>
      <circle cx="344" cy="218" r="44" fill="${accent}"/>
      <path d="M132 310 H214 M112 344 H226" stroke="#0f172a" stroke-width="14" stroke-linecap="round" opacity="0.52"/>
      <path d="M298 314 H404 M288 350 H430" stroke="#0f172a" stroke-width="16" stroke-linecap="round" opacity="0.58"/>
      <path d="M188 164 C244 120 298 120 352 166" fill="none" stroke="${mix(accent, secondary, 0.4)}" stroke-width="12" stroke-linecap="round" opacity="0.7"/>
    </g>`;
  }
  if (motif === "podium-board") {
    return `<g transform="${transform} translate(646 124)">
      <rect x="60" y="108" width="500" height="168" rx="34" fill="#ffffff" opacity="0.82"/>
      <path d="M114 172 H348 M114 214 H424 M442 150 H500 M442 192 H500" stroke="#0f172a" stroke-width="14" stroke-linecap="round" opacity="0.56"/>
      <rect x="108" y="326" width="108" height="108" rx="24" fill="${mix(secondary, "#ffffff", 0.14)}"/>
      <rect x="232" y="274" width="132" height="160" rx="28" fill="${mix(accent, "#ffffff", 0.08)}"/>
      <rect x="380" y="344" width="108" height="90" rx="24" fill="${mix(secondary, "#ffffff", 0.28)}"/>
      <circle cx="298" cy="248" r="30" fill="${accent}"/>
      <circle cx="160" cy="298" r="24" fill="${secondary}"/>
      <circle cx="434" cy="314" r="24" fill="${secondary}"/>
    </g>`;
  }
  if (motif === "practice-grid") {
    return `<g transform="${transform} translate(638 118)">
      <rect x="52" y="120" width="504" height="300" rx="40" fill="#ffffff" opacity="0.76"/>
      <rect x="90" y="160" width="180" height="98" rx="24" fill="${mix(accent, "#ffffff", 0.1)}"/>
      <rect x="294" y="160" width="224" height="98" rx="24" fill="${mix(secondary, "#ffffff", 0.12)}"/>
      <rect x="90" y="282" width="168" height="98" rx="24" fill="${mix(secondary, "#ffffff", 0.18)}"/>
      <rect x="280" y="282" width="238" height="98" rx="24" fill="${mix(accent, "#ffffff", 0.2)}"/>
      <path d="M126 208 L154 234 L214 176" fill="none" stroke="${accent}" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="368" cy="210" r="40" fill="none" stroke="${secondary}" stroke-width="14"/>
      <circle cx="368" cy="210" r="20" fill="none" stroke="${secondary}" stroke-width="10"/>
      <path d="M402 340 C426 322 454 314 490 312" fill="none" stroke="${accent}" stroke-width="14" stroke-linecap="round"/>
      <circle cx="348" cy="334" r="14" fill="${accent}"/>
    </g>`;
  }
  if (motif === "yardage-rings") {
    return `<g transform="${transform} translate(624 122)">
      <ellipse cx="270" cy="320" rx="210" ry="108" fill="${mix(accent, "#ffffff", 0.18)}"/>
      <ellipse cx="270" cy="320" rx="154" ry="80" fill="${mix(accent, "#ffffff", 0.28)}"/>
      <ellipse cx="270" cy="320" rx="96" ry="52" fill="${mix("#ffffff", accent, 0.22)}"/>
      <circle cx="134" cy="372" r="16" fill="#111827"/>
      <path d="M150 360 C218 286 318 254 462 248" fill="none" stroke="${accent}" stroke-width="16" stroke-linecap="round"/>
      <path d="M144 390 C248 346 368 338 514 352" fill="none" stroke="${secondary}" stroke-width="12" stroke-linecap="round" opacity="0.84"/>
      <rect x="386" y="136" width="138" height="154" rx="28" fill="#ffffff" opacity="0.84"/>
      <path d="M430 174 H480 M430 210 H494 M430 246 H472" stroke="#0f172a" stroke-width="12" stroke-linecap="round" opacity="0.56"/>
    </g>`;
  }
  if (motif === "trend-badges") {
    return `<g transform="${transform} translate(620 128)">
      <path d="M68 394 C146 312 220 286 304 252 C372 224 428 172 520 86" fill="none" stroke="${accent}" stroke-width="18" stroke-linecap="round"/>
      <circle cx="68" cy="394" r="18" fill="${mix(accent, "#ffffff", 0.1)}"/>
      <circle cx="304" cy="252" r="18" fill="${mix(secondary, "#ffffff", 0.08)}"/>
      <circle cx="520" cy="86" r="18" fill="${accent}"/>
      <rect x="58" y="120" width="162" height="92" rx="24" fill="#ffffff" opacity="0.84"/>
      <rect x="246" y="176" width="184" height="98" rx="24" fill="#ffffff" opacity="0.78"/>
      <rect x="404" y="274" width="150" height="90" rx="24" fill="#ffffff" opacity="0.72"/>
      <path d="M98 160 H180 M98 190 H152" stroke="#0f172a" stroke-width="12" stroke-linecap="round" opacity="0.56"/>
      <path d="M286 216 H390 M286 246 H354" stroke="#0f172a" stroke-width="12" stroke-linecap="round" opacity="0.56"/>
      <path d="M440 312 H512 M440 340 H490" stroke="#0f172a" stroke-width="12" stroke-linecap="round" opacity="0.56"/>
    </g>`;
  }
  if (motif === "scoreband") {
    return `<g transform="${transform} translate(638 132)">
      <rect x="50" y="130" width="506" height="290" rx="40" fill="#ffffff" opacity="0.8"/>
      <rect x="86" y="172" width="432" height="60" rx="22" fill="${mix(accent, "#ffffff", 0.12)}"/>
      <path d="M126 202 H422" stroke="#0f172a" stroke-width="14" stroke-linecap="round" opacity="0.54"/>
      <circle cx="466" cy="202" r="20" fill="${secondary}"/>
      <rect x="86" y="252" width="202" height="126" rx="26" fill="${mix(secondary, "#ffffff", 0.12)}"/>
      <rect x="314" y="252" width="204" height="126" rx="26" fill="${mix(accent, "#ffffff", 0.18)}"/>
      <path d="M126 300 H242 M126 334 H208" stroke="#0f172a" stroke-width="12" stroke-linecap="round" opacity="0.52"/>
      <path d="M348 304 C376 276 416 264 466 266" fill="none" stroke="${accent}" stroke-width="14" stroke-linecap="round"/>
      <circle cx="338" cy="314" r="14" fill="${accent}"/>
    </g>`;
  }
  if (motif === "bag-window") {
    return `<g transform="${transform} translate(630 110)">
      <rect x="44" y="94" width="522" height="346" rx="42" fill="#ffffff" opacity="0.8"/>
      <rect x="82" y="132" width="250" height="270" rx="30" fill="${mix(accent, "#ffffff", 0.08)}"/>
      <path d="M186 138 C238 138 282 178 282 238 V326 C282 368 248 402 206 402 H158 C116 402 82 368 82 326 V206 C82 168 112 138 150 138 Z" fill="${mix(accent, "#ffffff", 0.18)}" stroke="${accent}" stroke-width="12"/>
      <path d="M154 182 H208 M154 226 H226 M154 270 H214 M154 314 H202" stroke="#ffffff" stroke-width="10" stroke-linecap="round" opacity="0.34"/>
      <circle cx="408" cy="210" r="74" fill="${mix(secondary, "#ffffff", 0.14)}"/>
      <path d="M408 148 V172 M408 248 V272 M346 210 H370 M446 210 H470 M364 166 L382 184 M434 236 L452 254 M364 254 L382 236 M434 184 L452 166" stroke="${secondary}" stroke-width="12" stroke-linecap="round"/>
      <path d="M344 338 C392 306 446 302 512 314" fill="none" stroke="${accent}" stroke-width="14" stroke-linecap="round"/>
    </g>`;
  }
  return `<g transform="${transform} translate(734 174)"><rect x="42" y="70" width="316" height="230" rx="34" fill="#ffffff" stroke="${accent}" stroke-width="12"/><circle cx="200" cy="184" r="60" fill="${mix(accent, "#ffffff", 0.3)}"/><path d="M112 332 H288" stroke="${secondary}" stroke-width="18" stroke-linecap="round"/></g>`;
}

function mix(a, b, amount) {
  const left = hexToRgb(a);
  const right = hexToRgb(b);
  const value = left.map((part, index) => Math.round(part * (1 - amount) + right[index] * amount));
  return rgbToHex(value);
}

function hexToRgb(hex) {
  const value = hex.replace("#", "");
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ];
}

function rgbToHex(rgb) {
  return `#${rgb.map((part) => part.toString(16).padStart(2, "0")).join("")}`;
}

function hsl(h, s, l) {
  const c = (1 - Math.abs((2 * l) / 100 - 1)) * (s / 100);
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l / 100 - c / 2;
  const [r, g, b] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];
  return rgbToHex([r, g, b].map((part) => Math.round((part + m) * 255)));
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
