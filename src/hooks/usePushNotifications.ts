// src/hooks/usePushNotifications.ts
// Registers device for Expo push notifications and handles foreground display.

import { useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { useRouter } from "expo-router";
import { useAuthStore } from "../stores/auth.store";
import apiClient from "../services/api.client";

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export function usePushNotifications() {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const userId = useAuthStore((s) => s.user?.id);
  const tokenRegistered = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || !userId || tokenRegistered.current) return;

    registerForPushNotifications();
  }, [isAuthenticated, userId]);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      router.push("/(app)/notifications");
    });
    return () => sub.remove();
  }, []);

  async function registerForPushNotifications() {
    try {
      // 1. Check permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== "granted") {
        console.log("[Push] Notification permission not granted");
        return;
      }

      // 2. Get Expo push token
      const tokenData = await Notifications.getExpoPushTokenAsync();
      const expoPushToken = tokenData.data;

      // 3. Android channel setup
      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("default", {
          name: "Monio Notifications",
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: "#b8860b",
        });
      }

      // 4. Register token with backend
      await apiClient.post("/members/device-token", { token: expoPushToken });
      tokenRegistered.current = true;
      console.log("[Push] Token registered successfully");
    } catch (err) {
      console.error("[Push] Registration failed:", err);
    }
  }
}
