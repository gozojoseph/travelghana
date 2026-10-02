import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.int.spec.ts"],
    environment: "node",
    testTimeout: 60_000,
    hookTimeout: 300_000,
    globalSetup: "./test/global-setup.ts",
  },
});
