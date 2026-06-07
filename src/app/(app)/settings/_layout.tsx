// src/app/(app)/settings/_layout.tsx
import { Stack } from "expo-router";
import { COLORS } from "../../../constants/theme";

export default function SettingsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: COLORS.surface.bg },
      }}
    />
  );
}
