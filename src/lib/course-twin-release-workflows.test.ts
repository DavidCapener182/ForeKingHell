import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const builder = readFileSync(
  join(process.cwd(), ".github/workflows/course-twin-builder.yml"),
  "utf8",
);
const bridge = readFileSync(
  join(process.cwd(), ".github/workflows/course-twin-bridge-release.yml"),
  "utf8",
);

describe("Course Twin production workflows", () => {
  it("tests and publishes immutable builder containers from main", () => {
    expect(builder).toContain("npm run builder:test");
    expect(builder).toContain("docker/build-push-action@v6");
    expect(builder).toContain("${{ github.sha }}");
    expect(builder).toContain("github.ref == 'refs/heads/main'");
    expect(builder).toContain("${GITHUB_REPOSITORY_OWNER,,}");
    expect(builder).toContain("${{ env.IMAGE_NAME }}:${{ github.sha }}");
  });

  it("fails signed bridge releases through a protected environment on every desktop OS", () => {
    expect(bridge).toContain("environment: course-twin-release");
    expect(bridge).toContain("macos-14");
    expect(bridge).toContain("windows-2025");
    expect(bridge).toContain("ubuntu-24.04");
    expect(bridge).toContain("FKH_RELEASE_MANIFEST_PRIVATE_KEY");
    expect(bridge).toContain("notarytool store-credentials");
    expect(bridge).toContain("Import-PfxCertificate");
    expect(bridge).toContain("npm run bridge:build");
  });
});
