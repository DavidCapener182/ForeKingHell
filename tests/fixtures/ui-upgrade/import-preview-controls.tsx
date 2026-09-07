import { useState } from "react";
import { createRoot } from "react-dom/client";
import { ShotPreview, type ShotPreviewRow } from "@/app/import/shot-preview";
const rows: ShotPreviewRow[] = Array.from({ length: 26 }, (_, index) => ({
  fileId: "synthetic",
  fileName: index < 25 ? "Alpha.csv" : "Beta.csv",
  rowNumber: index + 2,
  clubKey: "7i",
  clubLabel: "7 iron",
  clubType: "7i",
  clubBrand: "Synthetic",
  fileShotNumber: index + 1,
  carryYd: 150 + index,
  totalYd: 160 + index,
  ballSpeedMph: 110,
  launchAngleDeg: 17,
  sideCarryYd: 3,
  courseShot: null,
}));
function Fixture() {
  const [shots, setShots] = useState(rows);
  return (
    <main className="p-4">
      <ShotPreview
        shots={shots}
        isCourseUpload={false}
        onClubChange={(file, row, club) =>
          setShots((previous) =>
            previous.map((shot) =>
              shot.fileId === file && shot.rowNumber === row
                ? { ...shot, correctedClub: club }
                : shot,
            ),
          )
        }
      />
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<Fixture />);
