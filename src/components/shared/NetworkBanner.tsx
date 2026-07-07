import React from "react";
import { View, Text } from "react-native";
import { useNetworkStatus } from "../../hooks/useNetworkStatus";
import { COLORS, FONT_SIZE } from "../../constants/theme";
import { Ionicons } from "@expo/vector-icons";

export default function NetworkBanner() {
  const isConnected = useNetworkStatus();

  if (isConnected) return null;

  return (
    <View style={{
      backgroundColor: COLORS.danger.DEFAULT,
      paddingVertical: 8,
      paddingHorizontal: 16,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    }}>
      <Ionicons name="cloud-offline-outline" size={16} color={COLORS.white} />
      <Text style={{
        color: COLORS.white,
        fontSize: FONT_SIZE.sm,
        fontWeight: "600",
      }}>
        No internet connection
      </Text>
    </View>
  );
}
