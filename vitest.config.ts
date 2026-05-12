import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(dirname, "src"),
      "server-only": path.resolve(dirname, "src/test/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    exclude: ["node_modules/**", ".next/**", "tests/e2e/**"],
  },
});
