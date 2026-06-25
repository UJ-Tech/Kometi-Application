// src/components/ui/AmountInput.tsx
// A premium paise-aware input component tailored for Indian rupee formatting.
// Handles typing with proper comma separation (Lakhs/thousands) and converts to BigInt paise.

import React, { useState, useEffect } from "react";
import { View, TextInput, Text, StyleSheet } from "react-native";
import { COLORS, BORDER_RADIUS } from "../../constants/theme";
import { formatINR } from "../../utils/currency";

interface AmountInputProps {
  label?: string;
  valuePaise: bigint;
  onChangePaise: (value: bigint) => void;
  error?: string;
  placeholder?: string;
  maxAmountPaise?: bigint;
}

export function AmountInput({
  label,
  valuePaise,
  onChangePaise,
  error,
  placeholder = "0.00",
  maxAmountPaise,
}: AmountInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [displayValue, setDisplayValue] = useState("");

  // Keep display synchronized with external value
  useEffect(() => {
    if (valuePaise === 0n) {
      if (!isFocused) setDisplayValue("");
    } else {
      const rupeesVal = Number(valuePaise) / 100;
      setDisplayValue(rupeesVal.toLocaleString("en-IN", {
        maximumFractionDigits: 2,
        minimumFractionDigits: 0,
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valuePaise, isFocused]);

  const handleChangeText = (text: string) => {
    // Strip everything except numbers and a single decimal dot
    const cleanText = text.replace(/[^0-9.]/g, "");
    
    // Handle double decimals
    const parts = cleanText.split(".");
    if (parts.length > 2) return;
    
    // Max 2 decimal places for paise
    if (parts[1] && parts[1].length > 2) return;

    setDisplayValue(cleanText);

    // Convert to BigInt paise
    if (!cleanText || cleanText === ".") {
      onChangePaise(0n);
      return;
    }

    const rupeesNum = parseFloat(cleanText);
    if (!isNaN(rupeesNum)) {
      const calculatedPaise = BigInt(Math.round(rupeesNum * 100));
      if (maxAmountPaise && calculatedPaise > maxAmountPaise) {
        onChangePaise(maxAmountPaise);
      } else {
        onChangePaise(calculatedPaise);
      }
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    // Format perfectly on blur
    if (valuePaise > 0n) {
      const rupeesVal = Number(valuePaise) / 100;
      setDisplayValue(
        rupeesVal.toLocaleString("en-IN", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      );
    } else {
      setDisplayValue("");
    }
  };

  return (
    <View className="mb-4">
      {label && (
        <Text className="text-slate-600 text-sm font-semibold mb-1.5 ml-1">
          {label}
        </Text>
      )}

      <View
        style={[
          styles.container,
          {
            borderColor: error
              ? COLORS.danger.DEFAULT
              : isFocused
              ? COLORS.brand[500]
              : COLORS.surface.border,
            backgroundColor: isFocused ? COLORS.surface.elevated : COLORS.surface.card,
          },
        ]}
        className="flex-row items-center px-4 h-14"
      >
        <Text className="text-brand-600 text-lg font-bold mr-2">₹</Text>
        <TextInput
          className="flex-1 text-slate-900 text-lg font-bold"
          style={{ outlineStyle: "none" } as any}
          placeholder={placeholder}
          placeholderTextColor="#94a3b8"
          keyboardType="decimal-pad"
          value={displayValue}
          onChangeText={handleChangeText}
          onFocus={() => setIsFocused(true)}
          onBlur={handleBlur}
        />
        {valuePaise > 0n && (
          <Text className="text-slate-400 text-xs font-semibold ml-2">
            ({formatINR(valuePaise)})
          </Text>
        )}
      </View>

      {error ? (
        <Text className="text-red-500 text-xs mt-1 ml-1 font-semibold">{error}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1.5,
    borderRadius: BORDER_RADIUS.md,
  },
});
