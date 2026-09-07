import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({
  exchange: vi.fn(),
  getUser: vi.fn(),
  profile: vi.fn(),
  clear: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock("@/lib/current-user", () => ({ ensureUserProfile: mocks.profile }));
vi.mock("@/lib/supabase/server", () => ({
  clearSupabaseAuthCookies: mocks.clear,
  createSupabaseServerClient: async () => ({
    auth: {
      exchangeCodeForSession: mocks.exchange,
      getUser: mocks.getUser,
      signOut: mocks.signOut,
    },
  }),
}));
import { GET } from "./route";
beforeEach(() => vi.resetAllMocks());
it.each(["missing", "expired"])(
  "preserves the local destination after %s callback code",
  async (mode) => {
    mocks.exchange.mockResolvedValue({ error: { message: "Expired code" } });
    const request = new URL("http://localhost/auth/callback");
    request.searchParams.set("next", "/billing?plan=plus");
    if (mode === "expired") request.searchParams.set("code", "synthetic");
    const response = await GET(new NextRequest(request));
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe("/billing?plan=plus");
    expect(mocks.profile).not.toHaveBeenCalled();
  },
);
it("never preserves an external return destination", async () => {
  const response = await GET(
    new NextRequest("http://localhost/auth/callback?next=https%3A%2F%2Fexample.invalid"),
  );
  const location = new URL(response.headers.get("location")!);
  expect(location.origin).toBe("http://localhost");
  expect(location.searchParams.get("next")).toBeNull();
});
