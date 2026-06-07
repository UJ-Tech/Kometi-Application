import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Modal,
  Alert,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { adminApi, type AdminDashboardStats } from "../../../services/admin.api";
import { membersApi } from "../../../services/members.api";
import { useAuthStore } from "../../../stores/auth.store";
import { canAccessOrganizerDashboard } from "../../../utils/rbac";
import type { User, UserRole } from "../../../types";
import { formatINR } from "../../../utils/currency";
import { COLORS } from "../../../constants/theme";
import Card from "../../../components/ui/Card";
import Badge from "../../../components/ui/Badge";

export default function AdminDashboard() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const canOpenAdminPanel = canAccessOrganizerDashboard(user?.role);
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Role modification modal state
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [roleModalVisible, setRoleModalVisible] = useState(false);

  // Guard: redirect unauthorized users before loading admin data.
  useEffect(() => {
    if (user && !canOpenAdminPanel) {
      router.replace("/(app)/dashboard");
    }
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
        membersApi.list({ limit: 100 }),
      ]);
      setStats(statsRes.data.data);
      setUsers(usersRes.data.data);
    } catch (err) {
      console.error("[AdminDashboard] loadData failed:", err);
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to load dashboard data");
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
  }, [canOpenAdminPanel]);

  if (user && !canOpenAdminPanel) {
    return null;
  }

  const handleRoleUpdate = async (role: UserRole) => {
    if (!selectedUser) return;
    try {
      setRoleModalVisible(false);
      setIsLoading(true);
      await adminApi.updateUserRole(selectedUser.id, role);
      Alert.alert("Success", `User role updated to ${role} successfully`);
      loadData();
    } catch (err) {
      console.error("[AdminDashboard] handleRoleUpdate failed:", err);
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to update user role");
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
      case "ADMIN":
        return COLORS.danger.DEFAULT;
      case "MANAGER":
        return COLORS.brandPrimary;
      case "ACCOUNTANT":
        return COLORS.info.DEFAULT;
      case "AGENT":
        return COLORS.warning.DEFAULT;
      case "ORGANIZER":
        return COLORS.goldPrimary;
      default:
        return COLORS.text.secondary;
    }
  };

  if (isLoading && !refreshing) {
    return (
      <View className="flex-1 bg-surface-950 items-center justify-center">
        <ActivityIndicator size="large" color={COLORS.brandPrimary} />
        <Text className="text-neutral-400 mt-4 font-semibold">Loading admin stats...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-surface-950 px-4"
      contentContainerStyle={{ paddingTop: 64, paddingBottom: 120 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={loadData}
          tintColor={COLORS.brandPrimary}
        />
      }
    >
      <LinearGradient
        colors={[COLORS.brandPrimary + "15", "transparent"]}
        className="absolute inset-0 h-96"
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      {/* Header */}
      <View className="flex-row items-center justify-between mb-8">
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 bg-surface-card rounded-full items-center justify-center border border-brand-primary/10 mr-3"
          >
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>
          <View>
            <Text className="text-neutral-400 text-xs font-semibold uppercase tracking-widest">Kometi Panel</Text>
            <Text className="text-white text-xl font-bold">Admin Dashboard</Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={loadData}
          className="w-10 h-10 bg-surface-card rounded-full items-center justify-center border border-brand-primary/10"
        >
          <Ionicons name="refresh-outline" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Stat Grid */}
      <View className="flex-row flex-wrap gap-4 mb-8">
        {/* Total Collection */}
        <Card style={styles.statCard} padding={0}>
          <View className="p-4">
            <Ionicons name="cash-outline" size={24} color={COLORS.success.DEFAULT} />
            <Text className="text-neutral-400 text-xs font-semibold mt-2">Total Collection</Text>
            <Text className="text-white text-lg font-bold mt-1">
              {formatINR(stats?.totalCollectionPaise || 0)}
            </Text>
          </View>
        </Card>

        {/* Profit Overview */}
        <Card style={styles.statCard} padding={0}>
          <View className="p-4">
            <Ionicons name="pie-chart-outline" size={24} color={COLORS.goldPrimary} />
            <Text className="text-neutral-400 text-xs font-semibold mt-2">Foreman Commission</Text>
            <Text className="text-gold-500 text-lg font-bold mt-1">
              {formatINR(stats?.profitOverviewPaise || 0)}
            </Text>
          </View>
        </Card>

        {/* Pending Payments */}
        <Card style={styles.statCard} padding={0}>
          <View className="p-4">
            <Ionicons name="time-outline" size={24} color={COLORS.danger.DEFAULT} />
            <Text className="text-neutral-400 text-xs font-semibold mt-2">Pending Payments</Text>
            <Text className="text-white text-lg font-bold mt-1">
              {formatINR(stats?.pendingPaymentsPaise || 0)}
            </Text>
          </View>
        </Card>

        {/* Active Committees */}
        <Card style={styles.statCard} padding={0}>
          <View className="p-4">
            <Ionicons name="people-outline" size={24} color={COLORS.brandPrimary} />
            <Text className="text-neutral-400 text-xs font-semibold mt-2">Active Committees</Text>
            <Text className="text-white text-lg font-bold mt-1">
              {stats?.activeCommitteesCount || 0} Chits
            </Text>
          </View>
        </Card>
      </View>

      {/* Monthly Analytics */}
      <Text className="text-white text-base font-bold mb-4">Monthly Analytics</Text>
      <Card style={{ marginBottom: 32 }} padding={0}>
        <View className="p-5">
          <View className="flex-row border-b border-brand-primary/10 pb-2 mb-3">
            <Text className="flex-1 text-neutral-400 font-bold text-xs">Month</Text>
            <Text className="w-32 text-right text-neutral-400 font-bold text-xs">Collection</Text>
            <Text className="w-24 text-right text-neutral-400 font-bold text-xs">Profit</Text>
          </View>
          
          {(stats?.monthlyAnalytics || []).map((item, idx) => (
            <View key={idx} className="flex-row py-2.5 border-b border-brand-primary/5 items-center">
              <Text className="flex-1 text-white font-semibold text-sm">{item.month}</Text>
              <Text className="w-32 text-right text-white font-bold text-sm">
                {formatINR(item.collectionPaise)}
              </Text>
              <Text className="w-24 text-right text-gold-500 font-bold text-sm">
                {formatINR(item.profitPaise)}
              </Text>
            </View>
          ))}

          {(!stats?.monthlyAnalytics || stats.monthlyAnalytics.length === 0) && (
            <Text className="text-center text-neutral-500 py-4 text-xs">No analytics data available</Text>
          )}
        </View>
      </Card>

      {/* Role-Based Access Control / User List */}
      <View className="flex-row items-center justify-between mb-4">
        <Text className="text-white text-base font-bold">User Access & Roles</Text>
        <Badge label={`${users.length} Users`} variant="info" />
      </View>

      <View className="flex-row bg-surface-card border border-brand-primary/10 rounded-xl px-4 items-center mb-4 h-11">
        <Ionicons name="search-outline" size={18} color="#a3a3a3" />
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search by name, phone or email..."
          placeholderTextColor="#a3a3a3"
          className="flex-1 text-white text-sm ml-2.5"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery("")}>
            <Ionicons name="close-circle" size={16} color="#a3a3a3" />
          </TouchableOpacity>
        )}
      </View>

      {filteredUsers.map((userItem) => (
        <Card key={userItem.id} style={{ marginBottom: 12 }}>
          <View className="p-4 flex-row items-center justify-between">
            <View className="flex-1 pr-4">
              <Text className="text-white font-bold text-sm">{userItem.name}</Text>
              <Text className="text-neutral-400 text-xs mt-0.5">{userItem.phone}</Text>
              {userItem.email ? (
                <Text className="text-neutral-500 text-[10px] mt-0.5">{userItem.email}</Text>
              ) : null}
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
                className="bg-brand-500/10 border border-brand-500/30 px-3 py-1.5 rounded-lg"
              >
                <Text className="text-brand-500 text-xs font-bold">Assign Role</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Card>
      ))}

      {filteredUsers.length === 0 && (
        <View className="items-center py-8 bg-surface-card/20 border border-dashed border-neutral-800 rounded-xl">
          <Text className="text-neutral-500 text-xs">No users found matching query</Text>
        </View>
      )}

      {/* Role Selection Modal */}
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
                <Text className="text-white font-bold text-lg">Change User Role</Text>
                <TouchableOpacity onPress={() => setRoleModalVisible(false)}>
                  <Ionicons name="close" size={24} color="#fff" />
                </TouchableOpacity>
              </View>

              <Text className="text-neutral-400 text-xs font-semibold mb-1">USER</Text>
              <Text className="text-white font-bold text-sm mb-4">{selectedUser?.name}</Text>

              <Text className="text-neutral-400 text-xs font-semibold mb-3">SELECT ROLE</Text>

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
                        style={{ color: selectedUser?.role === role ? getRoleColor(role) : "#fff" }}
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
    </ScrollView>
  );
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
    borderColor: "rgba(111,94,255,0.15)",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "rgba(26,22,64,0.40)",
  },
});
