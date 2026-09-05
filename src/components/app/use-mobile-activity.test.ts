import { afterEach, describe, expect, it, vi } from "vitest";
import { useMobileActivity } from "./use-mobile-activity";

const effects = vi.hoisted(() => ({ cleanup: undefined as (() => void) | undefined }));
vi.mock("react", () => ({
  useEffect: (effect: () => (() => void) | undefined) => {
    effects.cleanup = effect();
  },
}));

function environment(request?: ReturnType<typeof vi.fn>) {
  const doc = new EventTarget();
  const shell = { dataset: {} as Record<string, string> };
  Object.assign(doc, { visibilityState: "visible", querySelector: () => shell });
  vi.stubGlobal("document", doc);
  vi.stubGlobal("navigator", request ? { wakeLock: { request } } : {});
  return { doc, shell };
}
function sentinel() {
  return Object.assign(new EventTarget(), {
    released: false,
    release: vi.fn().mockResolvedValue(undefined),
  });
}
const settle = async () => {
  await Promise.resolve();
  await Promise.resolve();
};
afterEach(() => {
  effects.cleanup?.();
  effects.cleanup = undefined;
  vi.unstubAllGlobals();
});

describe("immersive screen-awake lifecycle", () => {
  it("permits one pending request and reacquires after the OS releases it", async () => {
    let resolve!: (lock: ReturnType<typeof sentinel>) => void;
    const request = vi.fn(
      () =>
        new Promise<ReturnType<typeof sentinel>>((done) => {
          resolve = done;
        }),
    );
    const { doc, shell } = environment(request);
    useMobileActivity(true);
    doc.dispatchEvent(new Event("visibilitychange"));
    expect(request).toHaveBeenCalledTimes(1);
    const first = sentinel();
    resolve(first);
    await settle();
    first.released = true;
    first.dispatchEvent(new Event("release"));
    doc.dispatchEvent(new Event("visibilitychange"));
    expect(request).toHaveBeenCalledTimes(2);
    const second = sentinel();
    resolve(second);
    await settle();
    effects.cleanup?.();
    effects.cleanup = undefined;
    expect(second.release).toHaveBeenCalledOnce();
    expect(shell.dataset.mobileFlow).toBeUndefined();
  });
  it("releases a lock that resolves after the activity exits", async () => {
    let resolve!: (lock: ReturnType<typeof sentinel>) => void;
    const request = vi.fn(
      () =>
        new Promise<ReturnType<typeof sentinel>>((done) => {
          resolve = done;
        }),
    );
    const { doc } = environment(request);
    useMobileActivity(true);
    effects.cleanup?.();
    effects.cleanup = undefined;
    const lock = sentinel();
    resolve(lock);
    await settle();
    expect(lock.release).toHaveBeenCalledOnce();
    doc.dispatchEvent(new Event("visibilitychange"));
    expect(request).toHaveBeenCalledOnce();
  });
  it("keeps unsupported or declined wake lock optional and does nothing for inactive flows", async () => {
    const { shell } = environment();
    useMobileActivity(false);
    expect(shell.dataset.mobileFlow).toBeUndefined();
    useMobileActivity(true);
    expect(shell.dataset.mobileFlow).toBe("immersive");
    effects.cleanup?.();
    const request = vi.fn().mockRejectedValue(new Error("OS declined"));
    const { doc } = environment(request);
    useMobileActivity(true);
    await settle();
    doc.dispatchEvent(new Event("visibilitychange"));
    await settle();
    expect(request).toHaveBeenCalledTimes(2);
  });
});
