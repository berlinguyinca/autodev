import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/unit/**/*.test.ts", "test/integration/**/*.test.ts"],
    environment: "node",
    passWithNoTests: true,
    coverage: {
      provider: "v8",
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
      include: [
        "src/ai/*.ts",
        "src/config/*.ts",
        "src/git/*.ts",
        "src/github/*.ts",
        "src/pipeline/*.ts",
        "src/stats/*.ts",
        "src/tui/*.ts",
      ],
      exclude: [
        "test/**",
        "src/index.ts",
        "src/ai/index.ts",
        "src/config/index.ts",
        "src/git/index.ts",
        "src/github/index.ts",
        "src/pipeline/index.ts",
        "src/stats/index.ts",
        "src/tui/index.ts",
        "src/tui/app.ts",
        "src/types/index.ts",
        "**/*.d.ts",
        "vitest.config.ts",
        "eslint.config.js",
      ],
    },
  },
});
