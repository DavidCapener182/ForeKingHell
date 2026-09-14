import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("public analytics consent", () => {
  let storage: Map<string, string>;
  let browser: EventTarget & {
    localStorage: { getItem: ReturnType<typeof vi.fn>; setItem: ReturnType<typeof vi.fn> };
    location: { origin: string };
  };
  beforeEach(() => {
    vi.resetModules();
    storage = new Map();
    browser = Object.assign(new EventTarget(), {
      localStorage: {
        getItem: vi.fn((key: string) => storage.get(key) ?? null),
        setItem: vi.fn((key: string, value: string) => storage.set(key, value)),
      },
      location: { origin: "https://lmworldtour.app" },
    });
    vi.stubGlobal("window", browser);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("defaults to no analytics, persists either choice and expires the preference", async () => {
    const consent = await import("./analytics-consent");
    expect(consent.readAnalyticsConsent()).toBe("unknown");
    expect(consent.filterAnalyticsEvent({ url: "https://lmworldtour.app/" })).toBeNull();
    consent.saveAnalyticsConsent(true);
    expect(consent.readAnalyticsConsent()).toBe("granted");
    consent.saveAnalyticsConsent(false);
    expect(consent.readAnalyticsConsent()).toBe("denied");
    storage.set(
      consent.ANALYTICS_CONSENT_KEY,
      JSON.stringify({ version: 1, analytics: true, expires: Date.now() - 1 }),
    );
    expect(consent.readAnalyticsConsent()).toBe("unknown");
  });

  it("strips queries and fragments and rejects private, token and external URLs", async () => {
    const consent = await import("./analytics-consent");
    consent.saveAnalyticsConsent(true);
    expect(
      consent.filterAnalyticsEvent({
        type: "pageview",
        url: "https://lmworldtour.app/?email=private#token",
      }),
    ).toEqual({ type: "pageview", url: "https://lmworldtour.app/" });
    for (const path of [
      "/login",
      "/auth/callback",
      "/thank-you",
      "/dashboard",
      "/share/report/secret",
      "/shared/token",
    ]) {
      expect(consent.filterAnalyticsEvent({ url: `https://lmworldtour.app${path}` })).toBeNull();
    }
    expect(consent.filterAnalyticsEvent({ url: "https://other.example/" })).toBeNull();
    expect(consent.filterAnalyticsEvent({ url: "invalid" })).toBeNull();
    consent.saveAnalyticsConsent(false);
    expect(consent.filterAnalyticsEvent({ url: "https://lmworldtour.app/" })).toBeNull();
  });

  it("notifies local and cross-tab changes and removes subscriptions", async () => {
    const consent = await import("./analytics-consent");
    const changed = vi.fn();
    const unsubscribe = consent.subscribeAnalyticsConsent(changed);
    consent.saveAnalyticsConsent(false);
    browser.dispatchEvent(new Event("storage"));
    expect(changed).toHaveBeenCalledTimes(2);
    unsubscribe();
    browser.dispatchEvent(new Event("storage"));
    expect(changed).toHaveBeenCalledTimes(2);
  });

  it("keeps the visitor's choice for the session when storage is blocked", async () => {
    const consent = await import("./analytics-consent");
    browser.localStorage.setItem.mockImplementation(() => {
      throw new Error("blocked");
    });
    consent.saveAnalyticsConsent(false);
    expect(consent.readAnalyticsConsent()).toBe("denied");
    consent.saveAnalyticsConsent(true);
    expect(consent.readAnalyticsConsent()).toBe("granted");
  });
});
