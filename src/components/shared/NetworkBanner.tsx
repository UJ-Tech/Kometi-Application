// src/components/shared/NetworkBanner.tsx
// Shows an offline banner at the top of the screen with reconnection animation.

import React, { useEffect } from "react";
import { Text } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNetworkStatus } from "../../hooks/useNetworkStatus";
import { COLORS, FONT_SIZE, SPACING } from "../../constants/theme";

export default function NetworkBanner() {
  const { isOnline, wasOffline, clearWasOffline } = useNetworkStatus();
  const insets    = useSafeAreaInsets();
  const translateY = useSharedValue(-100);

  const isReconnected = wasOffline && isOnline;

  useEffect(() => {
    if (!isOnline) {
      translateY.value = withTiming(0, { duration: 300 });
    } else if (isReconnected) {
      translateY.value = withTiming(0, { duration: 300 });
      const t = setTimeout(() => {
        translateY.value = withTiming(-100, { duration: 400 });
        clearWasOffline();
      }, 2000);
      return () => clearTimeout(t);
    } else {
      translateY.value = withTiming(-100, { duration: 400 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, isReconnected]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[{
      position:        "absolute",
      top:             insets.top,
      left:            0,
      right:           0,
      zIndex:          999,
      paddingVertical: SPACING[2],
      paddingHorizontal: SPACING[4],
      flexDirection:   "row",
      alignItems:      "center",
      gap:             SPACING[2],
      backgroundColor: isReconnected ? COLORS.success.DEFAULT : COLORS.danger.DEFAULT,
    }, animStyle]}>
      <Ionicons
        name={isReconnected ? "wifi" : "wifi-outline"}
        size={16}
        color="#fff"
      />
      <Text style={{ fontSize: FONT_SIZE.sm, color: "#fff", fontWeight: "600" }}>
        {isReconnected ? "Back online" : "No internet connection"}
      </Text>
    </Animated.View>
  );
}
