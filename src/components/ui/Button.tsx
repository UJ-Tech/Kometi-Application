import React from "react";
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  View,
  type TouchableOpacityProps,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
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
  gradient?:   boolean;
}

const SIZE_STYLES: Record<Size, { height: number; px: number; textSize: number }> = {
  sm: { height: 36, px: 14, textSize: 13 },
  md: { height: 46, px: 20, textSize: 15 },
  lg: { height: 54, px: 24, textSize: 16 },
};

const GRADIENT_MAP: Record<string, [string, string]> = {
  primary: ["#6366f1", "#4f46e5"],
  gold:    ["#fbbf24", "#f59e0b"],
  danger:  ["#ef4444", "#dc2626"],
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
  gradient: useGradient,
  onPress,
  ...rest
}: ButtonProps) {
  const s      = SIZE_STYLES[size];
  const isDisabled = disabled || isLoading;
  const shouldGradient = useGradient ?? (variant === "primary" || variant === "gold");

  const bgColor =
    variant === "secondary" ? "rgba(79, 70, 229, 0.08)" :
    variant === "ghost"     ? "transparent" :
    variant === "danger"    ? COLORS.danger.DEFAULT :
    variant === "gold"      ? COLORS.gold[400] :
    COLORS.brand[500];

  const textColor =
    variant === "secondary" || variant === "ghost"
      ? COLORS.brand[600]
      : variant === "gold"
      ? COLORS.black
      : COLORS.white;

  const containerProps = {
    activeOpacity: 0.8,
    disabled: isDisabled,
    onPress,
    style: [
      {
        borderRadius: BORDER_RADIUS.md,
        opacity: isDisabled ? 0.5 : 1,
        borderWidth: variant === "secondary" || variant === "ghost" ? 1 : 0,
        borderColor: variant === "secondary" ? COLORS.brand[200] : "transparent",
        overflow: "hidden",
      },
      fullWidth && { width: "100%" },
      (variant === "primary" || variant === "gold") && !useGradient && SHADOWS.cardSm,
    ] as any,
    ...rest,
  } as TouchableOpacityProps;

  const inner = (
    <View style={{
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingHorizontal: s.px,
      height: s.height,
    }}>
      {icon && !isLoading && icon}
      {isLoading ? (
        <ActivityIndicator color={textColor} size="small" />
      ) : (
        <Text style={{
          fontSize: s.textSize,
          fontWeight: "700",
          color: textColor,
          letterSpacing: variant === "gold" ? 0.3 : 0,
        }}>
          {label}
        </Text>
      )}
      {iconRight && !isLoading && iconRight}
    </View>
  );

  if (shouldGradient && !isDisabled) {
    return (
      <TouchableOpacity {...containerProps as any}>
        <LinearGradient
          colors={GRADIENT_MAP[variant] ?? GRADIENT_MAP.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {inner}
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity {...containerProps as any}>
      <View style={{ backgroundColor: bgColor, borderRadius: BORDER_RADIUS.md }}>
        {inner}
      </View>
    </TouchableOpacity>
  );
}
