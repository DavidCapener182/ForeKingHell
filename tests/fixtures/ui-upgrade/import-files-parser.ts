import { parseLaunchMonitorImportCsv as actualParser } from "../../../src/lib/imports/normalized-import";
export async function parseLaunchMonitorImportCsv(input: Parameters<typeof actualParser>[0]) {
  if (input.fileName === "broken.csv") throw new Error("Synthetic parser failure for this file");
  return actualParser(input);
}
