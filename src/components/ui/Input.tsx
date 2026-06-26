// src/components/ui/Input.tsx
import React, { forwardRef } from "react";
import {
  View,
  TextInput,
  Text,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { COLORS, BORDER_RADIUS, FONT_SIZE, SPACING } from "../../constants/theme";

interface InputProps extends TextInputProps {
  label?:        string;
  error?:        string;
  hint?:         string;
  leftIcon?:     React.ReactNode;
  rightElement?: React.ReactNode;
  containerStyle?: ViewStyle;
  required?:     boolean;
}

const Input = forwardRef<TextInput, InputProps>(({
  label,
  error,
  hint,
  leftIcon,
  rightElement,
  containerStyle,
  required,
  value,
  onChangeText,
  onFocus,
  onBlur,
  returnKeyType,
  onSubmitEditing,
  blurOnSubmit = true,
  ...rest
}, ref) => {
  const borderColor = error
    ? COLORS.danger.DEFAULT
    : COLORS.surface.border;

  return (
    <View style={[{ width: "100%" }, containerStyle]}>
      {label && (
        <Text style={{
          fontSize:    FONT_SIZE.sm,
          fontWeight:  "500",
          color:       COLORS.text.secondary,
          marginBottom: SPACING[1.5],
        }}>
          {label}
          {required && <Text style={{ color: COLORS.danger.DEFAULT }}> *</Text>}
        </Text>
      )}

      <View style={[
        {
          flexDirection:   "row",
          alignItems:      "center",
          backgroundColor: COLORS.surface.card,
          borderRadius:    BORDER_RADIUS.md,
          borderWidth:     1.5,
          borderColor,
          paddingHorizontal: SPACING[3],
          height:          52,
        },
      ]}>
        {leftIcon && (
          <View style={{ marginRight: SPACING[2] }}>{leftIcon}</View>
        )}

        <TextInput
          ref={ref}
          style={{
            flex:       1,
            fontSize:   FONT_SIZE.base,
            color:      COLORS.text.primary,
            paddingVertical: 0,
          }}
          placeholderTextColor={COLORS.text.muted}
          onFocus={onFocus}
          onBlur={onBlur}
          value={value ?? ""}
          onChangeText={onChangeText}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          blurOnSubmit={blurOnSubmit}
          {...rest}
        />

        {rightElement && (
          <View style={{ marginLeft: SPACING[2] }}>{rightElement}</View>
        )}
      </View>

      {error ? (
        <Text style={{
          fontSize:  FONT_SIZE.xs,
          color:     COLORS.danger.light,
          marginTop: SPACING[1],
        }}>
          {error}
        </Text>
      ) : hint ? (
        <Text style={{
          fontSize:  FONT_SIZE.xs,
          color:     COLORS.text.muted,
          marginTop: SPACING[1],
        }}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
});

Input.displayName = "Input";
export default Input;
