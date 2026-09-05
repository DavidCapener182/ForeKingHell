import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createMobileHistoryEntry,
  mobileHistoryScrollKey,
  mobileNavigationLocation,
  preserveMobileHistoryEntry,
  mobileScrollKey,
  readMobileScroll,
  restoreMobileScroll,
} from "./mobile-navigation-scroll";

let height: number;
let ready: boolean;
let locked: boolean;
let frames: Map<number, FrameRequestCallback>;
let observers: Set<() => void>;
let browser: EventTarget & {
  scrollTo: ReturnType<typeof vi.fn>;
  innerHeight: number;
  sessionStorage: Storage;
};
function layout() {
  for (const notify of observers) notify();
  const pending = [...frames.values()];
  frames.clear();
  for (const callback of pending) callback(0);
}
beforeEach(() => {
  vi.useFakeTimers();
  height = 400;
  ready = false;
  locked = false;
  frames = new Map();
  observers = new Set();
  let id = 0;
  const storage = new Map<string, string>();
  browser = Object.assign(new EventTarget(), {
    scrollTo: vi.fn(),
    innerHeight: 800,
    sessionStorage: { getItem: (key: string) => storage.get(key) ?? null } as Storage,
  });
  vi.stubGlobal("window", browser);
  vi.stubGlobal("document", {
    body: { hasAttribute: () => locked },
    documentElement: {
      get scrollHeight() {
        return height;
      },
    },
    querySelectorAll: () => (ready ? [{ getClientRects: () => [1] }] : []),
  });
  vi.stubGlobal("getComputedStyle", () => ({ overflowY: locked ? "hidden" : "visible" }));
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.set(++id, callback);
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (key: number) => frames.delete(key));
  class Observer {
    constructor(private callback: () => void) {
      observers.add(callback);
    }
    observe() {}
    disconnect() {
      observers.delete(this.callback);
    }
  }
  vi.stubGlobal("ResizeObserver", Observer);
  vi.stubGlobal("MutationObserver", Observer);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("mobile navigation restoration", () => {
  it("matches encoded search deep links without dropping filter values", () => {
    expect(mobileNavigationLocation("/shots?search=long%20iron&club=7i")).toBe(
      "/shots?search=long+iron&club=7i",
    );
    expect(mobileNavigationLocation("/today#main-content")).toBe("/today");
  });
  it("keeps each visit distinct and preserves the framework history payload", () => {
    const history = {
      state: { __NA: true, tree: "router tree" } as Record<string, unknown>,
      replaceState: vi.fn(),
    };
    history.replaceState.mockImplementation((state) => {
      history.state = state;
    });
    Object.assign(browser, { history });
    const first = createMobileHistoryEntry("/today");
    expect(history.state).toMatchObject({ __NA: true, tree: "router tree" });
    expect(mobileHistoryScrollKey("/today")).toBe(first);
    preserveMobileHistoryEntry("/today", first);
    expect(history.replaceState).toHaveBeenCalledTimes(1);
    const priorState = history.state;
    const second = createMobileHistoryEntry("/today");
    expect(second).not.toBe(first);
    expect(mobileHistoryScrollKey("/today", priorState)).toBe(first);
    expect(mobileHistoryScrollKey("/bag", priorState)).toBeNull();
    history.state = { __NA: true, tree: "updated router tree" };
    preserveMobileHistoryEntry("/today", second);
    expect(history.state).toMatchObject({ tree: "updated router tree" });
    expect(mobileHistoryScrollKey("/today")).toBe(second);
  });

  it("waits for streamed content to reach the saved position instead of clamping it to zero", () => {
    const finished = vi.fn();
    restoreMobileScroll(500, finished);
    layout();
    ready = true;
    height = 900;
    layout();
    expect(browser.scrollTo).not.toHaveBeenCalled();
    height = 1600;
    layout();
    expect(browser.scrollTo).toHaveBeenCalledWith({ top: 500, behavior: "instant" });
    expect(finished).toHaveBeenCalledWith(true);
    layout();
    expect(browser.scrollTo).toHaveBeenCalledTimes(1);
    expect(observers.size).toBe(0);
  });
  it.each(["touchstart", "wheel", "keydown"])(
    "gives control to a user %s while content is loading",
    (event) => {
      const finished = vi.fn();
      restoreMobileScroll(500, finished);
      browser.dispatchEvent(new Event(event));
      ready = true;
      height = 1800;
      layout();
      expect(browser.scrollTo).not.toHaveBeenCalled();
      expect(finished).toHaveBeenCalledExactlyOnceWith(false);
    },
  );
  it("waits for sheet scroll-lock cleanup before restoring its destination", () => {
    ready = true;
    height = 1800;
    locked = true;
    restoreMobileScroll(400, vi.fn());
    layout();
    expect(browser.scrollTo).not.toHaveBeenCalled();
    locked = false;
    layout();
    expect(browser.scrollTo).toHaveBeenCalledWith({ top: 400, behavior: "instant" });
  });
  it("releases a failed or shortened page without claiming a restoration", () => {
    const finished = vi.fn();
    restoreMobileScroll(500, finished);
    vi.advanceTimersByTime(5000);
    ready = true;
    height = 1800;
    layout();
    expect(finished).toHaveBeenCalledExactlyOnceWith(false);
    expect(browser.scrollTo).not.toHaveBeenCalled();
    expect(observers.size).toBe(0);
  });
  it("keeps saved-plan and settings positions distinct while filters share a screen", () => {
    expect(mobileScrollKey("/practice?planId=a")).not.toBe(mobileScrollKey("/practice?planId=b"));
    expect(mobileScrollKey("/settings?section=profile")).not.toBe(
      mobileScrollKey("/settings?section=privacy"),
    );
    expect(mobileScrollKey("/practice?intent=confidence")).toBe(mobileScrollKey("/practice"));
    expect(mobileScrollKey("/today")).toBe("fkh:mobile-tab-scroll:/today");
    expect(mobileScrollKey("/bag/club-id")).not.toBe(mobileScrollKey("/bag"));
  });
  it("falls back safely when storage is unavailable or corrupt", () => {
    vi.spyOn(browser.sessionStorage, "getItem").mockReturnValue("NaN");
    expect(readMobileScroll("key")).toBe(0);
    vi.spyOn(browser.sessionStorage, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(readMobileScroll("key")).toBe(0);
  });
});
