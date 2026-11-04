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
        footer: {
          DEFAULT: "var(--tg-footer)",
          foreground: "var(--tg-footer-foreground)",
          muted: "var(--tg-footer-muted)",
          border: "var(--tg-footer-border)",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        display: ["var(--font-display)"],
      },
      borderRadius: {
        card: "0.75rem",
      },
      keyframes: {
        "tg-fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "tg-rise": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "tg-pop": {
          from: { opacity: "0", transform: "scale(0.97)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        /* `backwards` (not `both`) so finished animations stop overriding
         * hover transforms on the same element. */
        "fade-in": "tg-fade-in 0.3s ease-out backwards",
        rise: "tg-rise 0.45s cubic-bezier(0.16, 1, 0.3, 1) backwards",
        pop: "tg-pop 0.25s cubic-bezier(0.16, 1, 0.3, 1) backwards",
      },
    },
  },
  plugins: [],
};

export default config;
