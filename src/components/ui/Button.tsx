// src/components/ui/Button.tsx
import React from "react";
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  View,
  type TouchableOpacityProps,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { GRADIENTS, COLORS, BORDER_RADIUS, SHADOWS } from "../../constants/theme";

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
  sm: { height: 38, px: 14, textSize: 13 },
  md: { height: 50, px: 20, textSize: 15 },
  lg: { height: 58, px: 24, textSize: 17 },
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

  const content = (
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
          color={variant === "ghost" || variant === "secondary" ? COLORS.brand[500] : COLORS.white}
          size="small"
        />
      ) : (
        <Text
          style={{
            fontSize:   s.textSize,
            fontWeight: "600",
            color:
              variant === "ghost" || variant === "secondary"
                ? COLORS.brand[500]
                : variant === "danger"
                ? COLORS.white
                : COLORS.white,
          }}
        >
          {label}
        </Text>
      )}
      {iconRight && !isLoading && iconRight}
    </View>
  );

  if (variant === "primary") {
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        disabled={isDisabled}
        onPress={onPress}
        style={[
          { borderRadius: BORDER_RADIUS.lg, overflow: "hidden", opacity: isDisabled ? 0.5 : 1 },
          fullWidth && { width: "100%" },
          SHADOWS.card,
        ]}
        {...rest}
      >
        <LinearGradient
          colors={GRADIENTS.brandPrimary as [string, string]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          {content}
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  if (variant === "gold") {
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        disabled={isDisabled}
        onPress={onPress}
        style={[
          { borderRadius: BORDER_RADIUS.lg, overflow: "hidden", opacity: isDisabled ? 0.5 : 1 },
          fullWidth && { width: "100%" },
          SHADOWS.gold,
        ]}
        {...rest}
      >
        <LinearGradient
          colors={GRADIENTS.goldAccent as [string, string]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          {content}
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  const bgColor =
    variant === "secondary" ? "rgba(111,94,255,0.10)" :
    variant === "danger"    ? COLORS.danger.DEFAULT    :
    "transparent";

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      disabled={isDisabled}
      onPress={onPress}
      style={[
        {
          borderRadius: BORDER_RADIUS.lg,
          backgroundColor: bgColor,
          opacity: isDisabled ? 0.5 : 1,
          borderWidth: variant === "secondary" || variant === "ghost" ? 1 : 0,
          borderColor: variant === "secondary" ? COLORS.brand[500] : "transparent",
        },
        fullWidth && { width: "100%" },
      ]}
      {...rest}
    >
      {content}
    </TouchableOpacity>
  );
}
