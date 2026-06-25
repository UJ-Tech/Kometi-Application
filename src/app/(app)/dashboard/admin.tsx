import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Modal,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";

import { Ionicons } from "@expo/vector-icons";
import { adminApi, type AdminDashboardStats } from "../../../services/admin.api";
import { membersApi } from "../../../services/members.api";
import { useAuthStore } from "../../../stores/auth.store";
import { canAccessAdminPanel } from "../../../utils/rbac";
import type { User, UserRole } from "../../../types";
import { formatINR } from "../../../utils/currency";
import { COLORS } from "../../../constants/theme";
import Card from "../../../components/ui/Card";
import Badge from "../../../components/ui/Badge";
import { useAlertModal } from "../../../components/ui/AlertModal";

type TabKey = "overview" | "users" | "committees" | "wallets" | "transactions";

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: "overview", label: "Overview", icon: "stats-chart" },
  { key: "users", label: "Users", icon: "people" },
  { key: "committees", label: "Committees", icon: "people-circle" },
  { key: "wallets", label: "Wallets", icon: "wallet" },
  { key: "transactions", label: "Transactions", icon: "swap-horizontal" },
];

export default function AdminDashboard() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const canOpenAdminPanel = canAccessAdminPanel(user?.role);
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [roleModalVisible, setRoleModalVisible] = useState(false);
  const { alert, confirm, AlertComponent } = useAlertModal();

  useEffect(() => {
    if (user && !canOpenAdminPanel) {
      router.replace("/(app)/dashboard");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canOpenAdminPanel, router, user]);

  const loadData = async () => {
    if (!canOpenAdminPanel) {
      setIsLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      setRefreshing(true);
      const [statsRes, usersRes] = await Promise.all([
        adminApi.getDashboardStats(),
        membersApi.list({ limit: 200 }),
      ]);
      setStats(statsRes.data.data);
      setUsers(usersRes.data.data);
    } catch (err) {
      console.error("[AdminDashboard] loadData failed:", err);
      await alert("Error", err instanceof Error ? err.message : "Failed to load dashboard data");
    } finally {
      setRefreshing(false);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!canOpenAdminPanel) {
      setIsLoading(false);
      return;
    }
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canOpenAdminPanel]);

  if (user && !canOpenAdminPanel) return null;

  const handleRoleUpdate = async (role: UserRole) => {
    if (!selectedUser) return;
    try {
      setRoleModalVisible(false);
      setIsLoading(true);
      await adminApi.updateUserRole(selectedUser.id, role);
      await alert("Success", `User role updated to ${role} successfully`);
      loadData();
    } catch (err) {
      console.error("[AdminDashboard] handleRoleUpdate failed:", err);
      await alert("Error", err instanceof Error ? err.message : "Failed to update user role");
      setIsLoading(false);
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.phone.includes(searchQuery) ||
      (u.email && u.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const getRoleColor = (role: UserRole) => {
    switch (role) {
      case "ADMIN": return COLORS.danger.DEFAULT;
      case "MANAGER": return COLORS.brandPrimary;
      case "ACCOUNTANT": return COLORS.info.DEFAULT;
      case "AGENT": return COLORS.warning.DEFAULT;
      case "ORGANIZER": return COLORS.goldPrimary;
      default: return COLORS.text.secondary;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ACTIVE": return COLORS.success.DEFAULT;
      case "COMPLETED": return COLORS.brandPrimary;
      case "DRAFT": return COLORS.warning.DEFAULT;
      case "CANCELLED": return COLORS.danger.DEFAULT;
      case "PAID": return COLORS.success.DEFAULT;
      case "PENDING": return COLORS.warning.DEFAULT;
      case "OVERDUE": return COLORS.danger.DEFAULT;
      default: return COLORS.text.secondary;
    }
  };

  if (isLoading && !refreshing) {
    return (
      <View className="flex-1 bg-surface-bg items-center justify-center">
        <ActivityIndicator size="large" color={COLORS.brandPrimary} />
        <Text className="text-slate-500 mt-4 font-semibold">Loading admin dashboard...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-surface-bg">
      {/* Header */}
      <View className="px-4 pt-14 pb-3">
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-row items-center">
            <TouchableOpacity
              onPress={() => router.back()}
              className="w-10 h-10 bg-surface-card rounded-full items-center justify-center border border-slate-100 mr-3"
            >
              <Ionicons name="arrow-back" size={20} color="#64748b" />
            </TouchableOpacity>
            <View>
              <Text className="text-slate-500 text-xs font-semibold uppercase tracking-widest">Kometi Panel</Text>
              <Text className="text-slate-900 text-xl font-bold">Admin Dashboard</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={loadData}
            className="w-10 h-10 bg-surface-card rounded-full items-center justify-center border border-slate-100"
          >
            <Ionicons name="refresh-outline" size={20} color="#64748b" />
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              className={`flex-row items-center px-4 py-2 rounded-full ${
                activeTab === tab.key
                  ? "bg-brand-500"
                  : "bg-surface-card border border-slate-100"
              }`}
            >
              <Ionicons
                name={tab.icon as any}
                size={14}
                color={activeTab === tab.key ? "#fff" : "#64748b"}
              />
              <Text
                className={`ml-1.5 text-xs font-bold ${
                  activeTab === tab.key ? "text-white" : "text-slate-500"
                }`}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Content */}
      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={loadData}
            tintColor={COLORS.brandPrimary}
          />
        }
      >
        {activeTab === "overview" && renderOverview()}
        {activeTab === "users" && renderUsers()}
        {activeTab === "committees" && renderCommittees()}
        {activeTab === "wallets" && renderWallets()}
        {activeTab === "transactions" && renderTransactions()}

        <AlertComponent />
      </ScrollView>

      {/* Role Modal */}
      <Modal
        visible={roleModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRoleModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Card style={styles.modalCard}>
            <View className="p-6">
              <View className="flex-row justify-between items-center mb-5">
                <Text className="text-slate-900 font-bold text-lg">Change User Role</Text>
                <TouchableOpacity onPress={() => setRoleModalVisible(false)}>
                  <Ionicons name="close" size={24} color="#64748b" />
                </TouchableOpacity>
              </View>
              <Text className="text-slate-500 text-xs font-semibold mb-1">USER</Text>
              <Text className="text-slate-900 font-bold text-sm mb-4">{selectedUser?.name}</Text>
              <Text className="text-slate-500 text-xs font-semibold mb-3">SELECT ROLE</Text>
              <View className="gap-2.5">
                {(["ADMIN", "MANAGER", "ACCOUNTANT", "AGENT", "ORGANIZER", "MEMBER"] as UserRole[]).map((role) => (
                  <TouchableOpacity
                    key={role}
                    onPress={() => handleRoleUpdate(role)}
                    style={[
                      styles.roleBtn,
                      selectedUser?.role === role && {
                        borderColor: getRoleColor(role),
                        backgroundColor: getRoleColor(role) + "10",
                      },
                    ]}
                  >
                    <View className="flex-row items-center justify-between">
                      <Text
                        className="font-bold text-sm"
                        style={{ color: selectedUser?.role === role ? getRoleColor(role) : COLORS.text.primary }}
                      >
                        {role}
                      </Text>
                      {selectedUser?.role === role && (
                        <Ionicons name="checkmark-circle" size={18} color={getRoleColor(role)} />
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </Card>
        </View>
      </Modal>
    </View>
  );

  function renderOverview() {
    return (
      <View style={{ paddingTop: 16 }}>
        {/* Stat Cards */}
        <View className="flex-row flex-wrap gap-4 mb-6">
          <Card style={styles.statCard} padding={0}>
            <View className="p-4">
              <Ionicons name="cash-outline" size={24} color={COLORS.success.DEFAULT} />
              <Text className="text-slate-500 text-xs font-semibold mt-2">Total Collection</Text>
              <Text className="text-slate-900 text-lg font-bold mt-1">{formatINR(stats?.totalCollectionPaise || 0)}</Text>
            </View>
          </Card>
          <Card style={styles.statCard} padding={0}>
            <View className="p-4">
              <Ionicons name="pie-chart-outline" size={24} color={COLORS.goldPrimary} />
              <Text className="text-slate-500 text-xs font-semibold mt-2">Foreman Commission</Text>
              <Text className="text-gold-600 text-lg font-bold mt-1">{formatINR(stats?.profitOverviewPaise || 0)}</Text>
            </View>
          </Card>
          <Card style={styles.statCard} padding={0}>
            <View className="p-4">
              <Ionicons name="time-outline" size={24} color={COLORS.danger.DEFAULT} />
              <Text className="text-slate-500 text-xs font-semibold mt-2">Pending Payments</Text>
              <Text className="text-slate-900 text-lg font-bold mt-1">{formatINR(stats?.pendingPaymentsPaise || 0)}</Text>
            </View>
          </Card>
          <Card style={styles.statCard} padding={0}>
            <View className="p-4">
              <Ionicons name="wallet-outline" size={24} color={COLORS.brandPrimary} />
              <Text className="text-slate-500 text-xs font-semibold mt-2">Total Wallet Balance</Text>
              <Text className="text-slate-900 text-lg font-bold mt-1">{formatINR(stats?.totalWalletBalancePaise || 0)}</Text>
            </View>
          </Card>
        </View>

        {/* Summary Row */}
        <View className="flex-row gap-4 mb-6">
          <Card style={{ flex: 1 }} padding={0}>
            <View className="p-4 items-center">
              <Text className="text-slate-900 text-2xl font-bold">{stats?.totalUsersCount || 0}</Text>
              <Text className="text-slate-500 text-xs font-semibold mt-1">Total Users</Text>
            </View>
          </Card>
          <Card style={{ flex: 1 }} padding={0}>
            <View className="p-4 items-center">
              <Text className="text-slate-900 text-2xl font-bold">{stats?.activeCommitteesCount || 0}</Text>
              <Text className="text-slate-500 text-xs font-semibold mt-1">Active Chits</Text>
            </View>
          </Card>
          <Card style={{ flex: 1 }} padding={0}>
            <View className="p-4 items-center">
              <Text className="text-slate-900 text-2xl font-bold">{stats?.allCommittees?.length || 0}</Text>
              <Text className="text-slate-500 text-xs font-semibold mt-1">Total Chits</Text>
            </View>
          </Card>
        </View>

        {/* Users by Role */}
        {stats?.userStats && Object.keys(stats.userStats).length > 0 && (
          <>
            <Text className="text-slate-900 text-base font-bold mb-3">Users by Role</Text>
            <Card style={{ marginBottom: 24 }} padding={0}>
              <View className="p-4">
                {Object.entries(stats.userStats).map(([role, count]) => (
                  <View key={role} className="flex-row items-center justify-between py-2.5 border-b border-slate-100">
                    <View className="flex-row items-center">
                      <View className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: getRoleColor(role as UserRole) }} />
                      <Text className="text-slate-900 font-semibold text-sm">{role}</Text>
                    </View>
                    <Text className="text-slate-700 font-bold text-sm">{count}</Text>
                  </View>
                ))}
              </View>
            </Card>
          </>
        )}

        {/* Committees by Status */}
        {stats?.committeeStats && (
          <>
            <Text className="text-slate-900 text-base font-bold mb-3">Chits by Status</Text>
            <Card style={{ marginBottom: 24 }} padding={0}>
              <View className="p-4">
                {Object.entries(stats.committeeStats).map(([status, count]) => (
                  <View key={status} className="flex-row items-center justify-between py-2.5 border-b border-slate-100">
                    <View className="flex-row items-center">
                      <View className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: getStatusColor(status) }} />
                      <Text className="text-slate-900 font-semibold text-sm">{status}</Text>
                    </View>
                    <Text className="text-slate-700 font-bold text-sm">{count}</Text>
                  </View>
                ))}
              </View>
            </Card>
          </>
        )}

        {/* Installments by Status */}
        {stats?.installmentStats && Object.keys(stats.installmentStats).length > 0 && (
          <>
            <Text className="text-slate-900 text-base font-bold mb-3">Installments by Status</Text>
            <Card style={{ marginBottom: 24 }} padding={0}>
              <View className="p-4">
                {Object.entries(stats.installmentStats).map(([status, count]) => (
                  <View key={status} className="flex-row items-center justify-between py-2.5 border-b border-slate-100">
                    <View className="flex-row items-center">
                      <View className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: getStatusColor(status) }} />
                      <Text className="text-slate-900 font-semibold text-sm">{status}</Text>
                    </View>
                    <Text className="text-slate-700 font-bold text-sm">{count}</Text>
                  </View>
                ))}
              </View>
            </Card>
          </>
        )}

        {/* Monthly Analytics */}
        <Text className="text-slate-900 text-base font-bold mb-3">Monthly Analytics</Text>
        <Card style={{ marginBottom: 24 }} padding={0}>
          <View className="p-5">
            <View className="flex-row border-b border-slate-100 pb-2 mb-3">
              <Text className="flex-1 text-slate-500 font-bold text-xs">Month</Text>
              <Text className="w-28 text-right text-slate-500 font-bold text-xs">Collection</Text>
              <Text className="w-24 text-right text-slate-500 font-bold text-xs">Profit</Text>
            </View>
            {(stats?.monthlyAnalytics || []).map((item, idx) => (
              <View key={idx} className="flex-row py-2.5 border-b border-slate-100 items-center">
                <Text className="flex-1 text-slate-900 font-semibold text-sm">{item.month}</Text>
                <Text className="w-28 text-right text-slate-900 font-bold text-sm">{formatINR(item.collectionPaise)}</Text>
                <Text className="w-24 text-right text-gold-600 font-bold text-sm">{formatINR(item.profitPaise)}</Text>
              </View>
            ))}
            {(!stats?.monthlyAnalytics || stats.monthlyAnalytics.length === 0) && (
              <Text className="text-center text-slate-500 py-4 text-xs">No analytics data available</Text>
            )}
          </View>
        </Card>
      </View>
    );
  }

  function renderUsers() {
    return (
      <View style={{ paddingTop: 16 }}>
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-slate-900 text-base font-bold">User Management</Text>
          <Badge label={`${users.length} Users`} variant="info" />
        </View>

        <View className="flex-row bg-white border border-slate-200 rounded-xl px-4 items-center mb-4 h-11">
          <Ionicons name="search-outline" size={18} color="#64748b" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search by name, phone or email..."
            placeholderTextColor="#94a3b8"
            className="flex-1 text-slate-900 text-sm ml-2.5"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={16} color="#64748b" />
            </TouchableOpacity>
          )}
        </View>

        {filteredUsers.map((userItem) => (
          <Card key={userItem.id} style={{ marginBottom: 12 }}>
            <View className="p-4 flex-row items-center justify-between">
              <View className="flex-1 pr-4">
                <Text className="text-slate-900 font-bold text-sm">{userItem.name}</Text>
                <Text className="text-slate-500 text-xs mt-0.5">{userItem.phone}</Text>
                {userItem.email ? (
                  <Text className="text-slate-500 text-[10px] mt-0.5">{userItem.email}</Text>
                ) : null}
                <Text className="text-slate-500 text-[10px] mt-1">ID: {userItem.id.slice(0, 8)}...</Text>
              </View>
              <View className="items-end">
                <View className="mb-2">
                  <Badge
                    label={userItem.role}
                    variant="brand"
                    style={{
                      backgroundColor: getRoleColor(userItem.role) + "20",
                      borderColor: getRoleColor(userItem.role),
                      borderWidth: 1,
                    }}
                    textStyle={{ color: getRoleColor(userItem.role) }}
                  />
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setSelectedUser(userItem);
                    setRoleModalVisible(true);
                  }}
                  className="bg-brand-50 border border-brand-200/50 px-3 py-1.5 rounded-lg"
                >
                  <Text className="text-brand-600 text-xs font-bold">Assign Role</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Card>
        ))}

        {filteredUsers.length === 0 && (
          <View className="items-center py-8 bg-slate-50/50 border border-dashed border-slate-200 rounded-xl">
            <Text className="text-slate-500 text-xs">No users found matching query</Text>
          </View>
        )}
      </View>
    );
  }

  function renderCommittees() {
    const committees = stats?.allCommittees || [];
    return (
      <View style={{ paddingTop: 16 }}>
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-slate-900 text-base font-bold">All Chits</Text>
          <Badge label={`${committees.length} Total`} variant="info" />
        </View>

        {committees.map((committee) => (
          <Card key={committee.id} style={{ marginBottom: 12 }}>
            <View className="p-4">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-slate-900 font-bold text-sm flex-1" numberOfLines={1}>{committee.name}</Text>
                <Badge
                  label={committee.status}
                  variant="brand"
                  style={{
                    backgroundColor: getStatusColor(committee.status) + "20",
                    borderColor: getStatusColor(committee.status),
                    borderWidth: 1,
                  }}
                  textStyle={{ color: getStatusColor(committee.status) }}
                />
              </View>
              <View className="flex-row items-center gap-4 mt-2">
                <View className="flex-row items-center">
                  <Ionicons name="people-outline" size={12} color="#64748b" />
                  <Text className="text-slate-500 text-xs ml-1">
                    {committee.filledSlots}/{committee.totalSlots}
                  </Text>
                </View>
                <View className="flex-row items-center">
                  <Ionicons name="cash-outline" size={12} color="#64748b" />
                  <Text className="text-slate-500 text-xs ml-1">{formatINR(committee.installmentAmountPaise)}</Text>
                </View>
                <View className="flex-row items-center">
                  <Ionicons name="person-outline" size={12} color="#64748b" />
                  <Text className="text-slate-500 text-xs ml-1">{committee.organizer?.name}</Text>
                </View>
              </View>
              <Text className="text-slate-500 text-[10px] mt-2">ID: {committee.id.slice(0, 8)}...</Text>
            </View>
          </Card>
        ))}

        {committees.length === 0 && (
          <View className="items-center py-8 bg-slate-50/50 border border-dashed border-slate-200 rounded-xl">
            <Text className="text-slate-500 text-xs">No committees found</Text>
          </View>
        )}
      </View>
    );
  }

  function renderWallets() {
    const wallets = stats?.wallets || [];
    return (
      <View style={{ paddingTop: 16 }}>
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-slate-900 text-base font-bold">All Wallets</Text>
          <Badge label={`${wallets.length} Wallets`} variant="info" />
        </View>

        <Card style={{ marginBottom: 16 }} padding={0}>
          <View className="p-4 items-center">
            <Text className="text-slate-500 text-xs font-semibold">Total System Balance</Text>
            <Text className="text-slate-900 text-2xl font-bold mt-1">{formatINR(stats?.totalWalletBalancePaise || 0)}</Text>
          </View>
        </Card>

        {wallets.map((wallet) => (
          <Card key={wallet.id} style={{ marginBottom: 12 }}>
            <View className="p-4 flex-row items-center justify-between">
              <View className="flex-1">
                <Text className="text-slate-900 font-bold text-sm">{wallet.user?.name}</Text>
                <Text className="text-slate-500 text-xs mt-0.5">{wallet.user?.phone}</Text>
                <Badge
                  label={wallet.user?.role || "N/A"}
                  variant="brand"
                  style={{
                    backgroundColor: getRoleColor(wallet.user?.role as UserRole) + "20",
                    borderColor: getRoleColor(wallet.user?.role as UserRole),
                    borderWidth: 1,
                    marginTop: 4,
                    alignSelf: "flex-start",
                  }}
                  textStyle={{ color: getRoleColor(wallet.user?.role as UserRole) }}
                />
              </View>
              <Text className="text-slate-900 font-bold text-base">{formatINR(wallet.balancePaise)}</Text>
            </View>
          </Card>
        ))}

        {wallets.length === 0 && (
          <View className="items-center py-8 bg-slate-50/50 border border-dashed border-slate-200 rounded-xl">
            <Text className="text-slate-500 text-xs">No wallets found</Text>
          </View>
        )}
      </View>
    );
  }

  function renderTransactions() {
    const txs = stats?.recentTransactions || [];
    return (
      <View style={{ paddingTop: 16 }}>
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-slate-900 text-base font-bold">Recent Transactions</Text>
          <Badge label={`${txs.length} Latest`} variant="info" />
        </View>

        {txs.map((tx: any) => (
          <Card key={tx.id} style={{ marginBottom: 12 }}>
            <View className="p-4 flex-row items-center justify-between">
              <View className="flex-row items-center flex-1">
                <View
                  className={`w-10 h-10 rounded-full items-center justify-center ${
                    tx.type === "CREDIT" ? "bg-success-500/10" : "bg-danger-500/10"
                  }`}
                >
                  <Ionicons
                    name={tx.type === "CREDIT" ? "arrow-down" : "arrow-up"}
                    size={18}
                    color={tx.type === "CREDIT" ? COLORS.success.DEFAULT : COLORS.danger.DEFAULT}
                  />
                </View>
                <View className="ml-3 flex-1">
                  <Text className="text-slate-900 font-bold text-sm" numberOfLines={1}>{tx.description}</Text>
                  <Text className="text-slate-500 text-xs mt-0.5">
                    {tx.user?.name || "System"} · {new Date(tx.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" })}
                  </Text>
                </View>
              </View>
              <Text className={`font-bold text-sm ${tx.type === "CREDIT" ? "text-success-700" : "text-slate-900"}`}>
                {tx.type === "CREDIT" ? "+" : "-"}{formatINR(tx.amountPaise)}
              </Text>
            </View>
          </Card>
        ))}

        {txs.length === 0 && (
          <View className="items-center py-8 bg-slate-50/50 border border-dashed border-slate-200 rounded-xl">
            <Text className="text-slate-500 text-xs">No recent transactions</Text>
          </View>
        )}
      </View>
    );
  }
}

const styles = StyleSheet.create({
  statCard: {
    width: "47%",
    borderRadius: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.60)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 20,
  },
  roleBtn: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "#f8fafc",
  },
});