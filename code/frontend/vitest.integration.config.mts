import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Integration tests run server actions against a real Postgres. They share
// one database, so files run one after another. See tests/integration/setup.ts.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    include: ["tests/integration/**/*.test.ts"],
    environment: "node",
    setupFiles: ["tests/integration/setup.ts"],
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
