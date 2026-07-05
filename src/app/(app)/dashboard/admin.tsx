// src/app/(app)/dashboard/admin.tsx
// Admin panel — deprecated, redirects to dashboard.
import { useEffect } from "react";
import { useRouter } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import { COLORS } from "../../../constants/theme";

export default function AdminDashboard() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/(app)/dashboard");
  }, []);
  return (
    <View style={{ flex: 1, backgroundColor: COLORS.surface.bg, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator color={COLORS.brand[500]} size="large" />
    </View>
  );
}
