import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import postgres from "postgres";
import { closeDb } from "@/db/client";
import { createCheckoutSession, createCustomerPortalSession } from "@/lib/billing";
const actor = vi.hoisted(() => ({ id: "" }));
vi.mock("@/lib/current-user", () => ({ requireCurrentUserId: async () => actor.id }));
const enabled = process.env.RUN_REDESIGN_DB_TESTS === "1";
const url = process.env.DATABASE_URL;
if (enabled) {
  const t = url ? new URL(url) : null;
  if (!t || !["localhost", "127.0.0.1"].includes(t.hostname) || t.pathname !== "/fkh_redesign")
    throw new Error("Disposable local billing database required.");
}
describe.skipIf(!enabled)("billing availability and recovery", () => {
  let sql: ReturnType<typeof postgres>;
  beforeAll(() => {
    sql = postgres(url!, { max: 1 });
  });
  afterEach(async () => {
    await sql`delete from fkh_users where id=${actor.id}`;
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });
  afterAll(async () => {
    await closeDb();
    await sql.end();
  });
  it("returns recoverable destinations for unconfigured and unreachable payment services", async () => {
    actor.id = (
      await sql`insert into fkh_users(name) values('Synthetic billing account') returning id`
    )[0].id;
    const fetch = vi.fn().mockRejectedValue(new Error("Synthetic network failure"));
    vi.stubGlobal("fetch", fetch);
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    vi.stubEnv("STRIPE_PLUS_MONTHLY_PRICE_ID", "");
    const input = {
      planKey: "plus" as const,
      interval: "monthly" as const,
      origin: "http://localhost:3116",
    };
    expect(await createCheckoutSession(input)).toMatchObject({
      url: expect.stringContaining("not-configured"),
    });
    expect(await createCustomerPortalSession(input.origin)).toMatchObject({
      url: expect.stringContaining("not-configured"),
    });
    expect(fetch).not.toHaveBeenCalled();
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_synthetic");
    vi.stubEnv("STRIPE_PLUS_MONTHLY_PRICE_ID", "price_synthetic");
    expect(await createCheckoutSession(input)).toMatchObject({
      url: expect.stringContaining("checkout=error"),
    });
    await sql`update fkh_billing_customers set stripe_customer_id='cus_synthetic' where user_id=${actor.id}`;
    expect(await createCustomerPortalSession(input.origin)).toMatchObject({
      url: expect.stringContaining("portal=error"),
    });
    fetch.mockResolvedValue(
      new Response(JSON.stringify({ url: "https://checkout.stripe.com/synthetic" }), {
        status: 200,
      }),
    );
    expect(await createCheckoutSession(input)).toMatchObject({
      url: "https://checkout.stripe.com/synthetic",
      error: null,
    });
    const sent = fetch.mock.calls.at(-1)?.[1].body as URLSearchParams;
    expect(sent.get("client_reference_id")).toBe(actor.id);
    expect(sent.get("customer")).toBe("cus_synthetic");
    expect(
      (await sql`select count(*) from fkh_subscriptions where user_id=${actor.id}`)[0].count,
    ).toBe("0");
  });
});
