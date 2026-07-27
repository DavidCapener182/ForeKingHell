#!/usr/bin/env node

import { startCourseTwinBuilderServer } from "./server.mjs";

const runtime = await startCourseTwinBuilderServer();
process.stdout.write(`Course Twin Builder listening on http://${runtime.host}:${runtime.port}\n`);

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => runtime.server.close(() => process.exit(0)));
}
