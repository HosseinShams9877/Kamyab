import type { Config } from "tailwindcss";

// Design tokens are defined once here and mirrored as CSS variables in globals.css.
// Keep the two in sync: Tailwind utilities read these names, raw CSS reads the vars.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#0F766E",
          hover: "#0D9488",
          light: "#CCFBF1",
          dark: "#115E59",
        },
        page: "#F8FAFC",
        card: "#FFFFFF",
        border: "#E2E8F0",
        text: {
          DEFAULT: "#0F172A",
          secondary: "#64748B",
        },
        success: { DEFAULT: "#059669", bg: "#D1FAE5" },
        error: { DEFAULT: "#DC2626", bg: "#FEE2E2" },
        warning: { DEFAULT: "#D97706", bg: "#FEF3C7" },
        info: { DEFAULT: "#2563EB", bg: "#DBEAFE" },
        disabled: { DEFAULT: "#64748B", bg: "#F1F5F9" },
      },
      borderRadius: {
        card: "14px", // cards 12-16px
        control: "8px", // buttons / badges
        badge: "9999px", // status badges fully rounded
      },
      boxShadow: {
        // deliberately very subtle
        card: "0 1px 2px 0 rgba(15, 23, 42, 0.04), 0 1px 3px 0 rgba(15, 23, 42, 0.06)",
      },
      fontFamily: {
        sans: ["var(--font-vazirmatn)", "Vazirmatn", "Tahoma", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
