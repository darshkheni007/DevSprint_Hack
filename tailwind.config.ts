import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef4ff",
          100: "#d9e5ff",
          200: "#bcd0ff",
          300: "#8eb0ff",
          400: "#5985ff",
          500: "#3560f5",
          600: "#2342e0",
          700: "#1c33bd",
          800: "#1c2f99",
          900: "#1c2d79",
          950: "#141c48",
        },
        ink: {
          50: "#f6f7f9",
          100: "#eceef2",
          200: "#d4d8e0",
          300: "#aab1c1",
          400: "#787f96",
          500: "#565e75",
          600: "#414659",
          700: "#333748",
          800: "#232634",
          900: "#161822",
        },
        success: { 50: "#ecfdf3", 500: "#12b76a", 600: "#039855", 700: "#027a48" },
        warn: { 50: "#fffaeb", 500: "#f79009", 600: "#dc6803", 700: "#b54708" },
        danger: { 50: "#fef3f2", 500: "#f04438", 600: "#d92d20", 700: "#b42318" },
      },
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 1px 2px 0 rgba(16,24,40,0.06), 0 1px 3px 0 rgba(16,24,40,0.10)",
        pop: "0 12px 32px -12px rgba(16,24,40,0.25)",
      },
    },
  },
  plugins: [],
};

export default config;
