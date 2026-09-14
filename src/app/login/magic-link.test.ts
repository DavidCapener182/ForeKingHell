import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  otp: vi.fn(),
  clear: vi.fn(),
  configured: vi.fn(() => true),
  redirect: vi.fn((url: string) => {
    throw new Error(`redirect:${url}`);
  }),
}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/current-user", () => ({ ensureUserProfile: vi.fn() }));
vi.mock("@/lib/site-origin", () => ({ getSiteOrigin: () => "https://lmworldtour.app" }));
vi.mock("@/lib/supabase/server", () => ({
  isSupabaseAuthConfigured: mocks.configured,
  clearSupabaseAuthCookies: mocks.clear,
  createSupabaseServerClient: async () => ({ auth: { signInWithOtp: mocks.otp } }),
}));
import { sendMagicLinkAction } from "./actions";
const idle = { status: "idle", message: null } as const;
const form = (email: string, next = "/dashboard") => {
  const data = new FormData();
  data.set("email", email);
  data.set("next", next);
  return data;
};

describe("email-link confirmation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.configured.mockReturnValue(true);
  });
  it("rejects invalid input before touching auth or sending email", async () => {
    expect(await sendMagicLinkAction(idle, form("not-an-email"))).toEqual({
      status: "error",
      message: "Enter a valid email address.",
    });
    expect(mocks.clear).not.toHaveBeenCalled();
    expect(mocks.otp).not.toHaveBeenCalled();
  });
  it("shows confirmation only after the provider accepts the request", async () => {
    mocks.otp.mockResolvedValue({ error: null });
    await expect(
      sendMagicLinkAction(idle, form(" Golf@Example.test ", "/welcome?plan=beta")),
    ).rejects.toThrow("redirect:/thank-you?next=%2Fwelcome%3Fplan%3Dbeta");
    expect(mocks.otp).toHaveBeenCalledWith({
      email: "golf@example.test",
      options: {
        shouldCreateUser: true,
        emailRedirectTo: "https://lmworldtour.app/auth/callback?next=%2Fwelcome%3Fplan%3Dbeta",
      },
    });
  });
  it("cannot redirect confirmation or the email callback to another site", async () => {
    mocks.otp.mockResolvedValue({ error: null });
    await expect(
      sendMagicLinkAction(idle, form("golf@example.test", "//evil.example")),
    ).rejects.toThrow("redirect:/thank-you?next=%2Fdashboard");
    expect(mocks.otp.mock.calls[0][0].options.emailRedirectTo).toBe(
      "https://lmworldtour.app/auth/callback?next=%2Fdashboard",
    );
  });
  it("keeps provider and transport errors in the form", async () => {
    mocks.otp.mockResolvedValue({ error: { message: "Too many requests" } });
    expect(await sendMagicLinkAction(idle, form("golf@example.test"))).toEqual({
      status: "error",
      message: "Too many requests",
    });
    mocks.otp.mockRejectedValue(new Error("offline"));
    expect(await sendMagicLinkAction(idle, form("golf@example.test"))).toMatchObject({
      status: "error",
    });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
