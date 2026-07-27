import { createServer as createHttpServer } from "node:http";
import { createServer as createTcpServer } from "node:net";
import { randomUUID } from "node:crypto";
import { WebSocketServer, WebSocket } from "ws";
import {
  BridgeProtocolError,
  JsonObjectStream,
  gsProResponse,
  validateGsProMessage,
} from "./protocol.mjs";
import {
  FixedWindowRateLimiter,
  PairingAuthority,
  assertLoopbackHost,
  parseAllowedOrigins,
} from "./security.mjs";
import { createBridgeDiagnosticReport } from "./diagnostics.mjs";

const MAX_HTTP_BODY_BYTES = 4 * 1024;
const MAX_WS_CLIENTS = 4;

export class CourseTwinBridge {
  #host;
  #gsProPort;
  #browserPort;
  #allowedOrigins;
  #pairing;
  #tcpServer;
  #httpServer;
  #webSocketServer;
  #launchSockets = new Set();
  #browserSockets = new Set();
  #pairRateLimit = new FixedWindowRateLimiter({ limit: 6, windowMs: 60_000 });
  #tcpRateLimit = new FixedWindowRateLimiter({ limit: 120, windowMs: 60_000 });
  #startedAt = null;
  #lastDeviceId = null;
  #lastShotAt = null;
  #shotsAccepted = 0;
  #shotsRejected = 0;
  #clubShotsAccepted = 0;
  #playerUpdatesSent = 0;

  constructor({
    host = "127.0.0.1",
    gsProPort = 921,
    browserPort = 9791,
    allowedOrigins = parseAllowedOrigins(process.env.FKH_BRIDGE_ALLOWED_ORIGINS),
    pairingAuthority = new PairingAuthority(),
  } = {}) {
    assertLoopbackHost(host);
    this.#host = host;
    this.#gsProPort = gsProPort;
    this.#browserPort = browserPort;
    this.#allowedOrigins = allowedOrigins;
    this.#pairing = pairingAuthority;
  }

  get pairingCode() {
    return this.#pairing.pairingCode;
  }

  get addresses() {
    return {
      host: this.#host,
      gsProPort: this.#tcpServer?.address()?.port ?? this.#gsProPort,
      browserPort: this.#httpServer?.address()?.port ?? this.#browserPort,
    };
  }

  get diagnostics() {
    return {
      status: this.#startedAt ? "running" : "stopped",
      startedAt: this.#startedAt,
      gsProConnected: this.#launchSockets.size > 0,
      browserClients: this.#browserSockets.size,
      lastDeviceId: this.#lastDeviceId,
      lastShotAt: this.#lastShotAt,
      shotsAccepted: this.#shotsAccepted,
      shotsRejected: this.#shotsRejected,
      clubShotsAccepted: this.#clubShotsAccepted,
      playerUpdatesSent: this.#playerUpdatesSent,
    };
  }

  async start() {
    if (this.#startedAt) return this.addresses;
    this.#tcpServer = createTcpServer((socket) => this.#handleLaunchMonitor(socket));
    this.#httpServer = createHttpServer((request, response) => this.#handleHttp(request, response));
    this.#webSocketServer = new WebSocketServer({
      noServer: true,
      maxPayload: MAX_HTTP_BODY_BYTES,
    });
    this.#httpServer.on("upgrade", (request, socket, head) =>
      this.#handleUpgrade(request, socket, head),
    );

    try {
      await Promise.all([
        listen(this.#tcpServer, this.#gsProPort, this.#host),
        listen(this.#httpServer, this.#browserPort, this.#host),
      ]);
      this.#startedAt = new Date().toISOString();
      return this.addresses;
    } catch (error) {
      await this.stop();
      throw error;
    }
  }

  async stop() {
    for (const socket of this.#browserSockets) socket.close(1001, "Bridge stopping");
    for (const socket of this.#launchSockets) socket.destroy();
    this.#browserSockets.clear();
    this.#launchSockets.clear();

    const servers = [this.#webSocketServer, this.#httpServer, this.#tcpServer];
    this.#webSocketServer = null;
    this.#httpServer = null;
    this.#tcpServer = null;
    await Promise.all(servers.map((server) => closeServer(server)));
    this.#startedAt = null;
  }

  #handleLaunchMonitor(socket) {
    if (socket.remoteAddress && !isLoopbackAddress(socket.remoteAddress)) {
      socket.destroy();
      return;
    }

    socket.setNoDelay(true);
    socket.setTimeout(2 * 60_000);
    this.#launchSockets.add(socket);
    const parser = new JsonObjectStream();
    const rateKey = socket.remoteAddress ?? "loopback";

    socket.on("data", (chunk) => {
      if (!this.#tcpRateLimit.accept(rateKey)) {
        this.#shotsRejected += 1;
        socket.write(gsProResponse(429, "Bridge rate limit exceeded"));
        return;
      }

      try {
        for (const rawMessage of parser.push(chunk)) {
          const message = validateGsProMessage(rawMessage);
          this.#lastDeviceId = message.deviceId;

          if (message.kind === "heartbeat") {
            socket.write(gsProResponse(200, "Heartbeat received"));
            this.#broadcast({ type: "launch-monitor-status", connected: true, ...message });
            continue;
          }

          const event = {
            type: "shot",
            eventId: randomUUID(),
            receivedAt: new Date().toISOString(),
            source: "gspro-open-connect-v1",
            shot: message,
          };
          this.#shotsAccepted += 1;
          if (message.club) this.#clubShotsAccepted += 1;
          this.#lastShotAt = event.receivedAt;
          socket.write(gsProResponse(200, "Shot received"));
          this.#broadcast(event);
        }
      } catch (error) {
        this.#shotsRejected += 1;
        const message =
          error instanceof BridgeProtocolError ? error.message : "Shot could not be processed.";
        socket.write(gsProResponse(400, message));
        if (error instanceof BridgeProtocolError && error.code === "message_too_large")
          socket.destroy();
      }
    });

    socket.on("timeout", () => socket.destroy());
    socket.on("close", () => {
      parser.reset();
      this.#launchSockets.delete(socket);
      this.#broadcast({ type: "launch-monitor-status", connected: this.#launchSockets.size > 0 });
    });
    socket.on("error", () => {});
  }

  async #handleHttp(request, response) {
    const origin = request.headers.origin;
    if (request.method === "GET" && request.url === "/health") {
      if (origin && !this.#allowedOrigins.has(origin))
        return sendJson(response, 403, { error: "origin_not_allowed" });
      setCors(response, origin);
      return sendJson(response, 200, {
        bridge: "ForeKingHell Course Twin",
        protocolVersion: 1,
        ...this.diagnostics,
      });
    }

    if (request.method === "GET" && request.url === "/diagnostics") {
      if (origin && !this.#allowedOrigins.has(origin))
        return sendJson(response, 403, { error: "origin_not_allowed" });
      setCors(response, origin);
      response.setHeader("Content-Disposition", 'attachment; filename="course-twin-bridge.json"');
      return sendJson(
        response,
        200,
        createBridgeDiagnosticReport({ addresses: this.addresses, state: this.diagnostics }),
      );
    }

    if (
      request.method === "OPTIONS" &&
      (request.url === "/pair" || request.url === "/health" || request.url === "/diagnostics")
    ) {
      if (!origin || !this.#allowedOrigins.has(origin))
        return sendJson(response, 403, { error: "origin_not_allowed" });
      setCors(response, origin);
      response.writeHead(204);
      return response.end();
    }

    if (request.method !== "POST" || request.url !== "/pair") {
      return sendJson(response, 404, { error: "not_found" });
    }
    if (!origin || !this.#allowedOrigins.has(origin))
      return sendJson(response, 403, { error: "origin_not_allowed" });
    if (!this.#pairRateLimit.accept(request.socket.remoteAddress ?? "loopback")) {
      return sendJson(response, 429, { error: "rate_limited" });
    }

    setCors(response, origin);
    try {
      const body = await readJsonBody(request);
      const result = this.#pairing.pair(body.code);
      if (!result) return sendJson(response, 401, { error: "invalid_pairing_code" });
      return sendJson(response, 200, {
        token: result.token,
        expiresAt: new Date(result.expiresAt).toISOString(),
        wsUrl: `ws://${this.#host}:${this.addresses.browserPort}/shots`,
      });
    } catch (error) {
      return sendJson(response, error.code === "body_too_large" ? 413 : 400, {
        error: error.code ?? "invalid_json",
      });
    }
  }

  #handleUpgrade(request, socket, head) {
    const origin = request.headers.origin;
    const protocols = parseProtocols(request.headers["sec-websocket-protocol"]);
    const tokenProtocol = protocols.find((protocol) => protocol.startsWith("fkh-token."));
    const token = tokenProtocol?.slice("fkh-token.".length);

    if (
      request.url !== "/shots" ||
      !origin ||
      !this.#allowedOrigins.has(origin) ||
      !protocols.includes("fkh-course-twin-v1") ||
      !this.#pairing.verify(token) ||
      this.#browserSockets.size >= MAX_WS_CLIENTS
    ) {
      socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
      socket.destroy();
      return;
    }

    this.#webSocketServer.handleUpgrade(request, socket, head, (webSocket) => {
      webSocket.protocolToken = token;
      this.#webSocketServer.emit("connection", webSocket, request);
      this.#handleBrowserSocket(webSocket);
    });
  }

  #handleBrowserSocket(socket) {
    this.#browserSockets.add(socket);
    socket.send(
      JSON.stringify({
        type: "bridge-status",
        connected: true,
        launchMonitorConnected: this.#launchSockets.size > 0,
        diagnostics: this.diagnostics,
      }),
    );

    socket.on("message", (raw) => {
      if (raw.length > MAX_HTTP_BODY_BYTES) return socket.close(1009, "Message too large");
      let message;
      try {
        message = JSON.parse(raw.toString("utf8"));
      } catch {
        return socket.close(1007, "Invalid JSON");
      }

      if (
        message?.type === "ack" &&
        typeof message.eventId === "string" &&
        message.eventId.length <= 64
      )
        return;
      if (
        message?.type === "player" &&
        (message.handed === "RH" || message.handed === "LH") &&
        isClubCode(message.club)
      ) {
        const response = gsProResponse(201, "Player information", {
          Handed: message.handed,
          Club: message.club,
        });
        for (const launchSocket of this.#launchSockets) launchSocket.write(response);
        this.#playerUpdatesSent += 1;
        return;
      }
      socket.close(1008, "Unsupported message");
    });
    socket.on("close", () => {
      this.#browserSockets.delete(socket);
    });
    socket.on("error", () => {});
  }

  #broadcast(message) {
    const payload = JSON.stringify(message);
    for (const socket of this.#browserSockets) {
      if (socket.readyState === WebSocket.OPEN) socket.send(payload);
    }
  }
}

function listen(server, port, host) {
  return new Promise((resolve, reject) => {
    const onError = (error) => reject(error);
    server.once("error", onError);
    server.listen(port, host, () => {
      server.off("error", onError);
      resolve();
    });
  });
}

function closeServer(server) {
  if (!server) return Promise.resolve();
  if (typeof server.closeAllConnections === "function") server.closeAllConnections();
  return new Promise((resolve) => server.close(() => resolve())).catch(() => {});
}

function isLoopbackAddress(address) {
  return address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1";
}

function parseProtocols(header) {
  if (typeof header !== "string") return [];
  return header
    .split(",")
    .map((protocol) => protocol.trim())
    .filter(Boolean);
}

function isClubCode(value) {
  return typeof value === "string" && /^[A-Z0-9]{1,4}$/.test(value);
}

function setCors(response, origin) {
  if (!origin) return;
  response.setHeader("Access-Control-Allow-Origin", origin);
  response.setHeader("Vary", "Origin");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
}

function sendJson(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(body));
}

async function readJsonBody(request) {
  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > MAX_HTTP_BODY_BYTES) {
      const error = new Error("Request body too large");
      error.code = "body_too_large";
      throw error;
    }
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
