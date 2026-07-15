import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    globalSetup: ["./tests/unit/global-setup.ts"],
    setupFiles: ["./tests/unit/setup.ts"],
    include: ["tests/unit/**/*.test.{ts,tsx}"],
    // PGlite (the local prisma dev server) only supports one concurrent
    // connection. Running test files in parallel workers causes
    // intermittent connection contention against it. Real Postgres (CI)
    // doesn't have this limitation, but running files sequentially there
    // too is a small, acceptable cost for consistent behavior everywhere.
    fileParallelism: false,
  },
});
