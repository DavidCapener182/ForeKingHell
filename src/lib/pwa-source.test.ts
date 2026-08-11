import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("installed app claims", () => {
  it("starts in the personal review loop and does not claim private screens are cached", () => {
    const manifest = readFileSync(resolve(process.cwd(), "src/app/manifest.ts"), "utf8");
    const register = readFileSync(
      resolve(process.cwd(), "src/components/pwa-register.tsx"),
      "utf8",
    );

    expect(manifest).toContain('start_url: "/surface/companion?next=%2Ftoday"');
    expect(manifest).toContain('name: "Plan practice"');
    expect(manifest).toContain('name: "Course strategy"');
    expect(manifest).toContain('name: "Latest session"');
    expect(manifest).toContain('name: "Import data"');
    expect(register).toContain("Private analysis needs a connection");
    expect(register).not.toContain("Previously loaded screens remain available");
    expect(register).toContain("retained for a safe retry");
    expect(register).toContain("needsReview > 0");
    expect(register).toContain("review in Settings");
    expect(register).toContain('pathname.startsWith("/play/")');
    expect(register).not.toContain("Offline import sync finished.");
  });

  it("does not cache redirected or private login responses", () => {
    const worker = readFileSync(resolve(process.cwd(), "public/sw.js"), "utf8");
    expect(worker).toContain("!response.redirected");
    expect(worker).toContain("responseUrl.pathname === url.pathname");
    expect(worker).toContain('!cacheControl.includes("private")');
    expect(worker).toContain('!cacheControl.includes("no-store")');
  });
});
