import React, { useState, useEffect, useRef } from "react";
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { useScrollToTop } from "../../../hooks/useScrollToTop";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../../../stores/auth.store";
import { useWalletStore } from "../../../stores/wallet.store";
import { useCommitteeStore } from "../../../stores/committee.store";
import { useInstallmentStore } from "../../../stores/installment.store";
import { useNotificationsStore } from "../../../stores/notifications.store";
import { authApi } from "../../../services/auth.api";
import { tokenStorage } from "../../../utils/storage";
import { formatINR } from "../../../utils/currency";
import { canViewMembers } from "../../../utils/rbac";
import { COLORS, BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from "../../../constants/theme";
import Card from "../../../components/ui/Card";
import Avatar from "../../../components/ui/Avatar";
import KKMark, { KKMarkWatermark, KKDot } from "../../../components/brand/KKMark";
import { useAlertModal } from "../../../components/ui/AlertModal";



const QUICK_ACTIONS = [
  { key: "committees", icon: "people-circle", label: "My Chits", desc: "View your committees", color: COLORS.brand[500], bg: "rgba(99,102,241,0.08)", gradient: ["rgba(99,102,241,0.06)", "rgba(99,102,241,0.01)"] },
  { key: "installments", icon: "calendar-clear", label: "Chit Dues", desc: "Upcoming payments", color: COLORS.gold[500], bg: "rgba(245,158,11,0.08)", gradient: ["rgba(245,158,11,0.06)", "rgba(245,158,11,0.01)"] },
  { key: "members", icon: "person-add", label: "Members", desc: "Committee members", color: "#059669", bg: "rgba(5,150,105,0.08)", gradient: ["rgba(5,150,105,0.06)", "rgba(5,150,105,0.01)"] },
  { key: "create", icon: "add-circle", label: "Create Chit", desc: "Start a new committee", color: COLORS.brand[500], bg: "rgba(99,102,241,0.08)", gradient: ["rgba(99,102,241,0.06)", "rgba(99,102,241,0.01)"] },
  { key: "join", icon: "enter-outline", label: "Join Chit", desc: "Use invite code", color: COLORS.gold[500], bg: "rgba(245,158,11,0.08)", gradient: ["rgba(245,158,11,0.06)", "rgba(245,158,11,0.01)"] },
];

export default function Dashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [refreshing, setRefreshing] = useState(false);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { alert, confirm, AlertComponent } = useAlertModal();
  
  const { balancePaise, transactions, fetchWalletData } = useWalletStore();
  const { fetchCommittees } = useCommitteeStore();
  const { upcomingDues, fetchUpcomingDues } = useInstallmentStore();
  const { unreadCount, newNotificationVersion } = useNotificationsStore();

  const loadData = async () => {
    setRefreshing(true);
    await Promise.all([
      fetchWalletData(),
      fetchCommittees(),
      fetchUpcomingDues(),
    ]);
    setRefreshing(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const walletUpdatedVersion = useWalletStore((s) => s.walletUpdatedVersion);
  const contributionVersion = useCommitteeStore((s) => s.contributionUpdatedVersion);
  const resolvedVersion = useCommitteeStore((s) => s.monthResolvedVersion);
  const socketVersionSum = walletUpdatedVersion + contributionVersion + resolvedVersion;
  const lastSocketVersion = useRef(0);
  useEffect(() => {
    if (socketVersionSum > 0 && socketVersionSum !== lastSocketVersion.current) {
      lastSocketVersion.current = socketVersionSum;
      fetchWalletData();
      fetchUpcomingDues();
    }
  }, [socketVersionSum, fetchWalletData, fetchUpcomingDues]);

  const confirmLogout = async () => {
    return confirm("Logout", "Are you sure you want to logout?", { confirmLabel: "Logout", type: "warning" });
  };

  const handleLogout = async () => {
    const confirmed = await confirmLogout();
    if (!confirmed) return;

    try {
      const refreshToken = await tokenStorage.getRefreshToken();
      await authApi.logout({ refreshToken });
    } catch {
      // Local logout should still proceed even if revoke fails.
    } finally {
      await logout();
      router.replace("/(auth)/welcome");
    }
  };

  const canOpenMembers = canViewMembers();

  const handleAction = (key: string) => {
    switch (key) {
      case "committees": router.push("/committees"); break;
      case "installments": router.push("/installments"); break;
      case "members": if (canOpenMembers) router.push("/members"); break;
      case "create": router.push("/committees/create"); break;
      case "join": router.push("/(auth)/join-committee" as any); break;
    }
  };

  const scrollRef = useScrollToTop();

  return (
    <ScrollView
      ref={scrollRef}
      className="flex-1"
      style={{ backgroundColor: COLORS.surface.bg }}
      contentContainerStyle={{ paddingBottom: 120 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={loadData}
          tintColor={COLORS.brandPrimary}
        />
      }
    >
      {/* Hero Header */}
      <LinearGradient
        colors={["#1e1b4b", "#312e81", "#3730a3"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          paddingTop: insets.top + SPACING[4],
          paddingHorizontal: SPACING[5],
          paddingBottom: SPACING[12],
          borderBottomLeftRadius: BORDER_RADIUS["4xl"],
          borderBottomRightRadius: BORDER_RADIUS["4xl"],
          position: "relative",
          overflow: "hidden",
        }}
      >
        <KKMarkWatermark size={200} color={COLORS.white} opacity={0.05} />

        {/* Header Row */}
        <View className="flex-row items-center justify-between mb-8">
          <View className="flex-row items-center">
            <Avatar
              name={user?.name || "Monio"}
              imageUrl={user?.profileImageUrl || undefined}
              size={48}
              showOnline
            />
            <View className="ml-3">
              <Text className="text-white/60 text-xs font-semibold">Namaste,</Text>
              <Text className="text-white text-lg font-bold">{user?.name || "Monio User"}</Text>
            </View>
          </View>

          <View className="flex-row gap-2.5">
            <TouchableOpacity
              onPress={() => router.push("/notifications")}
              className="w-10 h-10 rounded-full items-center justify-center relative"
              style={{ backgroundColor: "rgba(255,255,255,0.1)" }}
            >
              <Ionicons name="notifications-outline" size={20} color={COLORS.white} />
              {unreadCount > 0 && (
                <View className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full items-center justify-center">
                  <Text className="text-white text-[10px] font-bold">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleLogout}
              className="w-10 h-10 rounded-full items-center justify-center"
              style={{ backgroundColor: "rgba(255,255,255,0.1)" }}
            >
              <Ionicons name="log-out-outline" size={20} color={COLORS.white} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Balance Card */}
        <View className="rounded-2xl p-5"
          style={{
            backgroundColor: "rgba(255,255,255,0.08)",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.1)",
          }}
        >
          <View className="flex-row items-center gap-2 mb-2">
            <KKDot size={6} color={COLORS.gold[400]} />
            <Text className="text-white/60 text-xs font-semibold tracking-wider uppercase">
              Wallet Balance
            </Text>
          </View>
          <Text className="text-white text-4xl font-bold mb-4" style={{ letterSpacing: -1 }}>
            {formatINR(balancePaise)}
          </Text>

          <View className="flex-row gap-3">
            <TouchableOpacity
              onPress={() => router.push("/wallet")}
              className="flex-1 h-11 rounded-xl items-center justify-center flex-row"
              style={{ backgroundColor: "rgba(245,158,11,0.2)" }}
            >
              <Ionicons name="add-circle-outline" size={18} color={COLORS.gold[300]} />
              <Text className="text-gold-300 font-bold ml-1.5 text-sm">Add Money</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push("/wallet/withdraw" as any)}
              className="flex-1 h-11 rounded-xl items-center justify-center flex-row"
              style={{ backgroundColor: "rgba(255,255,255,0.1)" }}
            >
              <Ionicons name="arrow-up-outline" size={18} color={COLORS.white} />
              <Text className="text-white font-bold ml-1.5 text-sm">Send</Text>
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

      {/* Content below hero */}
      <View style={{ paddingHorizontal: SPACING[5], marginTop: SPACING[3] }}>
        {/* Dues Alert */}
        {upcomingDues.length > 0 && (
          <TouchableOpacity
            onPress={() => router.push("/installments")}
            className="mb-5 flex-row items-center justify-between rounded-2xl p-4"
            style={{
              backgroundColor: "rgba(239,68,68,0.08)",
              borderWidth: 1,
              borderColor: "rgba(239,68,68,0.15)",
            }}
          >
            <View className="flex-row items-center flex-1 pr-4">
              <View className="w-10 h-10 rounded-xl items-center justify-center"
                style={{ backgroundColor: "rgba(239,68,68,0.15)" }}
              >
                <Ionicons name="alert-circle" size={20} color={COLORS.danger.DEFAULT} />
              </View>
              <View className="ml-3">
                <Text className="text-red-700 font-bold text-sm">Upcoming chit dues</Text>
                <Text className="text-red-500 text-xs mt-0.5">
                  You have {upcomingDues.length} pending installment(s) due soon.
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.danger.DEFAULT} />
          </TouchableOpacity>
        )}

        {/* Quick Actions */}
        <View className="mb-6">
          <View className="flex-row items-center justify-between mb-4 px-1">
            <View className="flex-row items-center gap-2">
              <View className="w-1 h-5 rounded-full" style={{ backgroundColor: COLORS.brand[500] }} />
              <Text className="text-slate-800 text-base font-bold">Quick Actions</Text>
            </View>
            <Text className="text-slate-400 text-[10px] font-medium">{QUICK_ACTIONS.filter(a => a.key !== "members" || canOpenMembers).length} shortcuts</Text>
          </View>
          <View className="flex-row flex-wrap" style={{ marginHorizontal: -4 }}>
            {QUICK_ACTIONS.map((action) => {
              if (action.key === "members" && !canOpenMembers) return null;
              const cardWidth = (width - SPACING[5] * 2 - 8) / 2;
              return (
                <TouchableOpacity
                  key={action.key}
                  onPress={() => handleAction(action.key)}
                  activeOpacity={0.7}
                  style={{
                    width: cardWidth,
                    margin: 4,
                    borderRadius: 16,
                    backgroundColor: COLORS.surface.card,
                    borderWidth: 1,
                    borderColor: COLORS.surface.border,
                    ...SHADOWS.cardSm,
                  }}
                >
                  <View style={{ padding: 14, gap: 10 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <View
                        style={{
                          width: 36, height: 36, borderRadius: 12,
                          backgroundColor: action.bg,
                          alignItems: "center", justifyContent: "center",
                        }}
                      >
                        <Ionicons name={action.icon as any} size={18} color={action.color} />
                      </View>
                      <Text className="text-slate-800 font-bold text-sm flex-1">{action.label}</Text>
                      <Ionicons name="chevron-forward" size={14} color={COLORS.text.muted} />
                    </View>
                    <Text className="text-slate-400 text-[10px] leading-4" style={{ paddingLeft: 46 }}>
                      {action.desc}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Recent Transactions */}
        <View className="mb-4">
          <View className="flex-row items-center justify-between mb-4">
            <View className="flex-row items-center gap-2">
              <View className="w-1 h-5 rounded-full" style={{ backgroundColor: COLORS.brand[500] }} />
              <Text className="text-slate-800 text-base font-bold">Recent Transactions</Text>
            </View>
            <TouchableOpacity onPress={() => router.push("/wallet")}>
              <Text className="text-brand-500 text-xs font-semibold">View All</Text>
            </TouchableOpacity>
          </View>

          {transactions.length > 0 && (
            <View className="bg-white rounded-2xl overflow-hidden" style={{ borderWidth: 1, borderColor: COLORS.surface.border, ...SHADOWS.cardSm }}>
              {transactions.slice(0, 5).map((tx, i) => {
                const isLast = i < Math.min(transactions.length, 5) - 1;
                return (
                  <TouchableOpacity
                    key={tx.id}
                    activeOpacity={0.7}
                    className="flex-row items-center px-4 py-3.5"
                    style={{ borderBottomWidth: isLast ? 1 : 0, borderColor: COLORS.surface.border }}
                  >
                    <View
                      className="w-9 h-9 rounded-xl items-center justify-center"
                      style={{
                        backgroundColor: tx.type === "CREDIT" ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                      }}
                    >
                      <Ionicons
                        name={tx.type === "CREDIT" ? "arrow-down" : "arrow-up"}
                        size={16}
                        color={tx.type === "CREDIT" ? COLORS.success.DEFAULT : COLORS.danger.DEFAULT}
                      />
                    </View>
                    <View className="ml-3 flex-1 min-w-0">
                      <Text className="text-slate-800 text-sm font-semibold" numberOfLines={1}>{tx.description || "Transaction"}</Text>
                      <View className="flex-row items-center mt-0.5 gap-2">
                        <Text className="text-slate-400 text-[10px]">
                          {new Date(tx.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        </Text>
                        {tx.status && (
                          <View
                            className="px-1.5 py-0.5 rounded-md"
                            style={{ backgroundColor: tx.status === "COMPLETED" ? "rgba(34,197,94,0.08)" : "rgba(245,158,11,0.08)" }}
                          >
                            <Text
                              className="text-[9px] font-semibold"
                              style={{ color: tx.status === "COMPLETED" ? COLORS.success.dark : COLORS.gold[600] }}
                            >
                              {tx.status === "COMPLETED" ? "Done" : "Pending"}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>

                    <View className="items-end ml-3">
                      <Text
                        className="font-bold text-sm"
                        style={{ color: tx.type === "CREDIT" ? COLORS.success.dark : COLORS.text.primary }}
                      >
                        {tx.type === "CREDIT" ? "+" : "-"}{formatINR(tx.amountPaise)}
                      </Text>
                      <Text className="text-slate-400 text-[9px] mt-0.5 uppercase tracking-wider">
                        {tx.type === "CREDIT" ? "Credit" : "Debit"}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {transactions.length === 0 && (
            <View className="items-center py-8 bg-white rounded-2xl border border-dashed border-slate-200">
              <KKMark size={32} color={COLORS.brand[200]} opacity={0.5} />
              <Text className="text-slate-400 text-xs mt-3">No recent transactions</Text>
            </View>
          )}
        </View>
      </View>

      <AlertComponent />
    </ScrollView>
  );
}
