import { defineConfig } from "vitest/config";

import { swcDecorators } from "./vitest.shared";

export default defineConfig({
  ...swcDecorators,
  test: {
    include: ["test/**/*.int.spec.ts"],
    environment: "node",
    testTimeout: 60_000,
    hookTimeout: 300_000,
    globalSetup: "./test/global-setup.ts",
  },
});