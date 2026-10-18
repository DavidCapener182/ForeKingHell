import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MobileStartRound } from "./mobile-start-round";
import { NewRoundForm } from "./new-round-form";

const action = async () => ({ error: null });
describe("round setup prerequisites", () => {
  it("provides course setup recovery instead of an unusable mobile form", () => {
    const html = renderToStaticMarkup(
      <MobileStartRound courses={[]} creationId="synthetic" action={action} />,
    );
    expect(html).toContain("Set up your course first");
    expect(html).toContain('href="/courses/new"');
    expect(html).toContain('href="/courses"');
    expect(html).not.toContain('type="submit"');
  });
  it("links course setup from completed-round entry on either surface", () => {
    for (const compact of [true, false]) {
      const html = renderToStaticMarkup(
        <NewRoundForm
          compact={compact}
          instanceId="synthetic"
          courses={[]}
          creationId="synthetic"
          createRoundAction={action}
        />,
      );
      expect(html).toContain('href="/courses/new"');
      expect(html).toContain("hole pars and yardages");
      expect(html).not.toContain('type="submit"');
    }
  });
});
