import test from "node:test";
import assert from "node:assert/strict";
import { BridgeProtocolError, JsonObjectStream, validateGsProMessage } from "./protocol.mjs";

test("extracts fragmented and concatenated JSON objects without treating quoted braces as structure", () => {
  const parser = new JsonObjectStream();
  assert.deepEqual(parser.push('{"DeviceID":"MLM'), []);
  assert.deepEqual(parser.push('2 {PRO}","value":1}{"next":'), [
    { DeviceID: "MLM2 {PRO}", value: 1 },
  ]);
  assert.deepEqual(parser.push("true}"), [{ next: true }]);
});

test("rejects an oversized unfinished payload and resets safely", () => {
  const parser = new JsonObjectStream({ maxBufferBytes: 20 });
  assert.throws(
    () => parser.push(`{"value":"${"x".repeat(30)}`),
    (error) => {
      assert.equal(error.code, "message_too_large");
      return true;
    },
  );
  assert.deepEqual(parser.push('{"ok":true}'), [{ ok: true }]);
});

test("normalises an official GSPro v1 ball-data shot", () => {
  const result = validateGsProMessage(validShot());
  assert.equal(result.kind, "shot");
  assert.equal(result.deviceId, "Rapsodo MLM2PRO");
  assert.equal(result.shotNumber, 7);
  assert.deepEqual(result.ball, {
    speedMph: 143.2,
    horizontalLaunchDeg: -1.8,
    verticalLaunchDeg: 13.4,
    spinAxisDeg: 4.2,
    totalSpinRpm: 2675,
    carryDistanceYards: 238.4,
  });
  assert.equal(result.club.speedMph, 101.5);
});

test("supports BackSpin and SideSpin when TotalSpin is omitted", () => {
  const shot = validShot();
  delete shot.BallData.TotalSpin;
  shot.BallData.BackSpin = 3000;
  shot.BallData.SideSpin = 4000;
  assert.equal(validateGsProMessage(shot).ball.totalSpinRpm, 5000);
});

test("normalises metre-based speed and carry values", () => {
  const shot = validShot();
  shot.Units = "Meters";
  shot.BallData.Speed = 60;
  shot.BallData.CarryDistance = 200;
  shot.ClubData.Speed = 45;
  shot.ClubData.SpeedAtImpact = 44.5;
  const result = validateGsProMessage(shot);
  assert.ok(Math.abs(result.ball.speedMph - 134.216) < 0.01);
  assert.ok(Math.abs(result.ball.carryDistanceYards - 218.723) < 0.01);
  assert.ok(Math.abs(result.club.speedMph - 100.662) < 0.01);
});

test("accepts a heartbeat without BallData", () => {
  const shot = validShot();
  shot.ShotDataOptions.ContainsBallData = false;
  shot.ShotDataOptions.IsHeartBeat = true;
  delete shot.BallData;
  assert.deepEqual(validateGsProMessage(shot), {
    kind: "heartbeat",
    deviceId: "Rapsodo MLM2PRO",
    shotNumber: 7,
    ballDetected: true,
    ready: true,
  });
});

for (const [name, mutate, code] of [
  [
    "unsupported API versions",
    (shot) => {
      shot.APIversion = "2";
    },
    "unsupported_version",
  ],
  [
    "missing declared ball data",
    (shot) => {
      shot.ShotDataOptions.ContainsBallData = false;
    },
    "missing_ball_data",
  ],
  [
    "impossible ball speed",
    (shot) => {
      shot.BallData.Speed = 999;
    },
    "invalid_field",
  ],
  [
    "non-finite spin",
    (shot) => {
      shot.BallData.TotalSpin = Number.NaN;
    },
    "invalid_field",
  ],
]) {
  test(`rejects ${name}`, () => {
    const shot = validShot();
    mutate(shot);
    assert.throws(
      () => validateGsProMessage(shot),
      (error) => {
        assert.ok(error instanceof BridgeProtocolError);
        assert.equal(error.code, code);
        return true;
      },
    );
  });
}

export function validShot() {
  return {
    DeviceID: "Rapsodo MLM2PRO",
    Units: "Yards",
    ShotNumber: 7,
    APIversion: "1",
    BallData: {
      Speed: 143.2,
      SpinAxis: 4.2,
      TotalSpin: 2675,
      HLA: -1.8,
      VLA: 13.4,
      CarryDistance: 238.4,
    },
    ClubData: {
      Speed: 101.5,
      AngleOfAttack: 2.1,
      FaceToTarget: -0.7,
      Lie: 59,
      Loft: 10.5,
      Path: 1.4,
      SpeedAtImpact: 100.9,
      VerticalFaceImpact: 2,
      HorizontalFaceImpact: -1,
      ClosureRate: 120,
    },
    ShotDataOptions: {
      ContainsBallData: true,
      ContainsClubData: true,
      IsHeartBeat: false,
      IsBallDetected: true,
      IsReady: true,
    },
  };
}
