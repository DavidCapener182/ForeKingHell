import assert from "node:assert/strict";
import { createServer, connect } from "node:net";
import test from "node:test";

import { LoopbackPortForwarder } from "./port-forwarder.mjs";
import {
  defaultGsProPort,
  gsProPortStatus,
  OFFICIAL_GSPRO_PORT,
  UNPRIVILEGED_GSPRO_TARGET_PORT,
} from "./port-strategy.mjs";

test("port strategy keeps Windows/root on 921 and gives ordinary Unix users a forward target", () => {
  assert.equal(defaultGsProPort({ platform: "win32", effectiveUserId: 501 }), OFFICIAL_GSPRO_PORT);
  assert.equal(defaultGsProPort({ platform: "darwin", effectiveUserId: 0 }), OFFICIAL_GSPRO_PORT);
  assert.equal(
    defaultGsProPort({ platform: "darwin", effectiveUserId: 501 }),
    UNPRIVILEGED_GSPRO_TARGET_PORT,
  );
  assert.equal(gsProPortStatus(4921, { platform: "darwin" }).requiresForwarder, true);
});

test("loopback helper forwards a real TCP payload", async () => {
  const target = createServer((socket) => socket.on("data", (data) => socket.write(data)));
  await new Promise((resolve) => target.listen(0, "127.0.0.1", resolve));
  const targetPort = target.address().port;
  const forwarder = new LoopbackPortForwarder({ sourcePort: 0, targetPort });
  const address = await forwarder.start();
  const echoed = await new Promise((resolve, reject) => {
    const socket = connect({ host: "127.0.0.1", port: address.sourcePort }, () =>
      socket.write("gspro-shot"),
    );
    socket.once("data", (data) => {
      resolve(data.toString("utf8"));
      socket.destroy();
    });
    socket.once("error", reject);
  });
  assert.equal(echoed, "gspro-shot");
  await forwarder.stop();
  await new Promise((resolve) => target.close(resolve));
});
