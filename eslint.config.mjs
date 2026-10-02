import nextPlugin from "@next/eslint-plugin-next";
import jsxA11y from "eslint-plugin-jsx-a11y";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

import { baseConfig } from "./packages/config/eslint.base.mjs";

/**
 * Root ESLint flat config.
 *
 * `next lint` is deprecated in Next 15.5, so the web app is linted through the
 * ESLint CLI directly.
 *
 * We deliberately do NOT use `eslint-config-next`: at v15 it still ships the
 * legacy eslintrc format and boots `@rushstack/eslint-patch`, which throws
 * "Failed to patch ESLint" under ESLint 9 flat config. The standalone plugins
 * it wraps (`@next/eslint-plugin-next`, `eslint-plugin-react-hooks`) are used
 * directly instead, and pinned to match the installed Next.js version.
 *
 * Before this file existed, `pnpm lint` reported "0 tasks were executed" — there
 * was no ESLint config anywhere in the repo, while the code already carried an
 * `eslint-disable-next-line @next/next/no-img-element` directive referencing a
 * linter that was never installed.
 */
export default [
  ...baseConfig,

  {
    files: ["apps/api/**/*.ts", "packages/**/*.ts", "**/*.mjs"],
    languageOptions: {
      globals: { ...globals.node },
    },
  },

  {
    // Browser code: the Next.js app.
    files: ["apps/web/**/*.{ts,tsx}"],
    plugins: {
      "@next/next": nextPlugin,
      react,
      "react-hooks": reactHooks,
      "jsx-a11y": jsxA11y,
    },
    settings: {
      react: { version: "detect" },
    },
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.configs.recommended.rules,
      // Next.js compiles with the automatic JSX runtime (React 17+), so the
      // classic-runtime rules are inapplicable.
      "react/react-in-jsx-scope": "off",
      "react/react-jsx-filename-extension": "off",
      // Not in the React recommended set, but the app injects JSON-LD via
      // dangerouslySetInnerHTML, so every use must be deliberate and reviewed.
      "react/no-danger": "error",
    },
  },

  {
    // Tests and build config may be looser about types.
    files: ["**/*.spec.ts", "**/*.int.spec.ts", "**/*.test.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unsafe-function-type": "off",
    },
  },
];