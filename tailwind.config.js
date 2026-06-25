/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Primary — Muted Teal
        brand: {
          50:  "#f0fdfa",
          100: "#ccfbf1",
          200: "#99f6e4",
          300: "#5eead4",
          400: "#2dd4bf",
          500: "#0d9488",
          600: "#0f766e",
          700: "#115e59",
          800: "#134e4a",
          900: "#042f2e",
          950: "#021a19",
        },
        // Gold accent
        gold: {
          50:  "#fdf8ed",
          100: "#f8edd0",
          200: "#f0d89e",
          300: "#e8cc73",
          400: "#d4a84b",
          500: "#b8860b",
          600: "#996515",
          700: "#7a4f12",
          800: "#5c3b0e",
          900: "#3d280a",
          950: "#1f1405",
        },
        // Surface — Light
        surface: {
          50:  "#f5f5f7",
          100: "#ffffff",
          900: "#1a1a2e",
          950: "#111118",
          bg:       "#f5f5f7",
          card:     "#ffffff",
          elevated: "#ffffff",
          border:   "#e5e5ea",
          glow:     "rgba(13, 148, 136, 0.06)",
        },
        // Semantic
        success: { 400: "#22c55e", 500: "#16a34a", 600: "#15803d" },
        warning: { 400: "#eab308", 500: "#d97706", 600: "#b45309" },
        danger:  { 400: "#ef4444", 500: "#dc2626", 600: "#b91c1c" },
        info:    { 400: "#0ea5e9", 500: "#0284c7", 600: "#0369a1" },
        // Neutral — Light grays
        neutral: {
          50:  "#fafafa",
          100: "#f5f5f5",
          200: "#e5e5e5",
          300: "#d4d4d4",
          400: "#a3a3a3",
          500: "#737373",
          600: "#525252",
          700: "#404040",
          800: "#262626",
          900: "#171717",
          950: "#0a0a0a",
        },
      },
      fontFamily: {
        sans:    ["PlusJakartaSans-Regular", "System", "sans-serif"],
        display: ["PlusJakartaSans-Regular", "System", "sans-serif"],
        mono:    ["JetBrains Mono", "Menlo", "monospace"],
      },
      borderRadius: {
        "4xl": "2rem",
        "5xl": "2.5rem",
      },
      spacing: {
        "safe-top":    "env(safe-area-inset-top)",
        "safe-bottom": "env(safe-area-inset-bottom)",
      },
      boxShadow: {
        "card-sm": "0 1px 3px rgba(0, 0, 0, 0.06)",
        "card":    "0 2px 8px rgba(0, 0, 0, 0.08)",
        "card-lg": "0 4px 12px rgba(0, 0, 0, 0.1)",
        "gold":    "0 2px 6px rgba(184, 134, 11, 0.08)",
      },
    },
  },
  plugins: [],
};
