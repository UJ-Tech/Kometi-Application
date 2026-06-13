// src/app/(app)/committees/[id]/_layout.tsx
// This layout is required by Expo Router to properly propagate the `[id]`
// dynamic param to all child routes under /committees/[id]/...
import { Stack } from "expo-router";

export default function CommitteeLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }} />
  );
}
