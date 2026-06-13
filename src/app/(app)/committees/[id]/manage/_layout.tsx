// src/app/(app)/committees/[id]/manage/_layout.tsx
// Layout for the manage sub-section. Keeps headerShown false so our custom
// headers render correctly on all child screens.
import { Stack } from "expo-router";

export default function ManageLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }} />
  );
}
