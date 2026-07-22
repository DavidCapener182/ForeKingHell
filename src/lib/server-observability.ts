import "server-only";

import { SpanStatusCode, trace } from "@opentelemetry/api";

type SafeAttributeValue = string | number | boolean;

export type ServerOperationTelemetry = {
  setRowCount: (count: number) => void;
  setResult: (result: "ok" | "empty" | "partial") => void;
};

export async function observeServerOperation<T>(
  name: string,
  attributes: Record<string, SafeAttributeValue>,
  operation: (telemetry: ServerOperationTelemetry) => Promise<T>,
) {
  const safeName = safeOperationName(name);
  const startedAt = performance.now();

  return trace.getTracer("forekinghell-server").startActiveSpan(safeName, async (span) => {
    for (const [key, value] of Object.entries(attributes)) {
      if (isSafeAttributeKey(key)) span.setAttribute(key, safeAttributeValue(value));
    }

    let rowCount: number | null = null;
    let result: "ok" | "empty" | "partial" = "ok";
    const telemetry: ServerOperationTelemetry = {
      setRowCount(count) {
        rowCount = Math.max(0, Math.floor(count));
        span.setAttribute("db.row_count", rowCount);
      },
      setResult(nextResult) {
        result = nextResult;
        span.setAttribute("app.result", nextResult);
      },
    };

    try {
      const value = await operation(telemetry);
      span.setStatus({ code: SpanStatusCode.OK });
      emitOperationLog(safeName, performance.now() - startedAt, result, rowCount);
      return value;
    } catch (error) {
      span.setStatus({ code: SpanStatusCode.ERROR });
      span.setAttribute("error.type", safeErrorType(error));
      emitOperationLog(safeName, performance.now() - startedAt, "error", rowCount);
      throw error;
    } finally {
      span.end();
    }
  });
}

export function reportServerFailure(
  event: string,
  error: unknown,
  attributes: Record<string, SafeAttributeValue> = {},
) {
  const safeEvent = safeOperationName(event);

  console.warn(
    JSON.stringify({
      event: safeEvent,
      errorType: safeErrorType(error),
      ...safeAttributes(attributes),
    }),
  );
}

export function reportServerEvent(
  event: string,
  attributes: Record<string, SafeAttributeValue> = {},
) {
  console.info(
    JSON.stringify({
      event: safeOperationName(event),
      ...safeAttributes(attributes),
    }),
  );
}

function emitOperationLog(
  operation: string,
  durationMs: number,
  result: "ok" | "empty" | "partial" | "error",
  rowCount: number | null,
) {
  if (process.env.SERVER_TIMING_LOGS !== "1" && durationMs < 500) return;

  console.info(
    JSON.stringify({
      event: "server_operation",
      operation,
      durationMs: Math.round(durationMs * 10) / 10,
      result,
      ...(rowCount === null ? {} : { rowCount }),
    }),
  );
}

function safeOperationName(value: string) {
  return /^[a-z0-9_.-]{1,80}$/i.test(value) ? value : "server.operation";
}

function isSafeAttributeKey(value: string) {
  return /^(app|db|provider|job)\.[a-z0-9_.-]{1,60}$/i.test(value);
}

function safeAttributeValue(value: SafeAttributeValue): SafeAttributeValue {
  return typeof value === "string" ? value.slice(0, 120) : value;
}

function safeAttributes(attributes: Record<string, SafeAttributeValue>) {
  return Object.fromEntries(
    Object.entries(attributes).flatMap(([key, value]) =>
      isSafeAttributeKey(key) ? [[key, safeAttributeValue(value)]] : [],
    ),
  );
}

function safeErrorType(error: unknown) {
  if (error instanceof Error && /^[A-Za-z][A-Za-z0-9_.-]{0,79}$/.test(error.name)) {
    return error.name;
  }
  return "UnknownError";
}
