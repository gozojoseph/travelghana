import { defineConfig } from "vitest/config";

import { swcDecorators } from "./vitest.shared";

export default defineConfig({
  ...swcDecorators,
  test: {
    include: ["src/**/*.spec.ts"],
    environment: "node",
  },
});