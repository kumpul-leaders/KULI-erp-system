import { defineConfig } from "vitest/config"
import tsconfigPaths from "vite-tsconfig-paths"

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["src/**/__tests__/**/*.test.ts"],
    // No global setup needed — pure unit tests against Zod schemas
  },
})
