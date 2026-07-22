const MAX_BUFFER_BYTES = 64 * 1024;
const MAX_DEVICE_ID_LENGTH = 128;

export class JsonObjectStream {
  #buffer = "";
  #maxBufferBytes;

  constructor({ maxBufferBytes = MAX_BUFFER_BYTES } = {}) {
    this.#maxBufferBytes = maxBufferBytes;
  }

  push(chunk) {
    this.#buffer += Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk);

    if (Buffer.byteLength(this.#buffer, "utf8") > this.#maxBufferBytes) {
      this.#buffer = "";
      throw new BridgeProtocolError("message_too_large", "GSPro message exceeded 64 KiB.");
    }

    const messages = [];
    let objectStart = -1;
    let depth = 0;
    let inString = false;
    let escaped = false;
    let consumed = 0;

    for (let index = 0; index < this.#buffer.length; index += 1) {
      const character = this.#buffer[index];

      if (objectStart === -1) {
        if (/\s/.test(character)) {
          consumed = index + 1;
          continue;
        }
        if (character !== "{") {
          this.#buffer = "";
          throw new BridgeProtocolError("invalid_json", "GSPro messages must be JSON objects.");
        }
        objectStart = index;
        depth = 1;
        continue;
      }

      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (character === "\\") {
          escaped = true;
        } else if (character === '"') {
          inString = false;
        }
        continue;
      }

      if (character === '"') {
        inString = true;
      } else if (character === "{") {
        depth += 1;
      } else if (character === "}") {
        depth -= 1;
        if (depth === 0) {
          const raw = this.#buffer.slice(objectStart, index + 1);
          try {
            messages.push(JSON.parse(raw));
          } catch {
            this.#buffer = "";
            throw new BridgeProtocolError("invalid_json", "GSPro message was not valid JSON.");
          }
          consumed = index + 1;
          objectStart = -1;
        }
      }
    }

    this.#buffer = this.#buffer.slice(consumed);
    return messages;
  }

  reset() {
    this.#buffer = "";
  }
}

export class BridgeProtocolError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "BridgeProtocolError";
    this.code = code;
  }
}

export function validateGsProMessage(value) {
  const root = requireRecord(value, "message");
  const options = requireRecord(root.ShotDataOptions, "ShotDataOptions");
  const containsBallData = requireBoolean(
    options.ContainsBallData,
    "ShotDataOptions.ContainsBallData",
  );
  const containsClubData = requireBoolean(
    options.ContainsClubData,
    "ShotDataOptions.ContainsClubData",
  );
  const isHeartbeat = options.IsHeartBeat === true;

  const deviceId = requireString(root.DeviceID, "DeviceID", MAX_DEVICE_ID_LENGTH);
  const apiVersion = requireString(root.APIversion, "APIversion", 8);
  if (apiVersion !== "1") {
    throw new BridgeProtocolError(
      "unsupported_version",
      "Only GSPro Open Connect API version 1 is supported.",
    );
  }

  const shotNumber = requireInteger(root.ShotNumber, "ShotNumber", 0, 1_000_000_000);
  const units = root.Units === undefined ? "Yards" : requireString(root.Units, "Units", 16);
  if (units !== "Yards" && units !== "Meters") {
    throw new BridgeProtocolError("invalid_units", "Units must be Yards or Meters.");
  }

  if (isHeartbeat && !containsBallData) {
    return {
      kind: "heartbeat",
      deviceId,
      shotNumber,
      ballDetected: options.IsBallDetected === true,
      ready: options.IsReady === true,
    };
  }

  if (!containsBallData) {
    throw new BridgeProtocolError("missing_ball_data", "A shot must declare and include BallData.");
  }

  const ball = requireRecord(root.BallData, "BallData");
  const speed = requireNumber(ball.Speed, "BallData.Speed", 0.1, units === "Yards" ? 250 : 112);
  const hla = requireNumber(ball.HLA, "BallData.HLA", -90, 90);
  const vla = requireNumber(ball.VLA, "BallData.VLA", -10, 90);
  const spinAxis = requireNumber(ball.SpinAxis, "BallData.SpinAxis", -90, 90);
  const totalSpin = resolveTotalSpin(ball);
  const carryDistance = optionalNumber(
    ball.CarryDistance,
    "BallData.CarryDistance",
    0,
    units === "Yards" ? 500 : 460,
  );

  let club = null;
  if (containsClubData) {
    const clubData = requireRecord(root.ClubData, "ClubData");
    club = {
      speedMph: convertSpeedToMph(
        optionalNumber(clubData.Speed, "ClubData.Speed", 0, units === "Yards" ? 180 : 81),
        units,
      ),
      angleOfAttackDeg: optionalNumber(clubData.AngleOfAttack, "ClubData.AngleOfAttack", -30, 30),
      faceToTargetDeg: optionalNumber(clubData.FaceToTarget, "ClubData.FaceToTarget", -45, 45),
      lieDeg: optionalNumber(clubData.Lie, "ClubData.Lie", 0, 90),
      loftDeg: optionalNumber(clubData.Loft, "ClubData.Loft", -10, 90),
      pathDeg: optionalNumber(clubData.Path, "ClubData.Path", -45, 45),
      speedAtImpactMph: convertSpeedToMph(
        optionalNumber(
          clubData.SpeedAtImpact,
          "ClubData.SpeedAtImpact",
          0,
          units === "Yards" ? 180 : 81,
        ),
        units,
      ),
      verticalFaceImpact: optionalNumber(
        clubData.VerticalFaceImpact,
        "ClubData.VerticalFaceImpact",
        -100,
        100,
      ),
      horizontalFaceImpact: optionalNumber(
        clubData.HorizontalFaceImpact,
        "ClubData.HorizontalFaceImpact",
        -100,
        100,
      ),
      closureRate: optionalNumber(clubData.ClosureRate, "ClubData.ClosureRate", -10_000, 10_000),
    };
  }

  return {
    kind: "shot",
    deviceId,
    shotNumber,
    receivedUnits: units,
    ballDetected: options.IsBallDetected === true,
    ready: options.IsReady === true,
    ball: {
      speedMph: convertSpeedToMph(speed, units),
      horizontalLaunchDeg: hla,
      verticalLaunchDeg: vla,
      spinAxisDeg: spinAxis,
      totalSpinRpm: totalSpin,
      carryDistanceYards: convertDistanceToYards(carryDistance, units),
    },
    club,
  };
}

export function gsProResponse(code, message, player) {
  const response = { Code: code, Message: message };
  if (player) response.Player = player;
  return `${JSON.stringify(response)}\n`;
}

function resolveTotalSpin(ball) {
  if (ball.TotalSpin !== undefined) {
    return requireNumber(ball.TotalSpin, "BallData.TotalSpin", 0, 20_000);
  }

  const backSpin = requireNumber(ball.BackSpin, "BallData.BackSpin", -20_000, 20_000);
  const sideSpin = requireNumber(ball.SideSpin, "BallData.SideSpin", -20_000, 20_000);
  return Math.hypot(backSpin, sideSpin);
}

function convertSpeedToMph(value, units) {
  if (value === null) return null;
  return units === "Meters" ? value * 2.2369362921 : value;
}

function convertDistanceToYards(value, units) {
  if (value === null) return null;
  return units === "Meters" ? value * 1.0936132983 : value;
}

function requireRecord(value, field) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new BridgeProtocolError("invalid_field", `${field} must be an object.`);
  }
  return value;
}

function requireString(value, field, maxLength) {
  if (typeof value !== "string" || value.length === 0 || value.length > maxLength) {
    throw new BridgeProtocolError(
      "invalid_field",
      `${field} must be a non-empty string up to ${maxLength} characters.`,
    );
  }
  return value;
}

function requireBoolean(value, field) {
  if (typeof value !== "boolean") {
    throw new BridgeProtocolError("invalid_field", `${field} must be a boolean.`);
  }
  return value;
}

function requireInteger(value, field, minimum, maximum) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new BridgeProtocolError(
      "invalid_field",
      `${field} must be an integer from ${minimum} to ${maximum}.`,
    );
  }
  return value;
}

function requireNumber(value, field, minimum, maximum) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum) {
    throw new BridgeProtocolError(
      "invalid_field",
      `${field} must be a finite number from ${minimum} to ${maximum}.`,
    );
  }
  return value;
}

function optionalNumber(value, field, minimum, maximum) {
  if (value === undefined || value === null) return null;
  return requireNumber(value, field, minimum, maximum);
}
