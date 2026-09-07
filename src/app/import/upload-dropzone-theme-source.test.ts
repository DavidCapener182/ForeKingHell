import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("Import UploadDropzone loader theme", () => {
  it("shows named read progress and recoverable file errors with semantic styling", () => {
    const upload = source("src/app/import/upload-dropzone.tsx");
    expect(upload).toContain('role="status"');
    expect(upload).toContain("Reading {readProgress.fileName}");
    expect(upload).toContain("<Progress");
    expect(upload).toContain("aria-label={`Reading ${readProgress.fileName}`}");
    expect(upload).toContain("value={percent(readProgress)}");
    expect(upload).toContain('role="alert"');
    expect(upload).toContain("onRetry?.(error.file)");
    expect(upload).toContain("Retry file");
    expect(upload).toContain("onDismissError?.(error.id)");
    expect(upload).toContain("text-muted-foreground");
    expect(upload).toContain("text-destructive");
    expect(upload).not.toMatch(/text-(?:slate|zinc|neutral|stone)-\d{2,3}/);
  });
});
