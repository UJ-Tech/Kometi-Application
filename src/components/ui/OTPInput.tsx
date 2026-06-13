// src/components/ui/OTPInput.tsx
// 6-box OTP input with auto-advance, paste support, and backspace navigation.

import React, { useRef } from "react";
import { View, TextInput, Text } from "react-native";
import { COLORS, BORDER_RADIUS, FONT_SIZE, SPACING } from "../../constants/theme";

interface OTPInputProps {
  length?:   number;
  value:     string;
  onChange:  (otp: string) => void;
  error?:    string;
  autoFocus?: boolean;
}

export default function OTPInput({
  length    = 6,
  value,
  onChange,
  error,
  autoFocus = true,
}: OTPInputProps) {
  const inputsRef = useRef<(TextInput | null)[]>([]);
  const digits    = value.padEnd(length, "").slice(0, length).split("");

  // Handle full paste
  const handleChange = (text: string, index: number) => {
    // Strip non-digits
    const cleaned = text.replace(/\D/g, "");

    if (cleaned.length > 1) {
      // Pasted — fill all boxes
      const newOTP = cleaned.slice(0, length);
      onChange(newOTP);
      inputsRef.current[Math.min(newOTP.length - 1, length - 1)]?.focus();
      return;
    }

    const arr    = [...digits];
    arr[index]   = cleaned;
    const newOTP = arr.join("").replace(/ /g, "");
    onChange(newOTP);

    if (cleaned && index < length - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === "Backspace") {
      if (!digits[index] && index > 0) {
        const arr  = [...digits];
        arr[index - 1] = "";
        onChange(arr.join("").replace(/ /g, ""));
        inputsRef.current[index - 1]?.focus();
      }
    }
  };

  return (
    <View>
      <View style={{ flexDirection: "row", gap: SPACING[2], justifyContent: "center" }}>
        {Array.from({ length }).map((_, i) => {
          const filled = !!digits[i] && digits[i] !== " ";
          const borderColor = error
            ? COLORS.danger.DEFAULT
            : filled
            ? COLORS.brand[500]
            : COLORS.surface.border;

          return (
            <TextInput
              key={i}
              ref={(r) => { inputsRef.current[i] = r; }}
              value={digits[i] === " " ? "" : digits[i]}
              onChangeText={(t) => handleChange(t, i)}
              onKeyPress={(e) => handleKeyPress(e, i)}
              keyboardType="number-pad"
              maxLength={6}  // allow paste
              selectTextOnFocus
              autoFocus={autoFocus && i === 0}
              style={{
                width:           48,
                height:          58,
                borderRadius:    BORDER_RADIUS.md,
                borderWidth:     2,
                borderColor,
                backgroundColor: COLORS.surface.card,
                textAlign:       "center",
                fontSize:        FONT_SIZE.xl,
                fontWeight:      "700",
                color:           COLORS.text.primary,
                shadowColor:     filled ? COLORS.brand[500] : "transparent",
                shadowOffset:    { width: 0, height: 0 },
                shadowOpacity:   0.4,
                shadowRadius:    6,
                elevation:       filled ? 4 : 0,
              }}
            />
          );
        })}
      </View>
      {error && (
        <Text style={{
          textAlign: "center",
          fontSize:  FONT_SIZE.sm,
          color:     COLORS.danger.light,
          marginTop: SPACING[2],
        }}>
          {error}
        </Text>
      )}
    </View>
  );
}
