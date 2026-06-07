// src/constants/theme.ts
// Single source of truth for all design tokens used in JS/TS

export const COLORS = {
  brandPrimary: "#6f5eff",
  goldPrimary: "#f59e0b",
  // Brand
  brand: {
    50:  "#f0eeff",
    100: "#e0ddff",
    200: "#c4beff",
    300: "#a79eff",
    400: "#8b7eff",
    500: "#6f5eff",
    600: "#5a47e0",
    700: "#4535bd",
    800: "#31259a",
    900: "#1e1677",
    950: "#0d0944",
  },
  gold: {
    300: "#fcd34d",
    400: "#fbbf24",
    500: "#f59e0b",
    600: "#d97706",
  },
  surface: {
    bg:       "#0f0d23",
    card:     "#1a1640",
    elevated: "#231f52",
    border:   "rgba(111,94,255,0.15)",
    glow:     "rgba(111,94,255,0.40)",
  },
  text: {
    primary:   "#f5f5f5",
    secondary: "#a3a3a3",
    muted:     "#525252",
    inverse:   "#0f0d23",
  },
  success: { light: "#4ade80", DEFAULT: "#22c55e", dark: "#16a34a" },
  warning: { light: "#fb923c", DEFAULT: "#f97316", dark: "#ea580c" },
  danger:  { light: "#f87171", DEFAULT: "#ef4444", dark: "#dc2626" },
  info:    { light: "#38bdf8", DEFAULT: "#0ea5e9", dark: "#0284c7" },
  white: "#ffffff",
  black: "#000000",
  transparent: "transparent",
} as const;

export const GRADIENTS = {
  brandPrimary:  ["#6f5eff", "#4535bd"],
  brandGlow:     ["#8b7eff", "#6f5eff", "#4535bd"],
  goldAccent:    ["#fbbf24", "#f59e0b"],
  darkCard:      ["#1a1640", "#0f0d23"],
  darkElevated:  ["#231f52", "#1a1640"],
  successGreen:  ["#4ade80", "#22c55e"],
  dangerRed:     ["#f87171", "#ef4444"],
  hero:          ["#1e1677", "#0f0d23"],
} as const;

export const FONT_SIZE = {
  xs:   11,
  sm:   13,
  base: 15,
  md:   16,
  lg:   18,
  xl:   20,
  "2xl": 24,
  "3xl": 30,
  "4xl": 36,
  "5xl": 48,
} as const;

export const FONT_WEIGHT = {
  normal:    "400",
  medium:    "500",
  semibold:  "600",
  bold:      "700",
  extrabold: "800",
} as const;

export const SPACING = {
  0:   0,
  0.5: 2,
  1:   4,
  1.5: 6,
  2:   8,
  2.5: 10,
  3:   12,
  4:   16,
  5:   20,
  6:   24,
  7:   28,
  8:   32,
  9:   36,
  10:  40,
  12:  48,
  14:  56,
  16:  64,
  20:  80,
  24:  96,
} as const;

export const BORDER_RADIUS = {
  sm:   6,
  md:   10,
  lg:   14,
  xl:   18,
  "2xl": 22,
  "3xl": 28,
  full: 9999,
} as const;

export const SHADOWS = {
  card: {
    shadowColor:   "#6f5eff",
    shadowOffset:  { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius:  16,
    elevation:     6,
  },
  cardSm: {
    shadowColor:   "#6f5eff",
    shadowOffset:  { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius:  8,
    elevation:     3,
  },
  gold: {
    shadowColor:   "#f59e0b",
    shadowOffset:  { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius:  12,
    elevation:     5,
  },
} as const;

export const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 } as const;
