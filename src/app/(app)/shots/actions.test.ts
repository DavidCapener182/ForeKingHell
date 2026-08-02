import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/(app)/shots/actions.ts"), "utf8");

describe("delete shot action", () => {
  it("only deletes a valid shot owned by the current player and refreshes derived views", () => {
    expect(source).toContain("export async function deleteShotAction");
    expect(source).toContain("uuidPattern.test(shotId)");
    expect(source).toContain("requireCurrentUserId()");
    expect(source).toContain(".delete(shots)");
    expect(source).toContain("eq(shots.id, shotId)");
    expect(source).toContain("eq(shots.userId, userId)");
    expect(source).toContain(".returning({ id: shots.id })");
    expect(source).toContain('revalidatePath("/shots")');
    expect(source).toContain('revalidatePath("/today")');
    expect(source).toContain('revalidatePath("/", "layout")');
  });
});
