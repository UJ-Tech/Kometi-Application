// src/components/ui/Card.tsx
import React from "react";
import { View, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS, BORDER_RADIUS, SHADOWS, GRADIENTS } from "../../constants/theme";

interface CardProps {
  children:      React.ReactNode;
  style?:        ViewStyle;
  gradient?:     boolean;
  elevated?:     boolean;
  borderGlow?:   boolean;
  padding?:      number;
}

export default function Card({
  children,
  style,
  gradient   = false,
  elevated   = false,
  borderGlow = false,
  padding    = 16,
}: CardProps) {
  const base: ViewStyle = {
    borderRadius:    BORDER_RADIUS.xl,
    overflow:        "hidden",
    borderWidth:     1,
    borderColor:     borderGlow ? COLORS.surface.glow : COLORS.surface.border,
    ...(elevated ? SHADOWS.card : SHADOWS.cardSm),
  };

  if (gradient) {
    return (
      <LinearGradient
        colors={GRADIENTS.darkElevated as any}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[base, style]}
      >
        <View style={{ padding }}>{children}</View>
      </LinearGradient>
    );
  }

  return (
    <View style={[base, { backgroundColor: COLORS.surface.card, padding }, style]}>
      {children}
    </View>
  );
}
