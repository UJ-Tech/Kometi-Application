import React, { useEffect } from "react";
import { View, Text, FlatList, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNotificationsStore } from "../../../stores/notifications.store";
import { COLORS, SPACING, SHADOWS } from "../../../constants/theme";
import { useFlatListScrollToTop } from "../../../hooks/useScrollToTop";
import EmptyState from "../../../components/ui/EmptyState";
import ScreenHeader from "../../../components/shared/ScreenHeader";
import { useAlertModal } from "../../../components/ui/AlertModal";

const NOTIF_ICONS: Record<string, { name: keyof typeof Ionicons.glyphMap; color: string; bg: string }> = {
  INSTALLMENT_DUE:      { name: "calendar-outline",    color: COLORS.warning.dark, bg: "rgba(245,158,11,0.1)" },
  INSTALLMENT_PAID:     { name: "checkmark-circle",    color: COLORS.success.dark, bg: "rgba(34,197,94,0.1)" },
  COMMITTEE_PAYOUT:     { name: "wallet-outline",      color: COLORS.brand[600],  bg: "rgba(99,102,241,0.1)" },
  COMMITTEE_START:      { name: "flag-outline",        color: COLORS.info.dark,   bg: "rgba(14,165,233,0.1)" },
  KYC_UPDATE:           { name: "shield-checkmark",    color: COLORS.success.dark,bg: "rgba(34,197,94,0.1)" },
  WALLET_CREDIT:        { name: "arrow-down",          color: COLORS.success.dark,bg: "rgba(34,197,94,0.1)" },
  WALLET_DEBIT:         { name: "arrow-up",            color: COLORS.danger.dark, bg: "rgba(239,68,68,0.1)" },
};

export default function Notifications() {
  const { notifications, unreadCount, fetchNotifications, markAsRead, markAllAsRead } = useNotificationsStore();
  const { AlertComponent } = useAlertModal();
  const listRef = useFlatListScrollToTop();

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handlePress = (item: any) => {
    if (!item.isRead) markAsRead(item.id);
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.surface.bg, paddingHorizontal: SPACING[5] }}>
      <ScreenHeader title="Notifications" transparent />

      <FlatList
        ref={listRef}
        data={notifications}
        keyExtractor={(item: any) => item.id}
        contentContainerStyle={{ paddingBottom: 100, flexGrow: 1 }}
        ListHeaderComponent={
          unreadCount > 0 ? (
            <View className="flex-row items-center justify-between mb-3 px-1">
              <Text className="text-slate-500 text-xs font-medium">{unreadCount} unread</Text>
              <TouchableOpacity onPress={markAllAsRead} className="flex-row items-center" activeOpacity={0.7}>
                <Ionicons name="checkmark-done" size={14} color={COLORS.brand[500]} />
                <Text className="text-brand-500 text-xs font-semibold ml-1">Mark all as read</Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <EmptyState
            icon="notifications-off-outline"
            title="No notifications"
            description="You'll see updates about your committees, payments, and more here."
          />
        }
        renderItem={({ item }: { item: any }) => {
          const icon = NOTIF_ICONS[item.type] || { name: "information-circle" as const, color: COLORS.text.secondary, bg: "rgba(0,0,0,0.05)" };
          return (
            <TouchableOpacity
              onPress={() => handlePress(item)}
              activeOpacity={0.7}
              className="flex-row items-start bg-white rounded-2xl p-4 mb-3"
              style={{
                borderWidth: 1,
                borderColor: COLORS.surface.border,
                ...(!item.isRead ? { borderColor: COLORS.brand[200], backgroundColor: "rgba(99,102,241,0.03)" } : {}),
                ...SHADOWS.cardSm,
              }}
            >
              <View className="w-10 h-10 rounded-xl items-center justify-center" style={{ backgroundColor: icon.bg }}>
                <Ionicons name={icon.name} size={20} color={icon.color} />
              </View>
              <View className="ml-3 flex-1">
                <View className="flex-row items-center gap-2">
                  <Text className="text-slate-800 font-bold text-sm flex-1">{item.title}</Text>
                  {!item.isRead && (
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.brand[500] }} />
                  )}
                </View>
                <Text className="text-slate-500 text-xs mt-1 leading-5">{item.body}</Text>
                <Text className="text-slate-400 text-[10px] mt-1.5 font-medium">
                  {new Date(item.createdAt).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />
      <AlertComponent />
    </View>
  );
}
