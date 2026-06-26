// src/app/(app)/dashboard/index.tsx
// Kometi Member & Organizer Premium Dashboard Home.

import React, { useState, useEffect, useRef } from "react";
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, StyleSheet } from "react-native";
import { useRouter } from "expo-router";

import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../../../stores/auth.store";
import { useWalletStore } from "../../../stores/wallet.store";
import { useCommitteeStore } from "../../../stores/committee.store";
import { useInstallmentStore } from "../../../stores/installment.store";
import { authApi } from "../../../services/auth.api";
import { tokenStorage } from "../../../utils/storage";
import { formatINR } from "../../../utils/currency";
import { canAccessAdminPanel, canCreateCommittee, canViewMembers } from "../../../utils/rbac";
import { COLORS } from "../../../constants/theme";
import Card from "../../../components/ui/Card";
import Avatar from "../../../components/ui/Avatar";
import { useAlertModal } from "../../../components/ui/AlertModal";

export default function Dashboard() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { alert, confirm, AlertComponent } = useAlertModal();
  
  const { balancePaise, transactions, fetchWalletData } = useWalletStore();
  const { fetchCommittees } = useCommitteeStore();
  const { upcomingDues, fetchUpcomingDues } = useInstallmentStore();

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Socket-triggered refresh (wallet updates, contributions, committee changes)
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

  const canOpenAdminPanel = canAccessAdminPanel(user?.role);
  const canOpenCommitteeCreation = canCreateCommittee(user?.role);
  const canOpenMembers = canViewMembers(user?.role);

  return (
    <ScrollView
      className="flex-1 bg-surface-100 px-4"
      contentContainerStyle={{ paddingTop: 64, paddingBottom: 110 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={loadData}
          tintColor={COLORS.brandPrimary}
        />
      }
    >
      {/* Header section */}
      <View className="flex-row items-center justify-between mb-8">
        <View className="flex-row items-center">
          <Avatar
            name={user?.name || "Kometi"}
            imageUrl={user?.profileImageUrl || undefined}
            size={48}
            showOnline
          />
          <View className="ml-3.5">
            <Text className="text-slate-400 text-xs font-semibold">Namaste,</Text>
            <Text className="text-slate-900 text-lg font-bold">{user?.name || "Kometi User"}</Text>
          </View>
        </View>

        <View className="flex-row gap-2.5">
          {canOpenAdminPanel && (
            <TouchableOpacity
              onPress={() => router.push("/dashboard/admin")}
              className="w-10 h-10 bg-brand-500/10 border border-brand-500/25 rounded-full items-center justify-center"
            >
              <Ionicons name="shield-checkmark-outline" size={20} color={COLORS.brandPrimary} />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={() => router.push("/settings/change-password")}
            className="w-10 h-10 bg-brand-50 rounded-full items-center justify-center border border-brand-100"
          >
            <Ionicons name="settings-outline" size={20} color={COLORS.brandPrimary} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleLogout}
            className="w-10 h-10 bg-danger-500/10 border border-danger-500/25 rounded-full items-center justify-center"
          >
            <Ionicons name="log-out-outline" size={20} color={COLORS.danger.DEFAULT} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Wallet Balance Hero Card — keeps premium dark indigo gradient */}
      <Card gradient style={{ marginBottom: 24 }}>
        <View className="p-6">
          <Text className="text-white/60 text-xs font-semibold tracking-wider uppercase mb-1">
            Wallet Balance
          </Text>
          <Text className="text-white text-3xl font-bold mb-5">
            {formatINR(balancePaise)}
          </Text>

          <View className="flex-row justify-between gap-3">
            <TouchableOpacity
              onPress={() => router.push("/wallet")}
              className="flex-1 bg-white/10 h-11 rounded-lg items-center justify-center flex-row"
            >
              <Ionicons name="add-circle-outline" size={18} color="#fff" />
              <Text className="text-white font-bold ml-1.5 text-sm">Add Money</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push("/wallet")}
              className="flex-1 bg-amber-500 h-11 rounded-lg items-center justify-center flex-row"
            >
              <Ionicons name="send-outline" size={16} color="#fff" />
              <Text className="text-white font-bold ml-1.5 text-sm">Transfer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Card>

      {/* Dues Quick Info Bar */}
      {upcomingDues.length > 0 ? (
        <TouchableOpacity
          onPress={() => router.push("/installments")}
          className="mb-6 flex-row items-center justify-between bg-red-50 border border-red-200 p-4 rounded-xl"
        >
          <View className="flex-row items-center flex-1 pr-4">
            <Ionicons name="alert-circle" size={20} color={COLORS.danger.DEFAULT} />
            <View className="ml-3">
              <Text className="text-red-700 font-bold text-sm">Upcoming chit dues</Text>
              <Text className="text-red-500 text-xs mt-0.5">
                You have {upcomingDues.length} pending installment(s) due soon.
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={COLORS.danger.DEFAULT} />
        </TouchableOpacity>
      ) : null}

      {/* Main Grid Shortcuts */}
      <Text className="text-slate-800 text-base font-bold mb-4">Quick Actions</Text>
      <View className="flex-row flex-wrap gap-4 mb-8">
        <TouchableOpacity
          onPress={() => router.push("/committees")}
          style={styles.gridBtn}
          className="bg-white border border-slate-100 items-center justify-center"
        >
          <View className="w-12 h-12 rounded-full bg-indigo-50 items-center justify-center mb-2 border border-indigo-100">
            <Ionicons name="people-circle" size={26} color={COLORS.brandPrimary} />
          </View>
          <Text className="text-slate-700 font-semibold text-xs">My Chits</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push("/installments")}
          style={styles.gridBtn}
          className="bg-white border border-slate-100 items-center justify-center"
        >
          <View className="w-12 h-12 rounded-full bg-amber-50 items-center justify-center mb-2 border border-amber-100">
            <Ionicons name="calendar-clear" size={24} color={COLORS.goldPrimary} />
          </View>
          <Text className="text-slate-700 font-semibold text-xs">Chit Dues</Text>
        </TouchableOpacity>

        {canOpenMembers && (
          <TouchableOpacity
            onPress={() => router.push("/members")}
            style={styles.gridBtn}
            className="bg-white border border-slate-100 items-center justify-center"
          >
            <View className="w-12 h-12 rounded-full bg-emerald-50 items-center justify-center mb-2 border border-emerald-100">
              <Ionicons name="person-add" size={24} color={COLORS.success.DEFAULT} />
            </View>
            <Text className="text-slate-700 font-semibold text-xs">Members</Text>
          </TouchableOpacity>
        )}

        {canOpenCommitteeCreation && (
          <TouchableOpacity
            onPress={() => router.push("/committees/create")}
            style={styles.gridBtn}
            className="bg-white border border-slate-100 items-center justify-center"
          >
            <View className="w-12 h-12 rounded-full bg-indigo-50 items-center justify-center mb-2 border border-indigo-100">
              <Ionicons name="add-circle" size={26} color={COLORS.brandPrimary} />
            </View>
            <Text className="text-slate-700 font-semibold text-xs">Create Chit</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Recent Activities */}
      <View className="flex-row items-center justify-between mb-4">
        <Text className="text-slate-800 text-base font-bold">Recent Transactions</Text>
        <TouchableOpacity onPress={() => router.push("/wallet")}>
          <Text className="text-brand-500 text-xs font-semibold">View All</Text>
        </TouchableOpacity>
      </View>

      {transactions.slice(0, 3).map((tx) => (
        <View
          key={tx.id}
          className="flex-row items-center justify-between bg-white border border-slate-100 rounded-xl p-4 mb-3"
        >
          <View className="flex-row items-center">
            <View
              className={`w-10 h-10 rounded-full items-center justify-center ${
                tx.type === "CREDIT" ? "bg-emerald-50" : "bg-red-50"
              }`}
            >
              <Ionicons
                name={tx.type === "CREDIT" ? "arrow-down" : "arrow-up"}
                size={18}
                color={tx.type === "CREDIT" ? COLORS.success.DEFAULT : COLORS.danger.DEFAULT}
              />
            </View>
            <View className="ml-3">
              <Text className="text-slate-800 font-bold text-sm">{tx.description}</Text>
              <Text className="text-slate-400 text-xs mt-0.5">
                {new Date(tx.createdAt).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                })}
              </Text>
            </View>
          </View>

          <Text
            className={`font-bold text-sm ${
              tx.type === "CREDIT" ? "text-emerald-600" : "text-slate-700"
            }`}
          >
            {tx.type === "CREDIT" ? "+" : "-"}
            {formatINR(tx.amountPaise)}
          </Text>
        </View>
      ))}

      {transactions.length === 0 && (
        <View className="items-center py-6 bg-white rounded-xl border border-dashed border-slate-200">
          <Text className="text-slate-400 text-xs">No recent transactions</Text>
        </View>
      )}

      <AlertComponent />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  gridBtn: {
    width: "30%",
    aspectRatio: 1.1,
    borderRadius: 16,
  },
});
