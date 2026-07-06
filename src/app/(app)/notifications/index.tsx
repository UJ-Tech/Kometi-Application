// src/app/(app)/notifications/index.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useNotificationsStore } from "../../../stores/notifications.store";
import { COLORS } from "../../../constants/theme";
import ScreenHeader from "../../../components/shared/ScreenHeader";
import { useAlertModal } from "../../../components/ui/AlertModal";
import type { AppNotification } from "../../../types";

const NOTIF_ICON: Record<string, { name: string; color: string }> = {
  COMMITTEE_PAYOUT: { name: "trophy-outline", color: "#f59e0b" },
  INSTALLMENT_DUE: { name: "time-outline", color: "#ef4444" },
  INSTALLMENT_PAID: { name: "checkmark-circle-outline", color: "#22c55e" },
  WALLET_CREDIT: { name: "wallet-outline", color: "#22c55e" },
  WALLET_DEBIT: { name: "wallet-outline", color: "#ef4444" },
  COMMITTEE_START: { name: "people-outline", color: "#6366f1" },
  KYC_UPDATE: { name: "document-text-outline", color: "#64748b" },
};

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { alert, AlertComponent } = useAlertModal();
  const {
    notifications,
    unreadCount,
    isLoading,
    hasMore,
    fetchNotifications,
    fetchUnreadCount,
    markRead,
    markAllRead,
    newNotificationVersion,
  } = useNotificationsStore();

  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchNotifications(true);
    fetchUnreadCount();
  }, []);

  // Refetch when socket triggers new notification
  useEffect(() => {
    if (newNotificationVersion > 0) {
      fetchNotifications(true);
      fetchUnreadCount();
    }
  }, [newNotificationVersion]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchNotifications(true), fetchUnreadCount()]);
    setRefreshing(false);
  };

  const handleLoadMore = () => {
    if (!isLoading && hasMore) {
      fetchNotifications(false);
    }
  };

  const handleMarkAllRead = async () => {
    await markAllRead();
  };

  const handlePress = async (notif: AppNotification) => {
    if (!notif.isRead) {
      await markRead(notif.id);
    }
  };

  const renderItem = ({ item }: { item: AppNotification }) => {
    const icon = NOTIF_ICON[item.type] || { name: "notifications-outline", color: "#64748b" };
    return (
      <TouchableOpacity
        onPress={() => handlePress(item)}
        activeOpacity={0.7}
        className={`px-4 py-3.5 border-b border-slate-100 ${
          !item.isRead ? "bg-amber-50/40" : "bg-white"
        }`}
      >
        <View className="flex-row items-start gap-3">
          <View
            className="w-10 h-10 rounded-full items-center justify-center mt-0.5"
            style={{ backgroundColor: `${icon.color}15` }}
          >
            <Ionicons name={icon.name as any} size={20} color={icon.color} />
          </View>
          <View className="flex-1">
            <View className="flex-row items-center justify-between">
              <Text
                className={`text-sm flex-1 ${!item.isRead ? "font-bold text-slate-900" : "font-semibold text-slate-700"}`}
                numberOfLines={1}
              >
                {item.title}
              </Text>
              {!item.isRead && (
                <View className="w-2 h-2 rounded-full bg-amber-500 ml-2" />
              )}
            </View>
            <Text className="text-xs text-slate-500 mt-1" numberOfLines={2}>
              {item.body}
            </Text>
            <Text className="text-[10px] text-slate-400 mt-1.5">
              {timeAgo(item.createdAt)}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View className="flex-1 bg-surface-50">
      <ScreenHeader title="Notifications" showBack />

      {unreadCount > 0 && (
        <TouchableOpacity
          onPress={handleMarkAllRead}
          className="px-4 py-2.5 border-b border-slate-100 bg-white"
        >
          <Text className="text-amber-600 text-xs font-bold text-right">
            Mark all as read ({unreadCount} unread)
          </Text>
        </TouchableOpacity>
      )}

      <FlatList
        data={notifications}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={COLORS.brandPrimary}
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={
          !isLoading ? (
            <View className="flex-1 items-center justify-center py-20">
              <Ionicons name="notifications-off-outline" size={48} color="#cbd5e1" />
              <Text className="text-slate-400 text-sm mt-4">No notifications yet</Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          isLoading ? (
            <View className="py-4">
              <ActivityIndicator size="small" color={COLORS.brandPrimary} />
            </View>
          ) : null
        }
      />

      <AlertComponent />
    </View>
  );
}
