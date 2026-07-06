// src/app/(app)/notifications/index.tsx
// Real-time notifications only — no DB persistence.
// Shows live notifications that arrive via socket while the app is open.

import React from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../../constants/theme";
import ScreenHeader from "../../../components/shared/ScreenHeader";

export default function NotificationsScreen() {
  return (
    <View className="flex-1 bg-surface-50">
      <ScreenHeader title="Notifications" showBack />

      <View className="flex-1 items-center justify-center px-8">
        <View className="w-20 h-20 rounded-full bg-amber-50 items-center justify-center mb-5">
          <Ionicons name="notifications-outline" size={36} color={COLORS.gold[500]} />
        </View>
        <Text className="text-slate-900 font-bold text-lg text-center mb-2">
          Real-Time Notifications
        </Text>
        <Text className="text-slate-500 text-sm text-center leading-5">
          You'll receive push notifications on your device for important events like committee updates, payment reminders, and payout credits — even when the app is closed.
        </Text>
        <View className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <Text className="text-amber-700 text-xs font-semibold text-center">
            Notifications are delivered in real-time via your device's notification bar.
          </Text>
        </View>
      </View>
    </View>
  );
}
