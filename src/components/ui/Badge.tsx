import React from "react";
import { View, Text } from "react-native";
import { COLORS, BORDER_RADIUS, FONT_SIZE } from "../../constants/theme";
import type { KYCStatus, InstallmentStatus, CommitteeStatus } from "../../types";

type BadgeVariant = "success" | "warning" | "danger" | "info" | "neutral" | "brand" | "gold";

interface BadgeProps {
  label:      string;
  variant?:   BadgeVariant;
  size?:      "sm" | "md";
  dot?:       boolean;
  style?:     object;
  textStyle?: object;
  outline?:   boolean;
}

const VARIANT_STYLES: Record<BadgeVariant, { bg: string; text: string; dot: string; border: string }> = {
  success: { bg: "rgba(22,163,74,0.10)",  text: COLORS.success.dark, dot: COLORS.success.DEFAULT, border: "rgba(22,163,74,0.20)" },
  warning: { bg: "rgba(217,119,6,0.10)",  text: COLORS.warning.dark, dot: COLORS.warning.DEFAULT, border: "rgba(217,119,6,0.20)" },
  danger:  { bg: "rgba(220,38,38,0.10)",  text: COLORS.danger.dark,  dot: COLORS.danger.DEFAULT,  border: "rgba(220,38,38,0.20)" },
  info:    { bg: "rgba(2,132,199,0.10)",  text: COLORS.info.dark,    dot: COLORS.info.DEFAULT,    border: "rgba(2,132,199,0.20)" },
  neutral: { bg: COLORS.surface.warm,      text: COLORS.text.secondary, dot: COLORS.text.muted,   border: COLORS.surface.border },
  brand:   { bg: "rgba(79,70,229,0.10)",  text: COLORS.brand[700],   dot: COLORS.brand[500],     border: "rgba(79,70,229,0.20)" },
  gold:    { bg: "rgba(245,158,11,0.10)", text: COLORS.gold[700],    dot: COLORS.gold[500],      border: "rgba(245,158,11,0.20)" },
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

export default function Badge({ label, variant = "brand", size = "sm", dot, style, textStyle, outline = false }: BadgeProps) {
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
      backgroundColor:  outline ? "transparent" : s.bg,
      borderWidth:      outline ? 1 : 0,
      borderColor:      outline ? s.border : "transparent",
      alignSelf:        "flex-start",
    }, style as any]}>
      {dot && (
        <View style={{
          width: 5, height: 5,
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
