import React from "react";
import { View, Image, type ViewStyle } from "react-native";
import { COLORS } from "../../constants/theme";

interface KKMarkProps {
  size?: number;
  color?: string;
  opacity?: number;
  style?: ViewStyle;
}

export default function KKMark({
  size = 40,
  color,
  opacity = 1,
  style,
}: KKMarkProps) {
  return (
    <View style={[{ width: size, height: size, alignItems: "center", justifyContent: "center" }, style]}>
      <Image
        source={require("../../../assets/images/icon.png")}
        style={{
          width: size,
          height: size,
          opacity,
          tintColor: color,
        }}
        resizeMode="contain"
      />
    </View>
  );
}

export function KKMarkWatermark({ size = 200, color = COLORS.brand[500], opacity = 0.04, style }: KKMarkProps) {
  return (
    <View style={[{ position: "absolute", right: -size * 0.3, top: -size * 0.2 }, style]}>
      <Image
        source={require("../../../assets/images/watermarklogo.png")}
        style={{
          width: size,
          height: size,
          opacity,
          tintColor: color,
        }}
        resizeMode="contain"
      />
    </View>
  );
}

export function KKSeparator({ color = COLORS.brand[200], width = 40, thickness = 2 }: { color?: string; width?: number; thickness?: number }) {
  return (
    <View style={{
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    }}>
      <View style={{ width: width * 0.3, height: thickness, backgroundColor: color, borderRadius: thickness / 2 }} />
      <View style={{
        width: 16,
        height: 16,
        alignItems: "center",
        justifyContent: "center",
      }}>
        <View style={{
          width: 6,
          height: 14,
          backgroundColor: color,
          borderRadius: 3,
          transform: [{ skewY: "-15deg" }],
        }} />
      </View>
      <View style={{ width: width * 0.3, height: thickness, backgroundColor: color, borderRadius: thickness / 2 }} />
    </View>
  );
}

export function KKDot({ size = 8, color = COLORS.brand[500], style }: { size?: number; color?: string; style?: ViewStyle }) {
  return (
    <View style={[{
      width: size,
      height: size,
      borderRadius: size / 2,
      backgroundColor: color,
    }, style]} />
  );
}
