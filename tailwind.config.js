/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Primary brand — deep violet/indigo
        brand: {
          50:  "#f0eeff",
          100: "#e0ddff",
          200: "#c4beff",
          300: "#a79eff",
          400: "#8b7eff",
          500: "#6f5eff",   // primary
          600: "#5a47e0",
          700: "#4535bd",
          800: "#31259a",
          900: "#1e1677",
          950: "#0d0944",
        },
        // Gold accent — for highlights, badges, payout
        gold: {
          50:  "#fffbeb",
          100: "#fef3c7",
          200: "#fde68a",
          300: "#fcd34d",
          400: "#fbbf24",
          500: "#f59e0b",   // primary gold
          600: "#d97706",
          700: "#b45309",
          800: "#92400e",
          900: "#78350f",
        },
        // Surface / dark backgrounds
        surface: {
          50:  "#f8f7ff",
          100: "#f0effe",
          900: "#0f0d23",   // deepest bg
          950: "#07061a",
          bg:       "#0f0d23",
          card:     "#1a1640",
          elevated: "#231f52",
          border:   "rgba(111,94,255,0.15)",
          glow:     "rgba(111,94,255,0.40)",
        },
        // Semantic
        success: { 400: "#4ade80", 500: "#22c55e", 600: "#16a34a" },
        warning: { 400: "#fb923c", 500: "#f97316", 600: "#ea580c" },
        danger:  { 400: "#f87171", 500: "#ef4444", 600: "#dc2626" },
        info:    { 400: "#38bdf8", 500: "#0ea5e9", 600: "#0284c7" },
        // Neutral
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
        sans:    ["Inter", "system-ui", "sans-serif"],
        display: ["Inter", "system-ui", "sans-serif"],
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
        "card-sm": "0 2px 12px rgba(111, 94, 255, 0.10)",
        "card":    "0 4px 24px rgba(111, 94, 255, 0.15)",
        "card-lg": "0 8px 40px rgba(111, 94, 255, 0.22)",
        "gold":    "0 4px 20px rgba(245, 158, 11, 0.25)",
      },
    },
  },
  plugins: [],
};