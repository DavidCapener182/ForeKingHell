import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  service: vi.fn(),
  route: vi.fn(),
  revalidate: vi.fn(),
  rethrow: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(), unstable_rethrow: mocks.rethrow }));
vi.mock("@/lib/admin", () => ({
  grantAdminAccessByEmail: (...args: unknown[]) => {
    mocks.route("grantAdminAccessByEmail");
    return mocks.service(...args);
  },
  grantLifetimeFullAccessByEmail: (...args: unknown[]) => {
    mocks.route("grantLifetimeFullAccessByEmail");
    return mocks.service(...args);
  },
  deactivateAdminAccess: (...args: unknown[]) => {
    mocks.route("deactivateAdminAccess");
    return mocks.service(...args);
  },
  resolveSocialReport: (...args: unknown[]) => {
    mocks.route("resolveSocialReport");
    return mocks.service(...args);
  },
  resolveModerationEvent: (...args: unknown[]) => {
    mocks.route("resolveModerationEvent");
    return mocks.service(...args);
  },
  bulkResolveSocialReports: (...args: unknown[]) => {
    mocks.route("bulkResolveSocialReports");
    return mocks.service(...args);
  },
  bulkResolveModerationEvents: (...args: unknown[]) => {
    mocks.route("bulkResolveModerationEvents");
    return mocks.service(...args);
  },
}));
import { adminFormAction } from "./actions";
const form = (fields: Record<string, string | string[]>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields))
    for (const item of Array.isArray(value) ? value : [value]) data.append(key, item);
  return data;
};
beforeEach(() => vi.resetAllMocks());
it.each([
  [
    { operation: "grant-admin", email: "test@example.invalid", role: "operator" },
    ["test@example.invalid", "operator", undefined],
  ],
  [
    { operation: "grant-lifetime", email: "test@example.invalid" },
    ["test@example.invalid", undefined],
  ],
  [{ operation: "deactivate-admin", userId: "target" }, ["target"]],
  [{ operation: "resolve-report", reportId: "report" }, ["report"]],
  [{ operation: "resolve-event", eventId: "event" }, ["event"]],
  [{ operation: "bulk-resolve-reports", reportId: ["one", "two"] }, [["one", "two"]]],
  [{ operation: "bulk-resolve-events", eventId: ["one", "two"] }, [["one", "two"]]],
] as const)("preserves submitted fields %#", async (fields, args) => {
  mocks.service.mockResolvedValue(2);
  const result = await adminFormAction(
    { ok: false },
    form(fields as Record<string, string | string[]>),
  );
  expect(result.ok).toBe(true);
  expect(mocks.service).toHaveBeenCalledWith(...args);
  const routes: Record<string, string> = {
    "grant-admin": "grantAdminAccessByEmail",
    "grant-lifetime": "grantLifetimeFullAccessByEmail",
    "deactivate-admin": "deactivateAdminAccess",
    "resolve-report": "resolveSocialReport",
    "resolve-event": "resolveModerationEvent",
    "bulk-resolve-reports": "bulkResolveSocialReports",
    "bulk-resolve-events": "bulkResolveModerationEvents",
  };
  expect(mocks.route).toHaveBeenCalledExactlyOnceWith(routes[fields.operation]);
});
it("does not announce success or refresh on persistence failure", async () => {
  mocks.service.mockRejectedValue(new Error("Audit unavailable"));
  expect(
    await adminFormAction(
      { ok: true, message: "old" },
      form({ operation: "resolve-event", eventId: "event" }),
    ),
  ).toEqual({ ok: false, error: "The admin action could not be completed. Try again." });
  expect(mocks.revalidate).not.toHaveBeenCalled();
});
it("rejects invalid roles without calling the service", async () => {
  expect(
    (
      await adminFormAction(
        { ok: false },
        form({ operation: "grant-admin", email: "test@example.invalid", role: "invalid" }),
      )
    ).ok,
  ).toBe(false);
  expect(mocks.service).not.toHaveBeenCalled();
});
it("preserves framework control flow", async () => {
  const redirect = new Error("redirect");
  mocks.service.mockRejectedValue(redirect);
  mocks.rethrow.mockImplementation(() => {
    throw redirect;
  });
  await expect(
    adminFormAction({ ok: false }, form({ operation: "resolve-event", eventId: "event" })),
  ).rejects.toBe(redirect);
});

it("retains an actionable permission error", async () => {
  mocks.service.mockRejectedValue(new Error("Owner access is required."));
  expect(
    await adminFormAction({ ok: false }, form({ operation: "deactivate-admin", userId: "target" })),
  ).toEqual({ ok: false, error: "Owner access is required." });
});

it("waits for persistence before publishing success", async () => {
  let finish!: () => void;
  mocks.service.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  let settled = false;
  const pending = adminFormAction(
    { ok: false },
    form({ operation: "resolve-event", eventId: "event" }),
  ).then((result) => {
    settled = true;
    return result;
  });
  await Promise.resolve();
  expect(settled).toBe(false);
  expect(mocks.revalidate).not.toHaveBeenCalled();
  finish();
  expect((await pending).ok).toBe(true);
});
