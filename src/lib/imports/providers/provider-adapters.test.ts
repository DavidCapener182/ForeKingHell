import { describe, expect, it } from "vitest";

import { detectLaunchMonitorProvider, launchMonitorProviders } from "@/lib/imports/providers";

describe("launch monitor provider adapters", () => {
  it("keeps Rapsodo live while Square and TrackMan adapters are discoverable", () => {
    expect(launchMonitorProviders.map((provider) => provider.providerKind)).toEqual([
      "rapsodo",
      "square",
      "trackman",
    ]);
    expect(
      launchMonitorProviders.find((provider) => provider.providerKind === "rapsodo")?.status,
    ).toBe("live");
    expect(
      launchMonitorProviders.find((provider) => provider.providerKind === "square")?.status,
    ).toBe("beta");
    expect(
      launchMonitorProviders.find((provider) => provider.providerKind === "trackman")?.status,
    ).toBe("research");
  });

  it("detects and normalises a Square-style file", async () => {
    const provider = await detectLaunchMonitorProvider({
      fileName: "square-session.csv",
      text: "Club,Carry Distance,Total Distance,Ball Speed,Launch Angle\n7 Iron,151.2,162.4,118.7,17.2",
    });

    expect(provider?.providerKind).toBe("square");
    const session = await provider!.parse({
      fileName: "square-session.csv",
      text: "Club,Carry Distance,Total Distance,Ball Speed,Launch Angle\n7 Iron,151.2,162.4,118.7,17.2",
    });

    expect(session.shotCount).toBe(1);
    expect(session.shots[0].clubType).toBe("7-iron");
    expect(session.shots[0].metrics).toMatchObject({
      carry_yards: 151.2,
      total_yards: 162.4,
      ball_speed_mph: 118.7,
      launch_angle_deg: 17.2,
    });
  });

  it("detects and normalises a TrackMan-style file", async () => {
    const provider = await detectLaunchMonitorProvider({
      fileName: "trackman-export.csv",
      text: "Club,Carry,Ball Speed,Launch Angle,Spin Rate,Club Path,Face Angle\nDriver,241.8,151.4,12.6,2310,1.8,0.4",
    });

    expect(provider?.providerKind).toBe("trackman");
    const session = await provider!.parse({
      fileName: "trackman-export.csv",
      text: "Club,Carry,Ball Speed,Launch Angle,Spin Rate,Club Path,Face Angle\nDriver,241.8,151.4,12.6,2310,1.8,0.4",
    });

    expect(session.shotCount).toBe(1);
    expect(session.shots[0].clubType).toBe("driver");
    expect(session.shots[0].metrics).toMatchObject({
      carry_yards: 241.8,
      ball_speed_mph: 151.4,
      launch_angle_deg: 12.6,
      spin_rate_rpm: 2310,
      club_path_deg: 1.8,
      face_angle_deg: 0.4,
    });
  });
});
