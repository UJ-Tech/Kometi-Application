import React, { useEffect } from "react";
import { Tabs, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, BORDER_RADIUS } from "../../constants/theme";
import { useAuthStore } from "../../stores/auth.store";
import BrandedLoader from "../../components/brand/BrandedLoader";
import { useCommitteeStore } from "../../stores/committee.store";
import { canViewMembers } from "../../utils/rbac";

export default function AppLayout() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const committees = useCommitteeStore((s) => s.committees);
  const hasCommittee = committees.length > 0;

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/(auth)/welcome");
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <BrandedLoader />
    );
  }

  if (!isAuthenticated) return null;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.brandPrimary,
        tabBarInactiveTintColor: "#a8a29e",
        tabBarStyle: {
          backgroundColor: COLORS.surface.card,
          borderTopWidth: 0,
          borderTopColor: COLORS.surface.border,
          height: 64 + insets.bottom,
          paddingBottom: insets.bottom + 8,
          paddingTop: 8,
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          elevation: 8,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.06,
          shadowRadius: 12,
          borderTopLeftRadius: BORDER_RADIUS["2xl"],
          borderTopRightRadius: BORDER_RADIUS["2xl"],
        },
        tabBarItemStyle: {
          gap: 2,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "600",
        },
      }}
    >
      <Tabs.Screen
        name="dashboard/index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "home" : "home-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="committees/index"
        options={{
          title: "Chits",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "people" : "people-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="installments/index"
        options={{
          title: "Dues",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "calendar" : "calendar-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="members/index"
        options={{
          title: "Members",
          href: canViewMembers(hasCommittee) ? undefined : null,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "person-add" : "person-add-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="wallet/index"
        options={{
          title: "Wallet",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "wallet" : "wallet-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="committees/create"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="committees/[id]"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="dashboard/admin"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="member"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="wallet/withdraw"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="notifications/index"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
