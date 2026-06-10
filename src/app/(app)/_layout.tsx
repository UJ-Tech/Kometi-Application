// src/app/(app)/_layout.tsx
// Authenticated App group tab layout navigator.

import React, { useEffect } from "react";
import { Tabs, useRouter } from "expo-router";
import { ActivityIndicator, Platform, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../constants/theme";
import { useAuthStore } from "../../stores/auth.store";
import { useCommitteeStore } from "../../stores/committee.store";
import { canViewMembers } from "../../utils/rbac";

export default function AppLayout() {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const userRole = useAuthStore((s) => s.user?.role);
  const committees = useCommitteeStore((s) => s.committees);
  const hasCommittee = committees.length > 0;

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/(auth)/welcome");
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: COLORS.surface.bg,
        }}
      >
        <ActivityIndicator size="large" color={COLORS.brandPrimary} />
      </View>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.brandPrimary,
        tabBarInactiveTintColor: "#a3a3a3",
        tabBarStyle: {
          backgroundColor: COLORS.surface.card,
          borderTopWidth: 1,
          borderTopColor: COLORS.surface.border,
          height: Platform.OS === "ios" ? 88 : 64,
          paddingBottom: Platform.OS === "ios" ? 28 : 10,
          paddingTop: 8,
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          elevation: 8,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.25,
          shadowRadius: 10,
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
          href: canViewMembers(userRole, hasCommittee) ? undefined : null,
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
    </Tabs>
  );
}
