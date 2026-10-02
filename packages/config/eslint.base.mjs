import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

/**
 * Shared ESLint base for every TravelGhana workspace (D7 — packages/config holds
 * shared tooling config).
 *
 * Scope is deliberately "correctness, not style". Enabling the full stylistic
 * rule set would bury real defects under thousands of formatting nits on day
 * one; the goal is a lint task that actually fails on bugs.
 */
export const baseConfig = tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/.turbo/**",
      "**/src/generated/**",
      "**/coverage/**",
      "**/*.tsbuildinfo",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      // Unused args prefixed with _ are the deliberate convention here.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // The domain is money-, date- and token-heavy; floating point on money
      // amounts is a real defect class (D8), so ban it outright.
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
);