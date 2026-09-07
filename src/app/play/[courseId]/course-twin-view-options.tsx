"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { CourseTwinManifest } from "@/lib/course-twin-contract";
type CameraView = "golfer" | "aerial";

export function CourseTwinViewOptions({
  holes,
  selectedHole,
  camera,
  locked,
  onApply,
  onResetCamera,
}: {
  holes: CourseTwinManifest["holes"];
  selectedHole: number;
  camera: CameraView;
  locked: boolean;
  onApply: (hole: number, camera: CameraView) => void;
  onResetCamera: () => void;
}) {
  const [query, setQuery] = useState("");
  const [draftHole, setDraftHole] = useState(selectedHole);
  const [draftCamera, setDraftCamera] = useState(camera);
  const matched = holes.filter((hole) =>
    `${hole.holeNumber} ${hole.par} ${hole.yards}`.includes(query.trim()),
  );
  const changed = Number(draftHole !== selectedHole) + Number(draftCamera !== camera);
  return (
    <section
      className="mt-3 grid gap-3 rounded-xl border border-white/15 p-3 text-sm"
      aria-label="Course view options"
    >
      <p>
        Hole {selectedHole} · {camera === "aerial" ? "Aerial view" : "Shot view"}
      </p>
      <label className="grid gap-1">
        Find hole, par or yardage
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="min-h-11 rounded border border-white/20 bg-background px-2 text-foreground"
        />
      </label>
      <p role="status">
        {matched.length} of {holes.length} mapped holes
      </p>
      <details>
        <summary className="min-h-11 cursor-pointer content-center font-semibold">
          View options · {changed} unsaved changes
        </summary>
        <div className="grid gap-3 py-2">
          <label className="grid gap-1">
            Hole
            <select
              aria-label="Hole"
              value={draftHole}
              disabled={locked}
              onChange={(event) => setDraftHole(Number(event.target.value))}
              className="min-h-11 rounded border border-white/20 bg-[#07150e] px-2"
            >
              {holes
                .filter((hole) => hole.holeNumber === draftHole || matched.includes(hole))
                .map((hole) => (
                  <option key={hole.holeNumber} value={hole.holeNumber}>
                    Hole {hole.holeNumber} · Par {hole.par} · {hole.yards} yd
                  </option>
                ))}
            </select>
          </label>
          {locked ? (
            <p>Current round controls the hole. Finish its current shot before moving.</p>
          ) : null}
          <label className="grid gap-1">
            Camera
            <select
              aria-label="Camera"
              value={draftCamera}
              onChange={(event) => setDraftCamera(event.target.value as CameraView)}
              className="min-h-11 rounded border border-white/20 bg-[#07150e] px-2"
            >
              <option value="aerial">Aerial view</option>
              <option value="golfer">Shot view</option>
            </select>
          </label>
          <p>
            Map legend: yellow dispersion · white target · blue carry · orange hazards. These are
            the visible evidence layers.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setDraftHole(selectedHole);
                setDraftCamera(camera);
                setQuery("");
              }}
            >
              Reset options
            </Button>
            <Button onClick={() => onApply(draftHole, draftCamera)}>Apply view</Button>
            <Button variant="outline" onClick={onResetCamera}>
              Reset camera
            </Button>
          </div>
        </div>
      </details>
    </section>
  );
}
