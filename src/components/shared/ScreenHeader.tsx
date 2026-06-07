// src/components/shared/ScreenHeader.tsx
import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, FONT_SIZE, SPACING } from "../../constants/theme";

interface ScreenHeaderProps {
  title:         string;
  subtitle?:     string;
  showBack?:     boolean;
  onBack?:       () => void;
  rightElement?: React.ReactNode;
  transparent?:  boolean;
}

export default function ScreenHeader({
  title,
  subtitle,
  showBack    = true,
  onBack,
  rightElement,
  transparent = false,
}: ScreenHeaderProps) {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();

  const handleBack = () => {
    if (onBack) { onBack(); return; }
    router.back();
  };

  return (
    <View style={{
      paddingTop:        insets.top + SPACING[2],
      paddingBottom:     SPACING[3],
      paddingHorizontal: SPACING[5],
      backgroundColor:   transparent ? "transparent" : COLORS.surface.bg,
      flexDirection:     "row",
      alignItems:        "center",
      gap:               SPACING[3],
    }}>
      {showBack && (
        <TouchableOpacity
          onPress={handleBack}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={{
            width:          38,
            height:         38,
            borderRadius:   12,
            backgroundColor:"rgba(111,94,255,0.10)",
            alignItems:     "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="chevron-back" size={20} color={COLORS.text.primary} />
        </TouchableOpacity>
      )}

      <View style={{ flex: 1 }}>
        <Text style={{
          fontSize:  FONT_SIZE.lg,
          fontWeight:"700",
          color:     COLORS.text.primary,
        }}>
          {title}
        </Text>
        {subtitle && (
          <Text style={{
            fontSize: FONT_SIZE.xs,
            color:    COLORS.text.secondary,
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
