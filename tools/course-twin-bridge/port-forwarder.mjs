import { createServer, connect } from "node:net";

import { assertLoopbackHost } from "./security.mjs";

export class LoopbackPortForwarder {
  #host;
  #sourcePort;
  #targetPort;
  #server = null;
  #sockets = new Set();

  constructor({ host = "127.0.0.1", sourcePort = 921, targetPort = 4921 } = {}) {
    assertLoopbackHost(host);
    validatePort(sourcePort, "sourcePort");
    validatePort(targetPort, "targetPort");
    if (sourcePort === targetPort) throw new Error("Forwarder ports must be different.");
    this.#host = host;
    this.#sourcePort = sourcePort;
    this.#targetPort = targetPort;
  }

  async start() {
    if (this.#server) return this.address;
    this.#server = createServer((incoming) => {
      if (incoming.remoteAddress && !isLoopback(incoming.remoteAddress)) {
        incoming.destroy();
        return;
      }
      const outgoing = connect({ host: this.#host, port: this.#targetPort });
      this.#sockets.add(incoming);
      this.#sockets.add(outgoing);
      incoming.setNoDelay(true);
      outgoing.setNoDelay(true);
      incoming.pipe(outgoing);
      outgoing.pipe(incoming);
      const close = () => {
        this.#sockets.delete(incoming);
        this.#sockets.delete(outgoing);
        incoming.destroy();
        outgoing.destroy();
      };
      incoming.on("error", close);
      outgoing.on("error", close);
      incoming.on("close", close);
      outgoing.on("close", close);
    });
    await new Promise((resolve, reject) => {
      this.#server.once("error", reject);
      this.#server.listen(this.#sourcePort, this.#host, resolve);
    });
    return this.address;
  }

  get address() {
    const sourcePort = this.#server?.address()?.port ?? this.#sourcePort;
    return { host: this.#host, sourcePort, targetPort: this.#targetPort };
  }

  async stop() {
    for (const socket of this.#sockets) socket.destroy();
    this.#sockets.clear();
    const server = this.#server;
    this.#server = null;
    if (!server) return;
    await new Promise((resolve) => server.close(resolve));
  }
}

function validatePort(port, name) {
  if (!Number.isInteger(port) || port < 0 || port > 65_535) {
    throw new Error(`${name} must be a valid TCP port.`);
  }
}

function isLoopback(address) {
  return address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1";
}
