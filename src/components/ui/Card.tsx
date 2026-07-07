import React from "react";
import { View, Text, type StyleProp, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS, BORDER_RADIUS, SHADOWS } from "../../constants/theme";

type CardAccent = "brand" | "gold" | "success" | "danger" | "warning" | "info" | "neutral" | "none";

interface CardProps {
  children:      React.ReactNode;
  style?:        StyleProp<ViewStyle>;
  gradient?:     boolean;
  gradientColors?: [string, string];
  elevated?:     boolean;
  borderGlow?:   boolean;
  padding?:      number;
  accent?:       CardAccent;
  curved?:       boolean;
}

const ACCENT_COLORS: Record<CardAccent, string> = {
  brand:   COLORS.brand[500],
  gold:    COLORS.gold[500],
  success: COLORS.success.DEFAULT,
  danger:  COLORS.danger.DEFAULT,
  warning: COLORS.warning.DEFAULT,
  info:    COLORS.info.DEFAULT,
  neutral: COLORS.text.muted,
  none:    "transparent",
};

export default function Card({
  children,
  style,
  gradient   = false,
  gradientColors,
  elevated   = false,
  borderGlow = false,
  padding    = 16,
  accent     = "none",
  curved     = false,
}: CardProps) {
  if (gradient) {
    return (
      <LinearGradient
        colors={gradientColors ?? ["#1e1b4b", "#312e81"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          {
            borderRadius: curved ? BORDER_RADIUS["3xl"] : BORDER_RADIUS.lg,
            padding,
            position: "relative",
            overflow: "hidden",
          },
          elevated ? SHADOWS.cardLg : undefined,
          style,
        ]}
      >
        {children}
      </LinearGradient>
    );
  }

  const accentColor = ACCENT_COLORS[accent];
  const base: ViewStyle = {
    borderRadius: curved ? BORDER_RADIUS["3xl"] : BORDER_RADIUS.lg,
    borderWidth: accent === "none" ? 1 : 0,
    borderColor: COLORS.surface.border,
    backgroundColor: COLORS.surface.card,
    position: "relative",
    overflow: "hidden",
    ...(elevated ? SHADOWS.cardLg : SHADOWS.card),
  };

  return (
    <View style={[base, { padding }, style]}>
      {accent !== "none" && (
        <View style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          backgroundColor: accentColor,
        }} />
      )}
      {borderGlow && (
        <View style={{
          position: "absolute",
          top: -1,
          left: -1,
          right: -1,
          bottom: -1,
          borderRadius: (curved ? BORDER_RADIUS["3xl"] : BORDER_RADIUS.lg) + 1,
          borderWidth: 1.5,
          borderColor: "rgba(79, 70, 229, 0.08)",
        }} />
      )}
      {children}
    </View>
  );
}

export function CardRow({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, style]}>
      {children}
    </View>
  );
}

export function CardLabel({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
        <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: COLORS.brand[300] }} />
        <Text style={{ fontSize: 10, color: COLORS.text.muted, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase" }}>{label}</Text>
        <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: COLORS.brand[300] }} />
      </View>
      <Text style={{ fontSize: 16, fontWeight: "700", color: valueColor ?? COLORS.text.primary, marginTop: 2 }}>{value}</Text>
    </View>
  );
}
