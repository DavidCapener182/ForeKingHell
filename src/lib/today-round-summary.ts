import type { TodayRound } from "./today-round-data";
export function summarizeTodayRound(round: TodayRound) {
  const holes = [...(round.session.scorecardJson ?? [])].sort(
    (a, b) => a.holeNumber - b.holeNumber,
  );
  const played = holes.filter((h) => typeof h.score === "number" && h.score > 0);
  const sum = (key: "putts" | "penalties" | "chipShots" | "netScore") =>
    played.length && played.every((h) => typeof h[key] === "number")
      ? played.reduce((n, h) => n + h[key]!, 0)
      : null;
  const gross = played.reduce((n, h) => n + h.score!, 0);
  const par = played.reduce((n, h) => n + h.par, 0);
  const fairways = played.filter((h) => h.par !== 3 && typeof h.fairwayHit === "boolean");
  const greens = played.filter((h) => typeof h.gir === "boolean");
  return {
    holes,
    played,
    gross,
    par,
    toPar: gross - par,
    net: sum("netScore"),
    putts: sum("putts"),
    penalties: sum("penalties"),
    chips: sum("chipShots"),
    fairways: { hit: fairways.filter((h) => h.fairwayHit).length, recorded: fairways.length },
    greens: { hit: greens.filter((h) => h.gir).length, recorded: greens.length },
    birdies: played.filter((h) => h.score! < h.par).length,
    pars: played.filter((h) => h.score === h.par).length,
    bogeys: played.filter((h) => h.score === h.par + 1).length,
    doubles: played.filter((h) => h.score! >= h.par + 2).length,
    front: played.filter((h) => h.holeNumber <= 9).reduce((n, h) => n + h.score!, 0),
    back: played.filter((h) => h.holeNumber > 9).reduce((n, h) => n + h.score!, 0),
  };
}
