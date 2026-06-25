// src/components/ui/Avatar.tsx
import React from "react";
import { View, Text } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS } from "../../constants/theme";

interface AvatarProps {
  name:          string;
  imageUrl?:     string;
  size?:         number;
  showOnline?:   boolean;
}

function getInitials(name: string): string {
  const parts = name.trim().split(" ");
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

// Simple hash to pick a gradient per name
const AVATAR_GRADIENTS: [string, string][] = [
  ["#0d9488", "#0f766e"],
  ["#d97706", "#b45309"],
  ["#16a34a", "#15803d"],
  ["#0284c7", "#0369a1"],
  ["#be185d", "#9d174d"],
  ["#7c3aed", "#6d28d9"],
];

function pickGradient(name: string): [string, string] {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash += name.charCodeAt(i);
  return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length];
}

export default function Avatar({ name, imageUrl, size = 44, showOnline = false }: AvatarProps) {
  const gradient = pickGradient(name);
  const fontSize = size * 0.36;

  return (
    <View style={{ position: "relative" }}>
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          contentFit="cover"
        />
      ) : (
        <LinearGradient
          colors={gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            width:         size,
            height:        size,
            borderRadius:  size / 2,
            alignItems:    "center",
            justifyContent:"center",
          }}
        >
          <Text style={{ fontSize, fontWeight: "700", color: "#fff" }}>
            {getInitials(name)}
          </Text>
        </LinearGradient>
      )}

      {showOnline && (
        <View style={{
          position:        "absolute",
          bottom:          1,
          right:           1,
          width:           10,
          height:          10,
          borderRadius:    5,
          backgroundColor: COLORS.success.DEFAULT,
          borderWidth:     2,
          borderColor:     COLORS.surface.bg,
        }} />
      )}
    </View>
  );
}
