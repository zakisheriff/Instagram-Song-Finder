import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.{ts,tsx}"],
    exclude: ["tests/e2e/**", "node_modules/**"],
    setupFiles: ["tests/unit/setup.ts"],
    restoreMocks: true,
    unstubGlobals: true,
    unstubEnvs: true,
  },
});
