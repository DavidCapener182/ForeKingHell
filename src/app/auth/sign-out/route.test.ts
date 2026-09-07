import { describe, expect, it, vi } from "vitest";
import { POST } from "./route";
vi.mock("@/lib/supabase/server", () => ({ isSupabaseAuthConfigured: () => false }));
describe("local sign-out response", () => {
  it("expires the provider cookie and redirects to login", async () => {
    const response = await POST(new Request("http://localhost/auth/sign-out", { method: "POST" }));
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost/login");
    const cookie = response.cookies.get("fkh_rapsodo_token");
    expect(cookie?.value).toBe("");
    expect(cookie?.expires).toEqual(new Date(0));
  });
});
