import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, FONT_SIZE, SPACING, BORDER_RADIUS } from "../../constants/theme";
import KKMark from "../brand/KKMark";

interface ScreenHeaderProps {
  title:         string;
  subtitle?:     string;
  showBack?:     boolean;
  onBack?:       () => void;
  rightElement?: React.ReactNode;
  transparent?:  boolean;
  brand?:        boolean;
}

export default function ScreenHeader({
  title,
  subtitle,
  showBack    = true,
  onBack,
  rightElement,
  transparent = false,
  brand       = false,
}: ScreenHeaderProps) {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();

  const handleBack = () => {
    if (onBack) { onBack(); return; }
    router.back();
  };

  const bgColor = brand ? COLORS.brand[900] : transparent ? "transparent" : COLORS.surface.bg;
  const textColor = brand ? COLORS.white : COLORS.text.primary;
  const subtitleColor = brand ? COLORS.brand[200] : COLORS.text.secondary;
  const backBg = brand ? "rgba(255,255,255,0.1)" : "rgba(79, 70, 229, 0.08)";
  const backColor = brand ? COLORS.white : COLORS.text.primary;

  return (
    <View style={{
      paddingTop:        insets.top + SPACING[2],
      paddingBottom:     SPACING[3],
      paddingHorizontal: SPACING[5],
      backgroundColor:   bgColor,
      flexDirection:     "row",
      alignItems:        "center",
      gap:               SPACING[3],
    }}>
      {showBack && (
        <TouchableOpacity
          onPress={handleBack}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={{
            width: 38,
            height: 38,
            borderRadius: BORDER_RADIUS.lg,
            backgroundColor: backBg,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="chevron-back" size={20} color={backColor} />
        </TouchableOpacity>
      )}

      {brand && !showBack && (
        <KKMark size={28} color={COLORS.white} />
      )}

      <View style={{ flex: 1 }}>
        <Text style={{
          fontSize: FONT_SIZE.lg,
          fontWeight: "700",
          color: textColor,
        }}>
          {title}
        </Text>
        {subtitle && (
          <Text style={{
            fontSize: FONT_SIZE.xs,
            color: subtitleColor,
            marginTop: 1,
          }}>
            {subtitle}
          </Text>
        )}
      </View>

      {rightElement && <View>{rightElement}</View>}
    </View>
  );
}
