import { readFile } from "node:fs/promises";

const statsPath = `${process.env.NEXT_DIST_DIR ?? ".next"}/diagnostics/route-bundle-stats.json`;
const budgetsPath = "config/route-js-budgets.json";

async function main() {
  const [stats, budgets] = await Promise.all([readJson(statsPath), readJson(budgetsPath)]);
  if (!Array.isArray(stats)) throw new Error(`${statsPath} must contain an array.`);

  const byRoute = new Map(stats.map((entry) => [entry.route, entry]));
  const failures = [];

  for (const [route, budgetBytes] of Object.entries(budgets)) {
    const entry = byRoute.get(route);
    if (!entry) {
      failures.push(`${route}: missing from bundle diagnostics`);
      continue;
    }

    const actualBytes = Number(entry.firstLoadUncompressedJsBytes);
    if (!Number.isFinite(actualBytes)) {
      failures.push(`${route}: invalid first-load JavaScript value`);
      continue;
    }

    const status = actualBytes <= budgetBytes ? "PASS" : "FAIL";
    process.stdout.write(
      `${status} ${route} ${formatKiB(actualBytes)} / ${formatKiB(budgetBytes)} uncompressed\n`,
    );
    if (actualBytes > budgetBytes) {
      failures.push(`${route}: ${formatKiB(actualBytes)} exceeds ${formatKiB(budgetBytes)}`);
    }
  }

  if (failures.length > 0) {
    throw new Error(`Route JavaScript budget failed:\n- ${failures.join("\n- ")}`);
  }
}

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    throw new Error(`Unable to read ${path}. Run a production build first.`, { cause: error });
  }
}

function formatKiB(bytes) {
  return `${Math.round(bytes / 1024)} KiB`;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
