import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "var(--color-brand-red)",
          hover: "var(--color-brand-red-hover)",
          active: "var(--color-brand-red-active)",
          soft: "var(--color-brand-red-soft)",
        },
        ink: {
          black: "var(--color-black)",
          900: "var(--color-gray-900)",
          800: "var(--color-gray-800)",
          600: "var(--color-gray-600)",
          400: "var(--color-gray-400)",
          300: "var(--color-gray-300)",
          200: "var(--color-gray-200)",
          100: "var(--color-gray-100)",
          50: "var(--color-gray-50)",
        },
        success: "var(--color-success)",
        warning: "var(--color-warning)",
        danger: "var(--color-error)",
        info: "var(--color-info)",
      },
      fontFamily: {
        sans: [
          "Inter",
          "Univers Next",
          "Helvetica Neue",
          "Arial",
          "PingFang SC",
          "Microsoft YaHei",
          "sans-serif",
        ],
        mono: ["JetBrains Mono", "SFMono-Regular", "Consolas", "monospace"],
      },
      borderRadius: {
        sm: "2px",
        DEFAULT: "4px",
      },
      boxShadow: {
        elev1: "0 1px 2px rgba(16,24,40,0.06)",
        elev2: "0 2px 8px rgba(16,24,40,0.08)",
        elev3: "0 8px 24px rgba(16,24,40,0.12)",
      },
      maxWidth: {
        page: "1280px",
      },
    },
  },
  plugins: [],
} satisfies Config;
