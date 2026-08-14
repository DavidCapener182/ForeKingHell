import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("Import UploadDropzone loader theme", () => {
  it("uses the shared GolfLoader with semantic ordinary copy", () => {
    const upload = source("src/app/import/upload-dropzone.tsx");
    const loader = source("src/components/visuals/golf-loader.tsx");
    const loaderCopy = loader.match(/<div>\s*<p[\s\S]*?<\/div>/)?.[0] ?? "";

    expect(upload).toContain('import { GolfLoader } from "@/components/visuals/golf-loader"');
    expect(upload).toContain("<GolfLoader");
    expect(upload).toContain('label="Reading launch data"');
    expect(loaderCopy).toContain("text-foreground");
    expect(loaderCopy).toContain("text-muted-foreground");
    expect(loaderCopy).not.toMatch(/text-(?:slate|zinc|neutral|stone)-\d{2,3}/);
    expect(loader).toContain("loader-golfer.png");
    expect(loader).toContain("drop-shadow-");
  });
});
