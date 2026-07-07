import React from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, FONT_SIZE, SPACING, BORDER_RADIUS } from "../../constants/theme";
import Button from "./Button";
import KKMark from "../brand/KKMark";

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
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: SPACING[8],
      gap: SPACING[4],
    }}>
      <View style={{
        width: 88,
        height: 88,
        borderRadius: 44,
        backgroundColor: "rgba(79, 70, 229, 0.06)",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        overflow: "hidden",
      }}>
        <KKMark size={36} color={COLORS.brand[200]} opacity={0.5} />
        {icon && typeof icon === "string" ? (
          <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name={icon as any} size={32} color={COLORS.brand[400]} />
          </View>
        ) : icon}
      </View>

      <Text style={{
        fontSize: FONT_SIZE.xl,
        fontWeight: "700",
        color: COLORS.text.primary,
        textAlign: "center",
      }}>
        {title}
      </Text>

      {description && (
        <Text style={{
          fontSize: FONT_SIZE.base,
          color: COLORS.text.secondary,
          textAlign: "center",
          lineHeight: 22,
          paddingHorizontal: SPACING[4],
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
