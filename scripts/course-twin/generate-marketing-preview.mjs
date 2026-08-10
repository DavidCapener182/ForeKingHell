import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(SCRIPT_DIRECTORY, "../..");
const OUTPUT_DIRECTORY = path.join(REPOSITORY_ROOT, "public/assets/generated");

const OUTPUTS = [
  {
    name: "course-twin-premium-desktop",
    variant: "desktop",
    width: 1600,
    height: 1080,
  },
  {
    name: "course-twin-premium-mobile",
    variant: "mobile",
    width: 900,
    height: 1200,
  },
];

function seededRandom(seed) {
  let state = seed >>> 0;

  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function number(value) {
  return Number(value.toFixed(2));
}

function treeMarkup({ x, y, size, shade, rotation }) {
  const foliage = `treeFoliage${shade}`;
  const canopyShapes = [
    "M-37 4C-43-8-37-21-25-26C-24-40-6-45 5-36C19-42 35-31 32-17C45-10 45 7 34 16C31 31 13 37 1 29C-11 40-29 31-27 18C-37 16-42 10-37 4Z",
    "M-39-5C-38-20-25-31-12-29C-4-43 17-41 23-28C39-28 47-11 37 1C47 13 37 29 24 29C14 41-7 38-12 26C-29 30-42 18-35 6C-44 3-45 0-39-5Z",
    "M-35-13C-26-27-11-31 0-23C13-37 31-27 31-12C45-6 44 13 31 18C29 34 8 40-2 28C-17 38-35 28-32 13C-45 6-45-7-35-13Z",
    "M-42 1C-45-15-30-29-16-26C-8-42 11-42 21-29C36-32 47-17 40-4C53 8 42 27 27 27C18 41-2 39-9 26C-25 34-40 21-34 8C-43 7-48 5-42 1Z",
  ];
  const shape = canopyShapes[shade % canopyShapes.length];
  const scale = size / 40;

  return `
    <g transform="translate(${number(x)} ${number(y)}) rotate(${number(rotation)}) scale(${number(scale)})">
      <path d="${shape}" fill="#061d14" opacity=".3" transform="translate(7 10)" filter="url(#softShadow)"/>
      <path d="${shape}" fill="#102f20" transform="translate(2 4)" opacity=".9"/>
      <path d="${shape}" fill="url(#${foliage})" stroke="#102f20" stroke-width=".8" stroke-opacity=".58"/>
      <path d="M-27-11C-19-23-5-27 4-20M-20 6C-9-3 5-5 18 1M3 19C13 14 22 10 30 4" fill="none" stroke="#c1ca86" stroke-width="2.1" stroke-linecap="round" opacity=".16"/>
      <path d="M-27 16C-15 24 3 27 17 19M15-21C22-16 27-10 28-4" fill="none" stroke="#071f16" stroke-width="3" stroke-linecap="round" opacity=".26"/>
      <g fill="#d0d79a" opacity=".19">
        <ellipse cx="-20" cy="-17" rx="2.2" ry="1.3"/>
        <ellipse cx="-8" cy="-27" rx="1.8" ry="1.1"/>
        <ellipse cx="7" cy="-24" rx="2.4" ry="1.2"/>
        <ellipse cx="17" cy="-12" rx="1.9" ry="1.1"/>
        <ellipse cx="-25" cy="-2" rx="1.7" ry="1"/>
        <ellipse cx="2" cy="-9" rx="1.8" ry="1.1"/>
      </g>
    </g>`;
}

function treeBandMarkup({ seed, count, xMin, xMax, yMin, yMax, sizeMin, sizeMax }) {
  const random = seededRandom(seed);
  const trees = [];

  for (let index = 0; index < count; index += 1) {
    const x = xMin + random() * (xMax - xMin);
    const y = yMin + random() * (yMax - yMin);
    const size = sizeMin + random() * (sizeMax - sizeMin);
    const shade = Math.floor(random() * 4);
    const rotation = -18 + random() * 36;
    trees.push(treeMarkup({ x, y, size, shade, rotation }));
  }

  return trees
    .sort((a, b) => {
      const aY = Number(a.match(/translate\([^ ]+ ([^)]+)/)?.[1] ?? 0);
      const bY = Number(b.match(/translate\([^ ]+ ([^)]+)/)?.[1] ?? 0);
      return aY - bY;
    })
    .join("");
}

function roughTuftsMarkup({ seed, count, width, height, edge = "both" }) {
  const random = seededRandom(seed);
  const tufts = [];

  for (let index = 0; index < count; index += 1) {
    const onLeft = edge === "left" || (edge === "both" && random() > 0.5);
    const x = onLeft ? random() * width * 0.28 : width * (0.72 + random() * 0.28);
    const y = random() * height;
    const length = 5 + random() * 9;
    const opacity = 0.18 + random() * 0.18;
    tufts.push(
      `<path d="M${number(x - 4)} ${number(y + 3)} q4 ${number(-length)} 8 0 M${number(x)} ${number(y + 4)} q2 ${number(-length * 1.18)} 5 -1" fill="none" stroke="#a7bc73" stroke-width="1.4" stroke-linecap="round" opacity="${number(opacity)}"/>`,
    );
  }

  return tufts.join("");
}

function bunkerMarkup(x, y, scale, rotation, shape = 0) {
  const outerPaths = [
    "M-55 -5 C-45 -33 -14 -34 7 -24 C27 -15 54 -19 60 5 C66 31 28 38 7 30 C-17 22 -49 31 -61 10 C-64 4 -61 0 -55 -5Z",
    "M-52 -12 C-31 -34 -10 -16 10 -27 C33 -40 58 -18 53 5 C48 28 17 19 1 35 C-16 52 -51 38 -56 14 C-59 2 -60 -4 -52 -12Z",
    "M-62 1 C-56 -22 -31 -26 -12 -17 C6 -8 21 -38 45 -27 C71 -15 62 13 45 24 C23 38 3 23 -17 35 C-42 49 -69 27 -62 1Z",
  ];
  const innerPaths = [
    "M-45 -4 C-37 -23 -13 -25 5 -17 C24 -9 43 -13 49 5 C53 23 24 28 6 22 C-14 15 -38 23 -49 9 C-52 4 -49 0 -45 -4Z",
    "M-42 -9 C-26 -24 -7 -11 9 -20 C29 -31 46 -14 42 4 C38 20 14 15 1 27 C-13 39 -40 29 -45 11 C-47 3 -48 -3 -42 -9Z",
    "M-50 1 C-46 -16 -25 -19 -10 -12 C6 -5 17 -29 37 -20 C56 -11 50 10 36 18 C18 28 2 17 -14 26 C-34 37 -56 21 -50 1Z",
  ];
  const index = shape % outerPaths.length;

  return `
    <g transform="translate(${x} ${y}) rotate(${rotation}) scale(${scale})">
      <path d="${outerPaths[index]}" fill="#5d5633" opacity=".42" transform="translate(8 10)" filter="url(#softShadow)"/>
      <path d="${outerPaths[index]}" fill="#806f3f"/>
      <path d="${innerPaths[index]}" fill="url(#sandTexture)"/>
      <path d="${innerPaths[index]}" fill="none" stroke="#ead797" stroke-width="3" opacity=".82"/>
      <path d="M-37 -7 C-20 -18 8 -11 32 -18 M-39 2 C-20 -9 7 -3 37 -10 M-34 12 C-13 2 9 9 34 1 M-22 20 C-5 13 13 17 25 12" fill="none" stroke="#806b43" stroke-width="1.15" opacity=".44"/>
      <path d="M-43 -10 C-26 -23 2 -18 30 -23" fill="none" stroke="#fff1bc" stroke-width="2" opacity=".34"/>
    </g>`;
}

function markersMarkup({ teeX, teeY, targetX, targetY, missX, missY, greenX, greenY, mobile }) {
  const dispersionRx = mobile ? 92 : 132;
  const dispersionRy = mobile ? 43 : 58;
  const missRx = mobile ? 88 : 120;
  const missRy = mobile ? 39 : 48;
  const teeRadius = mobile ? 13 : 14;

  return `
    <g aria-hidden="true">
      <ellipse cx="${missX}" cy="${missY}" rx="${missRx}" ry="${missRy}" transform="rotate(${mobile ? 71 : -24} ${missX} ${missY})" fill="url(#missHatch)" stroke="#d88f72" stroke-width="3" stroke-dasharray="8 9" opacity=".72"/>
      <ellipse cx="${targetX}" cy="${targetY}" rx="${dispersionRx}" ry="${dispersionRy}" transform="rotate(${mobile ? 78 : -25} ${targetX} ${targetY})" fill="#f4d66e" fill-opacity=".12" stroke="#f6dda0" stroke-width="3" stroke-dasharray="9 8"/>
      <path d="M${teeX} ${teeY} C${mobile ? teeX - 35 : teeX + 80} ${mobile ? teeY - 215 : teeY - 120} ${mobile ? targetX - 58 : targetX - 195} ${mobile ? targetY + 145 : targetY + 72} ${targetX} ${targetY}" fill="none" stroke="#102d22" stroke-width="11" opacity=".38"/>
      <path d="M${teeX} ${teeY} C${mobile ? teeX - 35 : teeX + 80} ${mobile ? teeY - 215 : teeY - 120} ${mobile ? targetX - 58 : targetX - 195} ${mobile ? targetY + 145 : targetY + 72} ${targetX} ${targetY}" fill="none" stroke="#fae19a" stroke-width="4" stroke-linecap="round" stroke-dasharray="12 11"/>
      <circle cx="${teeX}" cy="${teeY}" r="${teeRadius + 8}" fill="#f8edc7" fill-opacity=".14"/>
      <circle cx="${teeX}" cy="${teeY}" r="${teeRadius}" fill="#fff4cd" stroke="#173a29" stroke-width="4"/>
      <path d="M${teeX - 6} ${teeY - 1}h12 M${teeX} ${teeY - 7}v12" stroke="#173a29" stroke-width="2.5" stroke-linecap="round"/>
      <g transform="translate(${targetX} ${targetY})">
        <circle r="24" fill="#f9e39d" fill-opacity=".2" stroke="#f8e5a7" stroke-width="2"/>
        <circle r="15" fill="#173f2c" stroke="#fff5cf" stroke-width="3"/>
        <path d="M-6 0l4 4 9-10" fill="none" stroke="#fff5cf" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      </g>
      <g transform="translate(${greenX} ${greenY})">
        <ellipse cx="0" cy="8" rx="15" ry="6" fill="#102f22" opacity=".25"/>
        <path d="M0 10V-55" stroke="#fff4d1" stroke-width="4"/>
        <path d="M2 -54l39 12-39 15z" fill="#f4d168" stroke="#fff4d1" stroke-width="2"/>
        <circle cy="10" r="6" fill="#0b291d" stroke="#e9f0d6" stroke-width="2"/>
      </g>
    </g>`;
}

function definitions() {
  return `
    <defs>
      <linearGradient id="terrainBase" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#355d39"/>
        <stop offset=".5" stop-color="#24492f"/>
        <stop offset="1" stop-color="#173925"/>
      </linearGradient>
      <linearGradient id="courseLight" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#fff0b5" stop-opacity=".11"/>
        <stop offset=".46" stop-color="#fff" stop-opacity="0"/>
        <stop offset="1" stop-color="#061b13" stop-opacity=".2"/>
      </linearGradient>
      <linearGradient id="atmosphericDepth" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#d6d8aa" stop-opacity=".09"/>
        <stop offset=".38" stop-color="#d6d8aa" stop-opacity=".015"/>
        <stop offset="1" stop-color="#0a261a" stop-opacity=".09"/>
      </linearGradient>
      <radialGradient id="vignette" cx="48%" cy="42%" r="72%">
        <stop offset="55%" stop-color="#061b13" stop-opacity="0"/>
        <stop offset="100%" stop-color="#061b13" stop-opacity=".3"/>
      </radialGradient>
      <linearGradient id="waterGradient" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#3f7974"/>
        <stop offset=".48" stop-color="#285e60"/>
        <stop offset="1" stop-color="#193f48"/>
      </linearGradient>
      <pattern id="roughTexture" width="28" height="28" patternUnits="userSpaceOnUse">
        <rect width="28" height="28" fill="#294d31"/>
        <path d="M2 25l3-8m3 10l2-10m4 8l4-11m3 13l2-8M1 9l3-7m8 10l2-9m7 10l4-10M7 19l2-6m8 8l3-7" stroke="#7f995f" stroke-width="1" stroke-linecap="round" opacity=".34"/>
        <path d="M5 5l2 4m10-8l1 4m8 11l-2 5M13 25l-1-5" stroke="#173824" stroke-width="1.2" opacity=".36"/>
        <circle cx="9" cy="8" r="1.1" fill="#b2bd79" opacity=".18"/>
        <circle cx="23" cy="22" r="1" fill="#102d1f" opacity=".44"/>
      </pattern>
      <pattern id="intermediateGrass" width="36" height="36" patternUnits="userSpaceOnUse" patternTransform="rotate(-18)">
        <rect width="36" height="36" fill="#466b3d"/>
        <path d="M0 6H36M0 24H36" stroke="#547949" stroke-width="9" opacity=".5"/>
        <path d="M4 7l2-6m5 13l2-7m7 10l2-7m6 18l2-8M9 32l2-7m13 9l2-6" stroke="#a5b979" stroke-width="1" opacity=".42"/>
        <path d="M7 4l1 4m10 16l2 4m11-20l1 4" stroke="#284d30" stroke-width="1" opacity=".42"/>
      </pattern>
      <pattern id="fairwayGrass" width="72" height="72" patternUnits="userSpaceOnUse" patternTransform="rotate(-17)">
        <rect width="72" height="72" fill="#719455"/>
        <rect width="36" height="72" fill="#7da060" opacity=".57"/>
        <path d="M4 11l1-6m8 21l1-7m9 15l1-6m9 20l1-7m9 14l1-6m10 17l1-7m8-42l1-6M5 62l1-6M28 7l1-5M48 29l1-6" stroke="#d2d69b" stroke-width="1" stroke-linecap="round" opacity=".39"/>
        <path d="M9 4l2 6m9 9l2 6m10-12l2 5m7 23l2 6m11-12l2 6m8 18l2 6M15 51l2 5" stroke="#3f693e" stroke-width="1.15" opacity=".34"/>
        <path d="M0 36H72" stroke="#e0dfa8" stroke-width=".8" opacity=".08"/>
      </pattern>
      <pattern id="greenTexture" width="22" height="22" patternUnits="userSpaceOnUse" patternTransform="rotate(-12)">
        <rect width="22" height="22" fill="#8aaa62"/>
        <path d="M0 5H22M0 16H22" stroke="#a8bf77" stroke-width="5" opacity=".28"/>
        <circle cx="5" cy="11" r=".8" fill="#d1d994" opacity=".55"/>
        <circle cx="17" cy="3" r=".7" fill="#4d7c43" opacity=".45"/>
      </pattern>
      <pattern id="sandTexture" width="28" height="28" patternUnits="userSpaceOnUse">
        <rect width="28" height="28" fill="#cfb87a"/>
        <circle cx="5" cy="7" r="1.2" fill="#8f7949" opacity=".33"/>
        <circle cx="18" cy="4" r=".8" fill="#f6e7b2" opacity=".72"/>
        <circle cx="23" cy="20" r="1.3" fill="#9a8250" opacity=".35"/>
        <path d="M3 21q7-5 14 0" fill="none" stroke="#f4df9e" stroke-width="1" opacity=".55"/>
      </pattern>
      <pattern id="pathTexture" width="32" height="32" patternUnits="userSpaceOnUse">
        <rect width="32" height="32" fill="#987f61"/>
        <path d="M3 6l6 2m8 13l7 2M7 27l4-1m11-18l5-2" stroke="#d0b78e" stroke-width="2" stroke-linecap="round" opacity=".4"/>
        <circle cx="15" cy="8" r="1.3" fill="#624f3e" opacity=".35"/>
      </pattern>
      <pattern id="waterRipples" width="76" height="38" patternUnits="userSpaceOnUse">
        <path d="M-9 15Q10 3 28 15T66 15T104 15" fill="none" stroke="#a1c0b4" stroke-width="2" opacity=".22"/>
        <path d="M7 30Q21 22 36 30T66 30" fill="none" stroke="#e2dba9" stroke-width="1.4" opacity=".14"/>
      </pattern>
      <pattern id="missHatch" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(26)">
        <rect width="14" height="14" fill="#9d4f3a" opacity=".13"/>
        <path d="M0 0V14" stroke="#efb39a" stroke-width="3" opacity=".34"/>
      </pattern>
      <pattern id="treeFoliage0" width="18" height="18" patternUnits="userSpaceOnUse">
        <rect width="18" height="18" fill="#315b36"/>
        <path d="M-3 4Q2-1 7 4T17 4M2 15q4-6 8 0t8 0" fill="none" stroke="#537445" stroke-width="4" opacity=".62"/>
        <circle cx="5" cy="6" r="1.4" fill="#82915b" opacity=".58"/>
        <circle cx="14" cy="12" r="1.6" fill="#173b27" opacity=".72"/>
      </pattern>
      <pattern id="treeFoliage1" width="19" height="19" patternUnits="userSpaceOnUse">
        <rect width="19" height="19" fill="#3b6239"/>
        <path d="M-4 5Q2-2 8 5T20 5M1 16q5-7 10 0t10 0" fill="none" stroke="#66804c" stroke-width="4" opacity=".6"/>
        <circle cx="5" cy="6" r="1.4" fill="#99a269" opacity=".55"/>
        <circle cx="15" cy="13" r="1.7" fill="#1b4029" opacity=".76"/>
      </pattern>
      <pattern id="treeFoliage2" width="17" height="17" patternUnits="userSpaceOnUse">
        <rect width="17" height="17" fill="#294f31"/>
        <path d="M-3 4Q2-1 7 4T17 4M1 14q4-6 9 0t9 0" fill="none" stroke="#45693d" stroke-width="4" opacity=".66"/>
        <circle cx="4" cy="6" r="1.3" fill="#788b55" opacity=".52"/>
        <circle cx="13" cy="12" r="1.6" fill="#123524" opacity=".78"/>
      </pattern>
      <pattern id="treeFoliage3" width="20" height="20" patternUnits="userSpaceOnUse">
        <rect width="20" height="20" fill="#45653b"/>
        <path d="M-4 5Q2-2 9 5T22 5M1 17q5-7 11 0t11 0" fill="none" stroke="#718151" stroke-width="4" opacity=".62"/>
        <circle cx="6" cy="7" r="1.5" fill="#a7aa70" opacity=".53"/>
        <circle cx="16" cy="14" r="1.8" fill="#24452d" opacity=".76"/>
      </pattern>
      <filter id="softShadow" x="-60%" y="-60%" width="240%" height="240%">
        <feGaussianBlur stdDeviation="7"/>
      </filter>
      <filter id="courseShadow" x="-25%" y="-25%" width="150%" height="150%">
        <feGaussianBlur stdDeviation="14"/>
      </filter>
      <filter id="naturalEdge" x="-12%" y="-12%" width="124%" height="124%">
        <feTurbulence type="fractalNoise" baseFrequency=".012 .045" numOctaves="2" seed="41" result="edgeNoise"/>
        <feDisplacementMap in="SourceGraphic" in2="edgeNoise" scale="7" xChannelSelector="R" yChannelSelector="B"/>
      </filter>
    </defs>`;
}

function desktopScene() {
  const width = 1600;
  const height = 1080;
  const centerline = "M300 986 C438 900 430 755 604 660 C792 556 790 382 1057 230";

  return `
    <rect width="${width}" height="${height}" fill="url(#terrainBase)"/>
    <rect width="${width}" height="${height}" fill="url(#roughTexture)" opacity=".88"/>
    <path d="M-40 840C205 744 315 803 462 722S694 506 829 462 1028 390 1150 233 1366 49 1650 83" fill="none" stroke="#a9c17b" stroke-width="3" opacity=".12"/>
    <path d="M-80 915C143 834 315 888 488 783S738 568 870 530 1064 439 1192 282 1400 125 1640 151" fill="none" stroke="#061e15" stroke-width="7" opacity=".15"/>
    <path d="M1115 1120 C1192 995 1175 896 1250 814 C1323 735 1193 652 1244 566 C1308 456 1198 357 1310 250 C1390 175 1438 91 1474 -40 L1660 -40 L1660 1120Z" fill="#132f25" opacity=".5" filter="url(#courseShadow)"/>
    <path d="M1180 1120 C1249 997 1226 899 1294 814 C1362 729 1237 649 1290 556 C1349 452 1249 354 1354 245 C1422 174 1470 87 1518 -40 L1660 -40 L1660 1120Z" fill="url(#waterGradient)" stroke="#759581" stroke-width="7"/>
    <path d="M1180 1120 C1249 997 1226 899 1294 814 C1362 729 1237 649 1290 556 C1349 452 1249 354 1354 245 C1422 174 1470 87 1518 -40 L1660 -40 L1660 1120Z" fill="url(#waterRipples)" opacity=".95"/>
    <path d="M190 1112 C223 930 251 792 360 675 C458 569 489 422 648 302 C741 232 776 140 830 -20" fill="none" stroke="#172b1e" stroke-width="42" opacity=".34" filter="url(#softShadow)"/>
    <path d="M180 1105 C215 927 243 785 350 668 C447 562 477 414 637 293 C728 225 765 133 820 -20" fill="none" stroke="url(#pathTexture)" stroke-width="25" stroke-linecap="round"/>
    <path d="${centerline}" fill="none" stroke="#152e20" stroke-width="340" stroke-linecap="round" opacity=".34" filter="url(#courseShadow)"/>
    <path d="${centerline}" fill="none" stroke="url(#intermediateGrass)" stroke-width="330" stroke-linecap="round" filter="url(#naturalEdge)"/>
    <path d="${centerline}" fill="none" stroke="#759858" stroke-width="257" stroke-linecap="round" opacity=".34"/>
    <path d="${centerline}" fill="none" stroke="url(#fairwayGrass)" stroke-width="238" stroke-linecap="round"/>
    <path d="${centerline}" fill="none" stroke="#d1d797" stroke-width="3" stroke-linecap="round" opacity=".18"/>
    <ellipse cx="294" cy="989" rx="91" ry="57" transform="rotate(-9 294 989)" fill="url(#greenTexture)" stroke="#b7c982" stroke-width="12"/>
    <ellipse cx="1064" cy="221" rx="140" ry="90" transform="rotate(-12 1064 221)" fill="#567a43" stroke="#385f38" stroke-width="24"/>
    <ellipse cx="1064" cy="221" rx="111" ry="67" transform="rotate(-12 1064 221)" fill="url(#greenTexture)" stroke="#a7bf76" stroke-width="5"/>
    ${bunkerMarkup(863, 545, 1.04, -29, 0)}
    ${bunkerMarkup(929, 245, 0.78, -12, 1)}
    ${bunkerMarkup(1189, 287, 0.96, 18, 2)}
    ${bunkerMarkup(632, 722, 0.72, 24, 1)}
    <g opacity=".7">
      <path d="M1205 942q20-30 39 0M1222 915q19-33 38 0M1272 753q19-33 38 0M1256 734q18-30 35 0M1308 485q21-33 40 0" fill="none" stroke="#a8a56c" stroke-width="7" stroke-linecap="round"/>
      <path d="M1206 945v-27m18 23v-31m48-153v-29m-16 12v-28m52-223v-30" stroke="#5f714a" stroke-width="3"/>
    </g>
    <g opacity=".38" filter="url(#softShadow)">
      <ellipse cx="160" cy="584" rx="155" ry="275" fill="#071f16"/>
      <ellipse cx="1472" cy="605" rx="142" ry="390" fill="#071f16"/>
      <ellipse cx="991" cy="82" rx="250" ry="94" fill="#071f16"/>
    </g>
    ${treeBandMarkup({ seed: 401, count: 56, xMin: -25, xMax: 250, yMin: 5, yMax: 1070, sizeMin: 31, sizeMax: 63 })}
    ${treeBandMarkup({ seed: 919, count: 49, xMin: 1370, xMax: 1635, yMin: -20, yMax: 1080, sizeMin: 30, sizeMax: 61 })}
    ${treeBandMarkup({ seed: 127, count: 25, xMin: 720, xMax: 1270, yMin: -25, yMax: 105, sizeMin: 28, sizeMax: 53 })}
    ${treeBandMarkup({ seed: 711, count: 10, xMin: 1030, xMax: 1210, yMin: 560, yMax: 975, sizeMin: 27, sizeMax: 45 })}
    ${roughTuftsMarkup({ seed: 602, count: 95, width, height })}
    <rect width="${width}" height="${height}" fill="url(#courseLight)" pointer-events="none"/>
    <rect width="${width}" height="${height}" fill="url(#atmosphericDepth)" pointer-events="none"/>
    <rect width="${width}" height="${height}" fill="url(#vignette)" pointer-events="none"/>
    ${markersMarkup({ teeX: 294, teeY: 989, targetX: 792, targetY: 551, missX: 1010, missY: 594, greenX: 1068, greenY: 220, mobile: false })}
  `;
}

function mobileScene() {
  const width = 900;
  const height = 1200;
  const centerline =
    "M446 1104 C341 997 382 854 469 754 C566 642 424 515 514 371 C581 263 587 190 522 125";

  return `
    <rect width="${width}" height="${height}" fill="url(#terrainBase)"/>
    <rect width="${width}" height="${height}" fill="url(#roughTexture)" opacity=".9"/>
    <path d="M-50 1000C142 901 190 835 253 686S351 469 313 304 366 48 484-46" fill="none" stroke="#b2c77c" stroke-width="3" opacity=".12"/>
    <path d="M951 1115C810 1030 787 914 807 808S759 626 808 514 784 298 711 173 692 25 744-70" fill="none" stroke="#071f16" stroke-width="8" opacity=".17"/>
    <path d="M727 1240 C675 1113 745 1014 713 916 C678 811 782 731 745 631 C709 536 804 459 770 353 C742 265 781 151 858 -30 L955 -30 L955 1240Z" fill="#102b22" opacity=".48" filter="url(#courseShadow)"/>
    <path d="M770 1240 C717 1114 790 1018 758 916 C726 815 826 731 790 631 C756 538 849 458 816 350 C788 260 829 142 899 -30 L955 -30 L955 1240Z" fill="url(#waterGradient)" stroke="#6f9380" stroke-width="7"/>
    <path d="M770 1240 C717 1114 790 1018 758 916 C726 815 826 731 790 631 C756 538 849 458 816 350 C788 260 829 142 899 -30 L955 -30 L955 1240Z" fill="url(#waterRipples)"/>
    <path d="M104 1230 C96 1068 124 946 199 824 C263 719 235 579 294 471 C354 360 327 220 411 -22" fill="none" stroke="#10281b" stroke-width="41" opacity=".38" filter="url(#softShadow)"/>
    <path d="M95 1228 C87 1067 116 941 190 817 C253 712 226 574 285 466 C344 356 317 215 401 -22" fill="none" stroke="url(#pathTexture)" stroke-width="24" stroke-linecap="round"/>
    <path d="${centerline}" fill="none" stroke="#142e20" stroke-width="296" stroke-linecap="round" opacity=".36" filter="url(#courseShadow)"/>
    <path d="${centerline}" fill="none" stroke="url(#intermediateGrass)" stroke-width="282" stroke-linecap="round" filter="url(#naturalEdge)"/>
    <path d="${centerline}" fill="none" stroke="#759758" stroke-width="221" stroke-linecap="round" opacity=".35"/>
    <path d="${centerline}" fill="none" stroke="url(#fairwayGrass)" stroke-width="205" stroke-linecap="round"/>
    <path d="${centerline}" fill="none" stroke="#d6dc9b" stroke-width="3" stroke-linecap="round" opacity=".18"/>
    <ellipse cx="445" cy="1108" rx="82" ry="55" transform="rotate(7 445 1108)" fill="url(#greenTexture)" stroke="#b7c881" stroke-width="12"/>
    <ellipse cx="521" cy="123" rx="121" ry="79" transform="rotate(5 521 123)" fill="#567a43" stroke="#365d37" stroke-width="22"/>
    <ellipse cx="521" cy="123" rx="95" ry="60" transform="rotate(5 521 123)" fill="url(#greenTexture)" stroke="#a8c078" stroke-width="5"/>
    ${bunkerMarkup(604, 693, 0.84, 66, 0)}
    ${bunkerMarkup(383, 194, 0.78, -6, 1)}
    ${bunkerMarkup(647, 151, 0.85, 18, 2)}
    ${bunkerMarkup(335, 853, 0.62, -10, 1)}
    <g opacity=".72">
      <path d="M770 1011q18-31 36 0M784 984q18-31 36 0M780 564q18-31 36 0M796 540q18-31 36 0" fill="none" stroke="#aaa66d" stroke-width="7" stroke-linecap="round"/>
      <path d="M770 1015v-30m14 3v-30m-4-389v-30m16 6v-30" stroke="#607049" stroke-width="3"/>
    </g>
    <g opacity=".4" filter="url(#softShadow)">
      <ellipse cx="53" cy="606" rx="140" ry="465" fill="#071f16"/>
      <ellipse cx="862" cy="650" rx="115" ry="430" fill="#071f16"/>
      <ellipse cx="523" cy="10" rx="250" ry="80" fill="#071f16"/>
    </g>
    ${treeBandMarkup({ seed: 151, count: 54, xMin: -35, xMax: 135, yMin: -10, yMax: 1200, sizeMin: 30, sizeMax: 57 })}
    ${treeBandMarkup({ seed: 887, count: 43, xMin: 795, xMax: 940, yMin: -20, yMax: 1200, sizeMin: 29, sizeMax: 56 })}
    ${treeBandMarkup({ seed: 311, count: 19, xMin: 235, xMax: 730, yMin: -35, yMax: 45, sizeMin: 27, sizeMax: 51 })}
    ${treeBandMarkup({ seed: 766, count: 11, xMin: 680, xMax: 795, yMin: 335, yMax: 923, sizeMin: 26, sizeMax: 41 })}
    ${roughTuftsMarkup({ seed: 305, count: 78, width, height })}
    <rect width="${width}" height="${height}" fill="url(#courseLight)" pointer-events="none"/>
    <rect width="${width}" height="${height}" fill="url(#atmosphericDepth)" pointer-events="none"/>
    <rect width="${width}" height="${height}" fill="url(#vignette)" pointer-events="none"/>
    ${markersMarkup({ teeX: 445, teeY: 1108, targetX: 483, targetY: 626, missX: 650, missY: 632, greenX: 522, greenY: 122, mobile: true })}
  `;
}

function createSvg(variant, width, height) {
  const scene = variant === "desktop" ? desktopScene() : mobileScene();

  return Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Premium mapped golf hole preview">
      ${definitions()}
      ${scene}
    </svg>`);
}

async function generateOutput({ name, variant, width, height }) {
  const source = createSvg(variant, width, height);
  const commonPipeline = sharp(source, { density: 144 })
    .resize(width, height, { fit: "fill" })
    .removeAlpha();

  await Promise.all([
    commonPipeline
      .clone()
      .avif({ quality: 72, effort: 7, chromaSubsampling: "4:2:0" })
      .toFile(path.join(OUTPUT_DIRECTORY, `${name}.avif`)),
    commonPipeline
      .clone()
      .webp({ quality: 78, effort: 6, smartSubsample: true })
      .toFile(path.join(OUTPUT_DIRECTORY, `${name}.webp`)),
  ]);
}

await mkdir(OUTPUT_DIRECTORY, { recursive: true });
await Promise.all(OUTPUTS.map(generateOutput));

console.log(`Generated ${OUTPUTS.length * 2} Course Twin marketing preview assets.`);
