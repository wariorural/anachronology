import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Rene matte-funksjoner (skala.ts/dodge.ts) trenger ingen DOM — Node holder.
    environment: "node",
    include: ["lib/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["lib/skala.ts", "lib/dodge.ts"],
      thresholds: { lines: 100, functions: 100, branches: 100, statements: 100 },
    },
  },
});
