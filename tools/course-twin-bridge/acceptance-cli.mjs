#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { captureHardwareAcceptance } from "./acceptance.mjs";

const options = parseArguments(process.argv.slice(2));
process.stdout.write(
  `Physical acceptance started for ${options.expectedDevice}. Pair the browser, select a club/handedness, then hit at least ${options.minimumShots} shots.\n`,
);
const report = await captureHardwareAcceptance(options);
const outputPath = resolve(options.output);
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
process.stdout.write(
  `${report.result.passed ? "PASS" : "FAIL"}: ${outputPath}\n${report.result.checks
    .map(
      (item) =>
        `${item.passed ? "✓" : "✗"} ${item.name}${item.evidence === null ? "" : ` (${item.evidence})`}`,
    )
    .join("\n")}\n`,
);
if (!report.result.passed) process.exitCode = 2;

function parseArguments(argumentsList) {
  const values = Object.fromEntries(
    argumentsList.flatMap((argument, index) =>
      argument.startsWith("--") ? [[argument.slice(2), argumentsList[index + 1]]] : [],
    ),
  );
  const bridgePort = boundedInteger(values.port ?? "9791", 1, 65_535, "port");
  const minimumShots = boundedInteger(values.shots ?? "5", 1, 100, "shots");
  const durationSeconds = boundedInteger(values.duration ?? "300", 10, 1_800, "duration");
  const expectedDevice = (values.device ?? "Rapsodo MLM2PRO").trim().slice(0, 80);
  if (!expectedDevice) throw new Error("--device must not be empty.");
  return {
    bridgePort,
    minimumShots,
    durationMs: durationSeconds * 1_000,
    expectedDevice,
    output: values.output ?? `dist/course-twin-bridge/acceptance-${Date.now()}.json`,
  };
}

function boundedInteger(value, minimum, maximum, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < minimum || number > maximum) {
    throw new Error(`--${label} must be an integer from ${minimum} to ${maximum}.`);
  }
  return number;
}
