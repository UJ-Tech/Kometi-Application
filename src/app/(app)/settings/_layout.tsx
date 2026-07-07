import { Stack } from "expo-router";
import { COLORS } from "../../../constants/theme";

export default function SettingsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
        contentStyle: { backgroundColor: COLORS.surface.bg },
      }}
    />
  );
}
