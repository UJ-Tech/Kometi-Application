// src/constants/theme.ts
// Warm, premium palette — fintech with soul.

export const COLORS = {
  // Brand — Deep Indigo / Navy
  brand: {
    50:  "#eef2ff",
    100: "#e0e7ff",
    200: "#c7d2fe",
    300: "#a5b4fc",
    400: "#818cf8",
    500: "#6366f1",
    600: "#4f46e5",
    700: "#4338ca",
    800: "#3730a3",
    900: "#312e81",
    950: "#1e1b4b",
  },
  brandPrimary: "#4f46e5",

  // Accent — Warm Amber / Gold
  gold: {
    50:  "#fffbeb",
    100: "#fef3c7",
    200: "#fde68a",
    300: "#fcd34d",
    400: "#fbbf24",
    500: "#f59e0b",
    600: "#d97706",
    700: "#b45309",
    800: "#92400e",
    900: "#78350f",
  },
  goldPrimary: "#f59e0b",

  // Surface — Warm off-white tones
  surface: {
    bg:       "#faf8f5",
    card:     "#ffffff",
    elevated: "#ffffff",
    border:   "#e8e4df",
    glow:     "rgba(79, 70, 229, 0.06)",
    warm:     "#f5f0eb",
  },
  text: {
    primary:   "#1c1917",
    secondary: "#78716c",
    muted:     "#a8a29e",
    inverse:   "#ffffff",
  },
  success: { light: "#16a34a", DEFAULT: "#22c55e", dark: "#15803d" },
  warning: { light: "#d97706", DEFAULT: "#f59e0b", dark: "#b45309" },
  danger:  { light: "#dc2626", DEFAULT: "#ef4444", dark: "#b91c1c" },
  info:    { light: "#0284c7", DEFAULT: "#0ea5e9", dark: "#0369a1" },
  white: "#ffffff",
  black: "#000000",
  transparent: "transparent",
} as const;

export const GRADIENTS = {
  brandPrimary:  ["#6366f1", "#4f46e5"],
  brandGlow:     ["#818cf8", "#6366f1", "#4f46e5"],
  goldAccent:    ["#fbbf24", "#f59e0b", "#d97706"],
  darkCard:      ["#1c1c27", "#111118"],
  darkElevated:  ["#232332", "#1c1c27"],
  successGreen:  ["#4ade80", "#22c55e"],
  dangerRed:     ["#f87171", "#ef4444"],
  hero:          ["rgba(79, 70, 229, 0.08)", "transparent"],
  warmSurface:   ["#faf8f5", "#f5f0eb"],
  amberGlow:     ["rgba(245, 158, 11, 0.12)", "rgba(245, 158, 11, 0.04)", "transparent"],
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
  "6xl": 60,
} as const;

export const FONT_WEIGHT = {
  normal:    "400",
  medium:    "500",
  semibold:  "600",
  bold:      "700",
  extrabold: "800",
  black:     "900",
} as const;

export const SPACING = {
  0:   0,
  0.5: 2,
  1:   4,
  1.5: 6,
  2:   8,
  2.5: 10,
  3:   12,
  3.5: 14,
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
  lg:   12,
  xl:   14,
  "2xl": 18,
  "3xl": 24,
  "4xl": 32,
  full: 9999,
} as const;

export const SHADOWS = {
  card: {
    shadowColor:   "#000",
    shadowOffset:  { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius:  8,
    elevation:     2,
  },
  cardSm: {
    shadowColor:   "#000",
    shadowOffset:  { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius:  4,
    elevation:     1,
  },
  cardLg: {
    shadowColor:   "#000",
    shadowOffset:  { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius:  16,
    elevation:     4,
  },
  gold: {
    shadowColor:   "#f59e0b",
    shadowOffset:  { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius:  6,
    elevation:     2,
  },
  brand: {
    shadowColor:   "#4f46e5",
    shadowOffset:  { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius:  8,
    elevation:     3,
  },
} as const;

export const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 } as const;
