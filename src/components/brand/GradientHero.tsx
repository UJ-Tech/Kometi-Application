import React from "react";
import { View, type ViewStyle, type StyleProp } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS, BORDER_RADIUS } from "../../constants/theme";
import { KKMarkWatermark } from "./KKMark";

interface GradientHeroProps {
  children: React.ReactNode;
  gradient?: string[];
  watermark?: boolean;
  style?: StyleProp<ViewStyle>;
  borderRadius?: number;
  curved?: boolean;
}

export default function GradientHero({
  children,
  gradient = ["#1e1b4b", "#312e81"],
  watermark = true,
  style,
  borderRadius = BORDER_RADIUS["3xl"],
  curved = false,
}: GradientHeroProps) {
  return (
    <View style={[{ position: "relative", overflow: "hidden" }, style]}>
      <LinearGradient
        colors={gradient as any}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          borderRadius,
          borderBottomLeftRadius: curved ? 0 : borderRadius,
          borderBottomRightRadius: curved ? 0 : borderRadius,
          paddingVertical: 24,
          paddingHorizontal: 24,
          paddingBottom: 32,
          position: "relative",
        }}
      >
        {watermark && (
          <KKMarkWatermark size={160} color={COLORS.white} opacity={0.04} />
        )}
        {children}
      </LinearGradient>
      {curved && (
        <View style={{
          height: 24,
          backgroundColor: COLORS.surface.bg,
          borderTopLeftRadius: borderRadius,
          borderTopRightRadius: borderRadius,
          marginTop: -2,
        }} />
      )}
    </View>
  );
}
