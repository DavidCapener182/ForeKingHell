import { beforeEach, expect, it, vi } from "vitest";
// Minimal deterministic hook lifecycle harness: dependency changes run the previous cleanup.
const runtime = vi.hoisted(() => ({
  slots: [] as unknown[],
  index: 0,
  deps: undefined as unknown[] | undefined,
  cleanup: undefined as (() => void) | undefined,
  effect: undefined as (() => void | (() => void)) | undefined,
  parse: vi.fn(),
}));
vi.mock("react", () => ({
  useState(initial: unknown) {
    const i = runtime.index++;
    if (!(i in runtime.slots)) runtime.slots[i] = initial;
    return [
      runtime.slots[i],
      (value: unknown) => {
        runtime.slots[i] = typeof value === "function" ? value(runtime.slots[i]) : value;
      },
    ];
  },
  useRef(initial: unknown) {
    const i = runtime.index++;
    if (!(i in runtime.slots)) runtime.slots[i] = { current: initial };
    return runtime.slots[i];
  },
  useEffect(effect: () => void | (() => void), deps: unknown[]) {
    if (!runtime.deps || deps.some((value, i) => !Object.is(value, runtime.deps![i]))) {
      runtime.cleanup?.();
      runtime.deps = deps;
      runtime.effect = effect;
    }
  },
}));
vi.mock("@/lib/imports/normalized-import", () => ({ parseLaunchMonitorImportCsv: runtime.parse }));
import { useImportFiles } from "./use-import-files";
import type { RapsodoColumnMapping } from "@/lib/rapsodo/parser";
const mapping = {} as RapsodoColumnMapping;
function render(columns = mapping) {
  runtime.index = 0;
  // Deterministic test harness explicitly controls state/effect lifecycle.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const hook = useImportFiles("yards", columns);
  if (runtime.effect) {
    const effect = runtime.effect;
    runtime.effect = undefined;
    runtime.cleanup = effect() || undefined;
  }
  return hook;
}
async function settle() {
  for (let n = 0; n < 8; n++) await Promise.resolve();
  return render();
}
function file(name: string) {
  return { name, size: 10, lastModified: 1 } as File;
}
beforeEach(() => {
  runtime.cleanup?.();
  runtime.slots = [];
  runtime.index = 0;
  runtime.deps = undefined;
  runtime.cleanup = undefined;
  runtime.effect = undefined;
  runtime.parse.mockReset();
  vi.stubGlobal(
    "FileReader",
    class {
      result = "data";
      onload?: () => void;
      readAsText() {
        this.onload?.();
      }
    },
  );
});
it("retains valid previews with per-file failures and recovers when the failed file is removed", async () => {
  runtime.parse.mockImplementation(async ({ fileName }) => {
    if (fileName === "bad.csv") throw new Error("Missing carry column");
    return { marker: fileName };
  });
  let hook = render();
  await hook.readSelectedFiles([file("good.csv"), file("bad.csv")]);
  render();
  hook = await settle();
  expect(hook.parsedFiles.map((row) => row.fileName)).toEqual(["good.csv"]);
  expect(hook.parseFailures).toEqual([
    { id: "bad.csv-10-1", fileName: "bad.csv", message: "Missing carry column" },
  ]);
  expect(hook.parseError).toBe("bad.csv: Missing carry column");
  expect(hook.isParsing).toBe(false);
  hook.removeFile(hook.uploadedFiles.find((row) => row.fileName === "bad.csv")!.id);
  render();
  hook = await settle();
  expect(hook.parsedFiles).toHaveLength(1);
  expect(hook.parseError).toBeNull();
});
it("reports all failed filenames and retries with corrected mappings", async () => {
  runtime.parse.mockRejectedValue("invalid data");
  let hook = render();
  await hook.readSelectedFiles([file("a.csv"), file("b.csv")]);
  render();
  hook = await settle();
  expect(hook.parseError).toContain("a.csv:");
  expect(hook.parseError).toContain("b.csv:");
  runtime.parse.mockResolvedValue({ marker: "fixed" });
  const corrected = { ...mapping };
  render(corrected);
  // Use the new mapping identity again rather than triggering another parse.
  for (let n = 0; n < 8; n++) await Promise.resolve();
  hook = render(corrected);
  expect(hook.parseError).toBeNull();
  expect(hook.parseFailures).toEqual([]);
  expect(hook.parsedFiles).toHaveLength(2);
});
it.each(["success", "failure"])("ignores an old pending %s after clear", async (outcome) => {
  let resolve!: (value: unknown) => void;
  let reject!: (error: Error) => void;
  runtime.parse.mockImplementation(
    () =>
      new Promise((done, fail) => {
        resolve = done;
        reject = fail;
      }),
  );
  let hook = render();
  await hook.readSelectedFiles([file("slow.csv")]);
  render();
  hook = render();
  expect(hook.isParsing).toBe(true);
  hook.clearFiles();
  render();
  if (outcome === "success") resolve({ marker: "old" });
  else reject(new Error("Stale parse failure"));
  hook = await settle();
  expect(hook.uploadedFiles).toEqual([]);
  expect(hook.parsedFiles).toEqual([]);
  expect(hook.parseError).toBeNull();
  expect(hook.isParsing).toBe(false);
});
