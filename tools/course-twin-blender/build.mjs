import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
const candidates = [
  process.env.BLENDER_BIN,
  "/Applications/Blender.app/Contents/MacOS/Blender",
  `${process.env.HOME}/Applications/Blender.app/Contents/MacOS/Blender`,
].filter(Boolean);
const fromPath = spawnSync("which", ["blender"], { encoding: "utf8" }).stdout?.trim();
if (fromPath) candidates.push(fromPath);
const blender = candidates.find(existsSync);
if (!blender) throw new Error("Blender not found. Set BLENDER_BIN to its executable.");
const placements = spawnSync(
  process.execPath,
  ["--import", "tsx", "tools/course-twin-blender/placements.ts", ...process.argv.slice(2)],
  { stdio: "inherit" },
);
if (placements.status !== 0) process.exit(placements.status ?? 1);
const result = spawnSync(
  blender,
  [
    "--background",
    "--factory-startup",
    "--disable-autoexec",
    "--python-exit-code",
    "1",
    "--python",
    path.resolve("tools/course-twin-blender/build.py"),
    "--",
    ...process.argv.slice(2),
  ],
  { stdio: "inherit", timeout: 600000 },
);
if (result.error) throw result.error;
process.exit(result.status ?? 1);
