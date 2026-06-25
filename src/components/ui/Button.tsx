// src/components/ui/Button.tsx
import React from "react";
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  View,
  type TouchableOpacityProps,
} from "react-native";
import { COLORS, BORDER_RADIUS, SHADOWS } from "../../constants/theme";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "gold";
type Size    = "sm" | "md" | "lg";

interface ButtonProps extends Omit<TouchableOpacityProps, "style"> {
  label:       string;
  variant?:    Variant;
  size?:       Size;
  isLoading?:  boolean;
  icon?:       React.ReactNode;
  iconRight?:  React.ReactNode;
  fullWidth?:  boolean;
}

const SIZE_STYLES: Record<Size, { height: number; px: number; textSize: number }> = {
  sm: { height: 36, px: 14, textSize: 13 },
  md: { height: 46, px: 20, textSize: 15 },
  lg: { height: 54, px: 24, textSize: 16 },
};

export default function Button({
  label,
  variant   = "primary",
  size      = "md",
  isLoading = false,
  disabled,
  icon,
  iconRight,
  fullWidth = true,
  onPress,
  ...rest
}: ButtonProps) {
  const s      = SIZE_STYLES[size];
  const isDisabled = disabled || isLoading;

  const bgColor =
    variant === "primary"  ? COLORS.brand[500] :
    variant === "secondary"? "rgba(13,148,136,0.08)" :
    variant === "danger"   ? COLORS.danger.DEFAULT :
    variant === "gold"     ? COLORS.gold[400] :
    "transparent";

  const textColor =
    variant === "secondary" || variant === "ghost"
      ? COLORS.brand[600]
      : variant === "gold"
      ? "#ffffff"
      : COLORS.white;

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      disabled={isDisabled}
      onPress={onPress}
      style={[
        {
          borderRadius: BORDER_RADIUS.md,
          backgroundColor: bgColor,
          opacity: isDisabled ? 0.5 : 1,
          borderWidth: variant === "secondary" || variant === "ghost" ? 1 : 0,
          borderColor: variant === "secondary" ? COLORS.brand[200] : "transparent",
        },
        fullWidth && { width: "100%" },
        variant === "primary" && SHADOWS.cardSm,
      ]}
      {...rest}
    >
      <View
        style={{
          flexDirection:  "row",
          alignItems:     "center",
          justifyContent: "center",
          gap:             8,
          paddingHorizontal: s.px,
          height:         s.height,
        }}
      >
        {icon && !isLoading && icon}
        {isLoading ? (
          <ActivityIndicator
            color={textColor}
            size="small"
          />
        ) : (
          <Text
            style={{
              fontSize:   s.textSize,
              fontWeight: "600",
              color:      textColor,
            }}
          >
            {label}
          </Text>
        )}
        {iconRight && !isLoading && iconRight}
      </View>
    </TouchableOpacity>
  );
}
