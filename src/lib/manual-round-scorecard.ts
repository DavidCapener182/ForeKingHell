export type ManualRoundHole = {
  holeNumber: number;
  par: number;
  yards: number;
  strokeIndex: number | null;
};

/** Course facts come from the owned/shared tee record, never hidden browser fields. */
export function manualRoundScorecard(
  form: FormData,
  courseHoles: ManualRoundHole[],
  complete: boolean,
) {
  if (!courseHoles.length || courseHoles.length > 18)
    throw new Error("This tee needs a saved hole-by-hole scorecard before recording a round.");
  if (Number(form.get("holeCount")) !== courseHoles.length)
    throw new Error("The course scorecard changed. Reload it before entering the round.");
  return [...courseHoles]
    .sort((a, b) => a.holeNumber - b.holeNumber)
    .map((hole, index) => {
      if (Number(form.get(`holeNumber-${index}`)) !== hole.holeNumber)
        throw new Error("The hole order changed. Reload the scorecard before saving.");
      const read = (key: string, label: string, minimum: number, required = false) => {
        const raw = String(form.get(`${key}-${index}`) ?? "").trim();
        if (!raw && !required) return null;
        const value = raw ? Number(raw) : NaN;
        if (!Number.isInteger(value) || value < minimum)
          throw new Error(
            `Hole ${hole.holeNumber}: enter ${label} as a whole number of ${minimum} or more.`,
          );
        return value;
      };
      const boolean = (key: string) => {
        const value = form.get(`${key}-${index}`);
        return value === "true" ? true : value === "false" ? false : null;
      };
      return {
        ...hole,
        name: null,
        score: read("score", "score", 1, complete),
        putts: read("putts", "putts", 0),
        penalties: read("penalties", "penalties", 0),
        chipShots: read("chipShots", "chips", 0),
        greensideSandShots: read("greensideSandShots", "sand shots", 0),
        fairwayHit: hole.par === 3 ? null : boolean("fairwayHit"),
        gir: boolean("gir"),
        csvShotCount: 0,
        progressYd: 0,
        distanceRemainingYd: hole.yards,
      };
    });
}
