import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/components/route-state.tsx"), "utf8");
const notFoundState = source.slice(source.indexOf("export function RouteNotFoundState"));

describe("shared route not-found state", () => {
  it("uses one genuine shadcn Card composition instead of the retired native shell", () => {
    expect(source).toContain(
      'import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"',
    );
    expect(notFoundState).toContain("<Card");
    expect(notFoundState).toContain("<CardHeader");
    expect(notFoundState).toContain("<CardTitle>");
    expect(notFoundState).toContain("<CardDescription");
    expect(notFoundState).toContain("<CardFooter");
    expect(notFoundState).toContain("data-route-not-found-state");
    expect(notFoundState).not.toContain("premium-card");
    expect(notFoundState).not.toContain("ios-grouped-list");
    expect(notFoundState).not.toContain("<section");
  });

  it("preserves the not-found copy and dashboard recovery action", () => {
    expect(notFoundState).toContain("<h1");
    expect(notFoundState).toContain("Page not found");
    expect(notFoundState).toContain("That route does not match an {BRAND_NAME} screen.");
    expect(notFoundState).toContain('<Link href="/dashboard">Open dashboard</Link>');
  });
});
