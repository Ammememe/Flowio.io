import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // `test/` holds vitest unit/replay tests (P4-2); `tests/` holds the P2-8
    // Playwright visual specs, which use a different `test()` API and must
    // not be picked up here (vitest's default include glob matches both).
    include: ["test/**/*.test.ts"],
  },
});
