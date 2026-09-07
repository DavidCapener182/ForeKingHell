import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

const root = process.cwd();
const require = createRequire(import.meta.url);
const cache = new Map();
// Read the actual navigation/capability functions without loading the application or database.
function loadMetadata(file) {
  if (cache.has(file)) return cache.get(file);
  const compiled = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const localRequire = (id) =>
    id.startsWith("@/") ? loadMetadata(path.join(root, "src", `${id.slice(2)}.ts`)) : require(id);
  new Function("require", "module", "exports", source)(localRequire, compiled, compiled.exports);
  cache.set(file, compiled.exports);
  return compiled.exports;
}
const { findRouteMetadata, mobileBackNavigation } = loadMetadata(
  path.join(root, "src/components/app/route-metadata.ts"),
);
function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(file) : [file];
  });
}
const files = walk("src/app");
const out = "docs/redesign/route-ledger.json";
const previous = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, "utf8")) : [];
const jobs = {
  today: "Understand the latest result and choose the next useful action",
  dashboard: "Review the broader performance picture and longer-term priorities",
  sessions: "Find and review actual activities and their evidence",
  analyse: "Investigate a specific performance question",
  "simulator-lab": "Assess launch-monitor performance in depth",
  coach: "Turn supported interpretation into a practice prescription",
  "data-chat": "Ask questions about selected evidence and its limitations",
  practice: "Plan, perform, recover and review measured practice",
  progress: "Check whether comparable evidence shows improvement",
  bag: "Find trusted club numbers, gaps and supporting evidence",
  "quick-bag": "Choose a club for the target distance",
  "play-companion": "Prepare, start or resume a round",
  speed: "Connect training speed to repeatable playing performance",
  goals: "Connect a target to comparable evidence and next practice",
  import: "Import evidence once and continue to the correct result",
};
const ledger = files
  .filter((file) => /\/page\.[jt]sx?$/.test(file))
  .sort()
  .map((file) => {
    const route =
      "/" +
      path
        .dirname(file)
        .split("/")
        .slice(2)
        .filter((part) => !part.startsWith("("))
        .join("/");
    const canonical =
      route === "/companion-runtime/import/csv"
        ? "/import?source=csv"
        : route.replace(/^\/companion-runtime/, "");
    const metadata = findRouteMetadata(canonical.split("?")[0]);
    const source = fs.readFileSync(file, "utf8");
    const adjacentSources = fs
      .readdirSync(path.dirname(file))
      .filter((name) => /(?:companion|workbench)-page\.tsx$/.test(name))
      .map((name) => path.join(path.dirname(file), name));
    const combined = [source, ...adjacentSources.map((name) => fs.readFileSync(name, "utf8"))].join(
      "\n",
    );
    const imports = [...combined.matchAll(/from\s+["'](@\/[^"']+)["']/g)].map((m) => m[1]);
    const links = [...combined.matchAll(/href=["']([^"']+)["']/g)].map((m) => m[1]);
    const parameters = [...combined.matchAll(/(?:searchParams|params)\.([A-Za-z][\w]*)/g)].map(
      (m) => m[1],
    );
    const siblingStates = files.filter(
      (name) =>
        path.dirname(name) === path.dirname(file) && /\/(loading|error|not-found)\.tsx$/.test(name),
    );
    const isPublic = !file.includes("(app)") && !file.includes("(admin)");
    const prior = previous.find((item) => item.source === file);
    return {
      route,
      canonicalRoute: canonical,
      source: file,
      adjacentSources,
      family:
        metadata?.id ??
        (route.startsWith("/share") ? "public-sharing" : isPublic ? "public" : "internal"),
      user:
        file.includes("(admin)") || metadata?.adminOnly
          ? "Administrator"
          : isPublic
            ? "Visitor or shared-link recipient"
            : "Signed-in golfer; record ownership required",
      primaryJob:
        jobs[metadata?.id] ??
        `${metadata?.pageTitle ?? route}: inspect route-specific task and handoff`,
      desktop: "Full-width workbench; route-specific review pending",
      mobile: metadata?.mobileExperience ?? "Route-specific responsive review pending",
      mobileFallback: metadata?.mobileFallbackRoute ?? null,
      entryPoints: {
        navigation: metadata?.shortTitle ?? null,
        back: mobileBackNavigation(canonical.split("?")[0]),
      },
      nextActionsInSource: [...new Set(links)],
      modesAndParameters: [...new Set(parameters)],
      meaningfulSubroutes: [],
      dataDependencies: [
        ...new Set(imports.filter((id) => id.startsWith("@/lib/") || id.startsWith("@/db/"))),
      ],
      permissionEvidence: imports.filter((id) =>
        /current-user|entitlement|admin|sharing|privacy|access/.test(id),
      ),
      recoveryFiles: siblingStates,
      implementation: prior?.implementation ?? "pending",
      findings: prior?.findings ?? [],
      proposedImprovements: prior?.proposedImprovements ?? [],
      preservedDesign: prior?.preservedDesign ?? null,
      verification: prior?.verification ?? {
        functional: [],
        desktop: [],
        mobile: [],
        empty: [],
        loading: [],
        error: [],
      },
      blockers: prior?.blockers ?? [
        "Runtime, populated/empty/error states and permissions not yet verified",
      ],
    };
  });
for (const row of ledger)
  row.meaningfulSubroutes = ledger
    .filter((candidate) => candidate.route.startsWith(`${row.route}/`) && row.route !== "/")
    .map((candidate) => candidate.route);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(ledger, null, 2) + "\n");
const table = ledger
  .map(
    (row) =>
      `| ${row.route} | ${row.family} | ${row.mobile} | ${row.implementation} | ${row.verification.desktop.length}/${row.verification.mobile.length} |`,
  )
  .join("\n");
fs.writeFileSync(
  "docs/redesign/ROUTE_COVERAGE.md",
  `# Route coverage ledger\n\n${ledger.length} current page files. Generated from the filesystem and active route metadata; internal companion runtime aliases retain their canonical destination. Source extraction is inventory evidence only. No runtime or visual pass is inferred. Detailed jobs, subroutes, source dependencies, permissions, findings, proposed improvements, state evidence and blockers are in [route-ledger.json](route-ledger.json).\n\nRegenerate with \`node scripts/generate-redesign-ledger.mjs\`; recorded implementation and verification fields are preserved.\n\n| Route | Family | Mobile capability | Implementation | Desktop/mobile evidence entries |\n| --- | --- | --- | --- | --- |\n${table}\n`,
);
console.log(
  `${ledger.length} page routes inventoried; ${ledger.filter((r) => r.route !== r.canonicalRoute).length} internal runtime aliases.`,
);
