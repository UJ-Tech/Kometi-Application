// src/app/(auth)/_layout.tsx
// Auth group layout - stack navigator for welcome, login, register, and MPIN screens.

import { Stack } from "expo-router";

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown:   false,
        animation:     "slide_from_right",
        contentStyle:  { backgroundColor: "#0f0d23" },
      }}
    />
  );
}
