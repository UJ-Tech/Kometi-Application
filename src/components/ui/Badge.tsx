// src/components/ui/Badge.tsx
import React from "react";
import { View, Text } from "react-native";
import { COLORS, BORDER_RADIUS, FONT_SIZE } from "../../constants/theme";
import type { KYCStatus, InstallmentStatus, CommitteeStatus } from "../../types";

type BadgeVariant = "success" | "warning" | "danger" | "info" | "neutral" | "brand";

interface BadgeProps {
  label:      string;
  variant?:   BadgeVariant;
  size?:      "sm" | "md";
  dot?:       boolean;
  style?:     object;
  textStyle?: object;
}

const VARIANT_STYLES: Record<BadgeVariant, { bg: string; text: string; dot: string }> = {
  success: { bg: "rgba(34,197,94,0.12)",  text: COLORS.success.light, dot: COLORS.success.DEFAULT },
  warning: { bg: "rgba(249,115,22,0.12)", text: COLORS.warning.light, dot: COLORS.warning.DEFAULT },
  danger:  { bg: "rgba(239,68,68,0.12)",  text: COLORS.danger.light,  dot: COLORS.danger.DEFAULT  },
  info:    { bg: "rgba(14,165,233,0.12)", text: COLORS.info.light,    dot: COLORS.info.DEFAULT    },
  neutral: { bg: "rgba(163,163,163,0.12)",text: COLORS.text.secondary,dot: COLORS.text.muted     },
  brand:   { bg: "rgba(111,94,255,0.15)", text: COLORS.brand[300],    dot: COLORS.brand[500]     },
};

export function kycVariant(status: KYCStatus): BadgeVariant {
  return status === "VERIFIED" ? "success" :
         status === "REJECTED" ? "danger"  :
         status === "SUBMITTED"? "info"    : "warning";
}

export function installmentVariant(status: InstallmentStatus): BadgeVariant {
  return status === "PAID"    ? "success" :
         status === "OVERDUE" ? "danger"  :
         status === "PARTIAL" ? "warning" :
         status === "WAIVED"  ? "neutral" : "brand";
}

export function committeeVariant(status: CommitteeStatus): BadgeVariant {
  return status === "ACTIVE"    ? "success" :
         status === "COMPLETED" ? "neutral" :
         status === "CANCELLED" ? "danger"  : "brand";
}

export default function Badge({ label, variant = "brand", size = "sm", dot, style, textStyle }: BadgeProps) {
  const s        = VARIANT_STYLES[variant] ?? VARIANT_STYLES.brand;
  const fontSize = size === "sm" ? FONT_SIZE.xs : FONT_SIZE.sm;

  return (
    <View style={[{
      flexDirection:    "row",
      alignItems:       "center",
      gap:               4,
      paddingHorizontal: size === "sm" ? 8 : 12,
      paddingVertical:   size === "sm" ? 3 : 5,
      borderRadius:     BORDER_RADIUS.full,
      backgroundColor:  s.bg,
      alignSelf:        "flex-start",
    }, style as any]}>
      {dot && (
        <View style={{
          width:        5, height: 5,
          borderRadius: 9999,
          backgroundColor: s.dot,
        }} />
      )}
      <Text style={[{ fontSize, fontWeight: "600", color: s.text }, textStyle as any]}>
        {label}
      </Text>
    </View>
  );
}
