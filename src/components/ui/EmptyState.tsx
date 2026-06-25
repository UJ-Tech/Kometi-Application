// src/components/ui/EmptyState.tsx
import React from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, FONT_SIZE, SPACING } from "../../constants/theme";
import Button from "./Button";

interface EmptyStateProps {
  icon?:        React.ReactNode | string;
  title:        string;
  description?: string;
  actionLabel?: string;
  onAction?:    () => void;
}

export default function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <View style={{
      flex:          1,
      alignItems:    "center",
      justifyContent:"center",
      padding:       SPACING[8],
      gap:           SPACING[4],
    }}>
      {icon && (
        <View style={{
          width:          80,
          height:         80,
          borderRadius:   40,
          backgroundColor:"rgba(13,148,136,0.08)",
          alignItems:     "center",
          justifyContent: "center",
        }}>
          {typeof icon === "string" ? (
            <Ionicons name={icon as any} size={32} color={COLORS.brandPrimary} />
          ) : (
            icon
          )}
        </View>
      )}

      <Text style={{
        fontSize:  FONT_SIZE.xl,
        fontWeight:"700",
        color:     COLORS.text.primary,
        textAlign: "center",
      }}>
        {title}
      </Text>

      {description && (
        <Text style={{
          fontSize:  FONT_SIZE.base,
          color:     COLORS.text.secondary,
          textAlign: "center",
          lineHeight: 22,
        }}>
          {description}
        </Text>
      )}

      {actionLabel && onAction && (
        <Button
          label={actionLabel}
          onPress={onAction}
          size="md"
          fullWidth={false}
        />
      )}
    </View>
  );
}
