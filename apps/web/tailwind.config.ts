import type { Config } from "tailwindcss";

/**
 * Design tokens live in packages/ui/src/tokens.ts (source of truth).
 * Values below are kept in sync with it — single source migration planned
 * when the design system matures.
 */
const config: Config = {
  content: [
    "./src/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "var(--tg-primary)",
          foreground: "#FFFFFF",
        },
        secondary: {
          DEFAULT: "var(--tg-secondary)",
          foreground: "var(--tg-text-primary)",
        },
        accent: {
          DEFAULT: "var(--tg-accent)",
          foreground: "#FFFFFF",
        },
        background: "var(--tg-background)",
        foreground: "var(--tg-text-primary)",
        muted: {
          DEFAULT: "var(--tg-muted)",
          foreground: "var(--tg-text-secondary)",
        },
        card: {
          DEFAULT: "var(--tg-card)",
          foreground: "var(--tg-text-primary)",
        },
        border: "var(--tg-border)",
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        display: ["var(--font-display)"],
      },
      borderRadius: {
        card: "0.75rem",
      },
    },
  },
  plugins: [],
};

export default config;
