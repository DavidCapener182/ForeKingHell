import { describe, expect, it, vi } from "vitest";
import { bindMobileCourseTwinLifecycle } from "./mobile-course-twin-lifecycle";

function setup(initialContextLost = false) {
  const canvas = new EventTarget();
  const document = Object.assign(new EventTarget(), { visibilityState: "visible" });
  const setSuspended = vi.fn();
  const onSuspend = vi.fn();
  const onContextChange = vi.fn();
  const dispose = bindMobileCourseTwinLifecycle({
    canvas,
    document,
    initialContextLost,
    setSuspended,
    onSuspend,
    onContextChange,
  });
  return { canvas, document, setSuspended, onSuspend, onContextChange, dispose };
}

describe("mobile Course Twin graphics lifecycle", () => {
  it("stops hidden rendering and leaves playback paused after returning", () => {
    const state = setup();
    expect(state.onSuspend).not.toHaveBeenCalled();
    state.document.visibilityState = "hidden";
    state.document.dispatchEvent(new Event("visibilitychange"));
    expect(state.setSuspended).toHaveBeenLastCalledWith(true);
    expect(state.onSuspend).toHaveBeenCalledOnce();
    state.document.visibilityState = "visible";
    state.document.dispatchEvent(new Event("visibilitychange"));
    expect(state.setSuspended).toHaveBeenLastCalledWith(false);
    expect(state.onSuspend).toHaveBeenCalledOnce();
    state.dispose();
  });
  it("retains suspension until both the context and visibility recover", () => {
    const state = setup();
    const event = new Event("webglcontextlost", { cancelable: true });
    state.canvas.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(state.onContextChange).toHaveBeenLastCalledWith(true);
    state.document.dispatchEvent(new Event("visibilitychange"));
    expect(state.setSuspended).toHaveBeenLastCalledWith(true);
    state.document.visibilityState = "hidden";
    state.canvas.dispatchEvent(new Event("webglcontextrestored"));
    expect(state.onContextChange).toHaveBeenLastCalledWith(false);
    expect(state.setSuspended).toHaveBeenLastCalledWith(true);
    state.document.visibilityState = "visible";
    state.document.dispatchEvent(new Event("visibilitychange"));
    expect(state.setSuspended).toHaveBeenLastCalledWith(false);
    state.dispose();
  });
  it("handles an already-lost context and removes every listener on exit", () => {
    const state = setup(true);
    expect(state.setSuspended).toHaveBeenLastCalledWith(true);
    expect(state.onContextChange).toHaveBeenLastCalledWith(true);
    state.dispose();
    state.setSuspended.mockClear();
    state.onContextChange.mockClear();
    state.canvas.dispatchEvent(new Event("webglcontextrestored"));
    state.canvas.dispatchEvent(new Event("webglcontextlost"));
    state.document.dispatchEvent(new Event("visibilitychange"));
    expect(state.setSuspended).not.toHaveBeenCalled();
    expect(state.onContextChange).not.toHaveBeenCalled();
  });
});
