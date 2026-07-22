import type { Instrumentation } from "next";
import { registerOTel } from "@vercel/otel";

import { assertProductionEnvironment } from "@/lib/runtime-env";

export function register() {
  registerOTel({ serviceName: "forekinghell-web" });

  if (process.env.NEXT_RUNTIME === "nodejs") {
    assertProductionEnvironment();
  }
}

export const onRequestError: Instrumentation.onRequestError = (error, request, context) => {
  const digest =
    typeof error === "object" && error !== null && "digest" in error
      ? String(error.digest)
      : undefined;

  console.error(
    JSON.stringify({
      event: "server_request_error",
      path: request.path.split("?")[0],
      method: request.method,
      routePath: context.routePath,
      routeType: context.routeType,
      digest,
    }),
  );
};
