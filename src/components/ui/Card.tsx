// src/components/ui/Card.tsx
import React from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS, BORDER_RADIUS, SHADOWS } from "../../constants/theme";

interface CardProps {
  children:      React.ReactNode;
  style?:        StyleProp<ViewStyle>;
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
  if (gradient) {
    return (
      <LinearGradient
        colors={["#0d9488", "#0f766e"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          {
            borderRadius: BORDER_RADIUS.lg,
            padding,
            borderWidth: 1,
            borderColor: "rgba(13,148,136,0.3)",
          },
          style,
        ]}
      >
        {children}
      </LinearGradient>
    );
  }

  const base: ViewStyle = {
    borderRadius:    BORDER_RADIUS.lg,
    borderWidth:     1,
    borderColor:     COLORS.surface.border,
    backgroundColor: COLORS.surface.card,
    ...(elevated ? SHADOWS.card : SHADOWS.cardSm),
  };

  return (
    <View style={[base, { padding }, style]}>
      {children}
    </View>
  );
}
