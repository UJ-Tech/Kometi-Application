// src/app/(app)/members/index.tsx
// Kometi Member Directory with Search, Filter, and KYC Status verification.

import React, { useState, useEffect } from "react";
import { View, Text, FlatList, TouchableOpacity, RefreshControl, Alert, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemberStore } from "../../../stores/member.store";
import { useAuthStore } from "../../../stores/auth.store";
import { membersApi } from "../../../services/members.api";
import { COLORS } from "../../../constants/theme";
import Input from "../../../components/ui/Input";
import Avatar from "../../../components/ui/Avatar";
import Badge, { kycVariant } from "../../../components/ui/Badge";
import EmptyState from "../../../components/ui/EmptyState";
import ScreenHeader from "../../../components/shared/ScreenHeader";
import { canVerifyKYC, canViewMembers } from "../../../utils/rbac";

export default function Members() {
  const router = useRouter();
  const { members, isLoading, searchQuery, setSearchQuery, fetchMembers } = useMemberStore();
  const currentUser = useAuthStore((s) => s.user);
  const [refreshing, setRefreshing] = useState(false);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  useEffect(() => {
    if (!canViewMembers(currentUser?.role)) {
      router.replace("/dashboard");
    }
  }, [currentUser?.role, router]);

  const loadData = async () => {
    setRefreshing(true);
    await fetchMembers();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchMembers();
  }, [searchQuery]);

  const handleVerifyKYC = async (memberId: string, memberName: string) => {
    Alert.alert(
      "Verify KYC",
      `Are you sure you want to verify the KYC documents for ${memberName}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reject",
          style: "destructive",
          onPress: async () => {
            try {
              setIsProcessing(memberId);
              await membersApi.updateKYCStatus(memberId, "REJECTED", "Documents incomplete or invalid");
              Alert.alert("Rejected", "KYC status updated to REJECTED.");
              fetchMembers();
            } catch (err) {
              Alert.alert("Error", err instanceof Error ? err.message : "Failed to reject KYC");
            } finally {
              setIsProcessing(null);
            }
          },
        },
        {
          text: "Verify",
          style: "default",
          onPress: async () => {
            try {
              setIsProcessing(memberId);
              await membersApi.updateKYCStatus(memberId, "VERIFIED");
              Alert.alert("Verified", "KYC status updated to VERIFIED.");
              fetchMembers();
            } catch (err) {
              Alert.alert("Error", err instanceof Error ? err.message : "Failed to verify KYC");
            } finally {
              setIsProcessing(null);
            }
          },
        },
      ]
    );
  };

  const filteredMembers = members.filter(
    (m) =>
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.phone.includes(searchQuery)
  );

  if (!canViewMembers(currentUser?.role)) {
    return null;
  }

  return (
    <View className="flex-1 bg-surface-950 px-4">
      <ScreenHeader
        title="Members"
        subtitle="Manage and view all chit participants"
        transparent
      />

      <View className="mb-4">
        <Input
          placeholder="Search by name or phone..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          leftIcon={<Ionicons name="search" size={18} color="#a3a3a3" />}
          rightElement={
            searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <Ionicons name="close-circle" size={18} color="#a3a3a3" />
              </TouchableOpacity>
            ) : undefined
          }
        />
      </View>

      <FlatList
        data={filteredMembers}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={loadData}
            tintColor={COLORS.brandPrimary}
          />
        }
        contentContainerStyle={{ paddingBottom: 100 }}
        ListEmptyComponent={
          !isLoading ? (
            <EmptyState
              icon="people-outline"
              title="No members found"
              description="Invite your first member to join your committees."
              actionLabel="Add Member"
              onAction={() => console.log("Add Member")}
            />
          ) : null
        }
        renderItem={({ item }) => (
          <View className="flex-row items-center justify-between bg-surface-card border border-brand-primary/5 rounded-xl p-4 mb-3">
            <View className="flex-row items-center flex-1">
              <Avatar name={item.name} size={44} />
              <View className="ml-3 flex-1">
                <Text className="text-white font-bold text-sm">{item.name}</Text>
                <Text className="text-neutral-500 text-xs mt-0.5">{item.phone}</Text>
              </View>
            </View>

            <View className="items-end">
              <Badge label={item.kycStatus} variant={kycVariant(item.kycStatus)} />
              {canVerifyKYC(currentUser?.role) && item.kycStatus === "PENDING" && (
                <TouchableOpacity
                  onPress={() => handleVerifyKYC(item.id, item.name)}
                  disabled={isProcessing === item.id}
                  className="mt-2 py-1 px-2.5 bg-brand-500/10 border border-brand-500/20 rounded min-w-[80px] items-center"
                >
                  {isProcessing === item.id ? (
                    <ActivityIndicator size="small" color={COLORS.brandPrimary} />
                  ) : (
                    <Text className="text-brand-500 text-[10px] font-bold uppercase">
                      Verify KYC
                    </Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      />
    </View>
  );
}
