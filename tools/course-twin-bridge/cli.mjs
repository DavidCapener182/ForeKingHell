#!/usr/bin/env node
import { CourseTwinBridge } from "./server.mjs";
import { LoopbackPortForwarder } from "./port-forwarder.mjs";
import {
  defaultGsProPort,
  gsProPortStatus,
  OFFICIAL_GSPRO_PORT,
  UNPRIVILEGED_GSPRO_TARGET_PORT,
} from "./port-strategy.mjs";

async function main() {
  const selfTest = process.argv.includes("--self-test");
  if (process.argv.includes("--port-forwarder")) {
    return runPortForwarder();
  }
  const gsProPort = selfTest ? 0 : numberFromEnv("FKH_GSPRO_PORT", defaultGsProPort());
  const bridge = new CourseTwinBridge({
    gsProPort,
    browserPort: selfTest ? 0 : numberFromEnv("FKH_BRIDGE_PORT", 9791),
  });
  const addresses = await bridge.start();
  if (selfTest) {
    process.stdout.write(`Course Twin Bridge self-test passed on ${addresses.host}.\n`);
    await bridge.stop();
    return;
  }
  process.stdout.write(
    [
      "ForeKingHell Course Twin Bridge is running.",
      `GSPro listener: ${addresses.host}:${addresses.gsProPort}`,
      `Browser bridge: http://${addresses.host}:${addresses.browserPort}`,
      `Pairing code: ${bridge.pairingCode}`,
      "The listener is loopback-only. Keep this window open while using your launch monitor.",
      gsProPortStatus(addresses.gsProPort).message,
      "",
    ].join("\n"),
  );
  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, async () => {
      await bridge.stop();
      process.exit(0);
    });
  }
}

async function runPortForwarder() {
  const forwarder = new LoopbackPortForwarder({
    sourcePort: numberFromEnv("FKH_FORWARD_SOURCE_PORT", OFFICIAL_GSPRO_PORT),
    targetPort: numberFromEnv("FKH_FORWARD_TARGET_PORT", UNPRIVILEGED_GSPRO_TARGET_PORT),
  });
  const address = await forwarder.start();
  process.stdout.write(
    `ForeKingHell loopback helper forwarding ${address.host}:${address.sourcePort} to ${address.host}:${address.targetPort}.\n`,
  );
  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, async () => {
      await forwarder.stop();
      process.exit(0);
    });
  }
}

main().catch((error) => {
  process.stderr.write(`Course Twin Bridge could not start: ${error.message}\n`);
  process.exitCode = 1;
});

function numberFromEnv(name, fallback) {
  const value = process.env[name];
  if (!value) return fallback;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0 || number > 65_535) {
    throw new Error(`${name} must be a valid TCP port.`);
  }
  return number;
}
