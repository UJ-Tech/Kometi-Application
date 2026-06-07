// src/components/ui/SkeletonLoader.tsx
// Shimmer skeleton loader using Reanimated 3 for smooth pulsing.

import React, { useEffect } from "react";
import { View, type ViewStyle } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolate,
  Easing,
} from "react-native-reanimated";
import { COLORS, BORDER_RADIUS } from "../../constants/theme";

interface SkeletonProps {
  width?:        number | string;
  height?:       number;
  borderRadius?: number;
  style?:        ViewStyle;
}

export function SkeletonBox({ width = "100%", height = 16, borderRadius = BORDER_RADIUS.sm, style }: SkeletonProps) {
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0.3, 0.65]),
  }));

  return (
    <Animated.View style={[{
      width:           width as any,
      height,
      borderRadius,
      backgroundColor: COLORS.surface.elevated,
    }, animStyle, style]} />
  );
}

// Preset: Card skeleton (member/committee list item)
export function CardSkeleton() {
  return (
    <View style={{
      backgroundColor: COLORS.surface.card,
      borderRadius:    BORDER_RADIUS.xl,
      padding:         16,
      gap:             12,
      borderWidth:     1,
      borderColor:     COLORS.surface.border,
    }}>
      <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
        <SkeletonBox width={44} height={44} borderRadius={22} />
        <View style={{ flex: 1, gap: 8 }}>
          <SkeletonBox width="60%" height={14} />
          <SkeletonBox width="40%" height={11} />
        </View>
        <SkeletonBox width={64} height={22} borderRadius={11} />
      </View>
      <SkeletonBox width="100%" height={1} />
      <View style={{ flexDirection: "row", gap: 16 }}>
        <SkeletonBox width="30%" height={12} />
        <SkeletonBox width="30%" height={12} />
        <SkeletonBox width="30%" height={12} />
      </View>
    </View>
  );
}

// Preset: Transaction skeleton
export function TransactionSkeleton() {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 4 }}>
      <SkeletonBox width={40} height={40} borderRadius={12} />
      <View style={{ flex: 1, gap: 6 }}>
        <SkeletonBox width="55%" height={13} />
        <SkeletonBox width="35%" height={10} />
      </View>
      <SkeletonBox width={70} height={16} />
    </View>
  );
}
