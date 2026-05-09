import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["__tests__/**/*.test.{ts,tsx}"],
    // PGlite WASM instances collide when too many run concurrently.
    // Cap the thread pool so total memory pressure stays bounded.
    pool: "threads",
    poolOptions: {
      threads: { maxThreads: 4, minThreads: 1 },
    },
  },
  esbuild: {
    jsx: "automatic",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
