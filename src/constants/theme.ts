// src/constants/theme.ts
// Light theme — clean, minimal, readable.

export const COLORS = {
  brandPrimary: "#0d9488",
  goldPrimary: "#b8860b",
  // Brand — Muted Teal
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
  gold: {
    300: "#e8cc73",
    400: "#d4a84b",
    500: "#b8860b",
    600: "#996515",
  },
  surface: {
    bg:       "#f5f5f7",
    card:     "#ffffff",
    elevated: "#ffffff",
    border:   "#e5e5ea",
    glow:     "rgba(13, 148, 136, 0.06)",
  },
  text: {
    primary:   "#1a1a2e",
    secondary: "#6b7280",
    muted:     "#9ca3af",
    inverse:   "#ffffff",
  },
  success: { light: "#16a34a", DEFAULT: "#22c55e", dark: "#15803d" },
  warning: { light: "#d97706", DEFAULT: "#eab308", dark: "#a16207" },
  danger:  { light: "#dc2626", DEFAULT: "#ef4444", dark: "#b91c1c" },
  info:    { light: "#0284c7", DEFAULT: "#0ea5e9", dark: "#0369a1" },
  white: "#ffffff",
  black: "#000000",
  transparent: "transparent",
} as const;

export const GRADIENTS = {
  brandPrimary:  ["#0d9488", "#0f766e"],
  brandGlow:     ["#2dd4bf", "#0d9488", "#0f766e"],
  goldAccent:    ["#d4a84b", "#a67c2e"],
  darkCard:      ["#1c1c27", "#111118"],
  darkElevated:  ["#232332", "#1c1c27"],
  successGreen:  ["#4ade80", "#22c55e"],
  dangerRed:     ["#f87171", "#ef4444"],
  hero:          ["rgba(13, 148, 136, 0.08)", "transparent"],
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
  lg:   12,
  xl:   14,
  "2xl": 18,
  "3xl": 24,
  full: 9999,
} as const;

export const SHADOWS = {
  card: {
    shadowColor:   "#000",
    shadowOffset:  { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius:  6,
    elevation:     2,
  },
  cardSm: {
    shadowColor:   "#000",
    shadowOffset:  { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius:  3,
    elevation:     1,
  },
  gold: {
    shadowColor:   "#b8860b",
    shadowOffset:  { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius:  4,
    elevation:     2,
  },
} as const;

export const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 } as const;
