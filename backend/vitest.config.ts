import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    globals: true,
  },
  // Respect CommonJS + TS path resolution used by the backend.
  esbuild: {
    target: "es2022",
  },
});