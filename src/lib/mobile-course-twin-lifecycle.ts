/** Suspend graphics without unmounting the scene or discarding an in-flight round. */
export function bindMobileCourseTwinLifecycle({
  canvas,
  document,
  initialContextLost,
  setSuspended,
  onSuspend,
  onContextChange,
}: {
  canvas: EventTarget;
  document: EventTarget & { visibilityState: string };
  initialContextLost: boolean;
  setSuspended: (suspended: boolean) => void;
  onSuspend: () => void;
  onContextChange: (lost: boolean) => void;
}) {
  let contextLost = initialContextLost;
  const update = () => {
    const suspended = contextLost || document.visibilityState !== "visible";
    if (suspended) onSuspend();
    setSuspended(suspended);
  };
  const lost = (event: Event) => {
    // Permit the browser and Three.js to restore this same context.
    event.preventDefault();
    contextLost = true;
    onContextChange(true);
    update();
  };
  const restored = () => {
    contextLost = false;
    onContextChange(false);
    update();
  };
  canvas.addEventListener("webglcontextlost", lost);
  canvas.addEventListener("webglcontextrestored", restored);
  document.addEventListener("visibilitychange", update);
  onContextChange(contextLost);
  update();
  return () => {
    canvas.removeEventListener("webglcontextlost", lost);
    canvas.removeEventListener("webglcontextrestored", restored);
    document.removeEventListener("visibilitychange", update);
  };
}
