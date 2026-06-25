// src/app/(app)/members/index.tsx
// Kometi Member Directory with Search, Filter, and KYC Status verification.

import React, { useState, useEffect } from "react";
import { View, Text, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemberStore } from "../../../stores/member.store";
import { useAuthStore } from "../../../stores/auth.store";
import { useCommitteeStore } from "../../../stores/committee.store";
import { membersApi } from "../../../services/members.api";
import { COLORS } from "../../../constants/theme";
import Input from "../../../components/ui/Input";
import Avatar from "../../../components/ui/Avatar";
import Badge, { kycVariant } from "../../../components/ui/Badge";
import EmptyState from "../../../components/ui/EmptyState";
import ScreenHeader from "../../../components/shared/ScreenHeader";
import { canVerifyKYC, canViewMembers, canCreateCommittee } from "../../../utils/rbac";
import { useAlertModal } from "../../../components/ui/AlertModal";

export default function Members() {
  const router = useRouter();
  const { members, isLoading, searchQuery, setSearchQuery, fetchMembers } = useMemberStore();
  const currentUser = useAuthStore((s) => s.user);
  const committees = useCommitteeStore((s) => s.committees);
  const hasCommittee = committees.length > 0;
  const [refreshing, setRefreshing] = useState(false);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const { alert, confirm, AlertComponent } = useAlertModal();

  useEffect(() => {
    if (!canViewMembers(currentUser?.role, hasCommittee)) {
      router.replace("/dashboard");
    }
  }, [currentUser?.role, hasCommittee, router]);

  const loadData = async () => {
    setRefreshing(true);
    await fetchMembers();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchMembers();
  }, [searchQuery]);

  const handleVerifyKYC = async (memberId: string, memberName: string) => {
    const ok = await confirm(
      "Verify KYC",
      `Are you sure you want to verify the KYC documents for ${memberName}?`,
      { confirmLabel: "Verify" }
    );
    if (ok) {
      try {
        setIsProcessing(memberId);
        await membersApi.updateKYCStatus(memberId, "VERIFIED");
        await alert("Verified", "KYC status updated to VERIFIED.");
        fetchMembers();
      } catch (err) {
        await alert("Error", err instanceof Error ? err.message : "Failed to verify KYC");
      } finally {
        setIsProcessing(null);
      }
      return;
    }

    const reject = await confirm(
      "Reject KYC",
      `Do you want to REJECT the KYC documents for ${memberName}?`,
      { confirmLabel: "Reject", type: "warning" }
    );
    if (reject) {
      try {
        setIsProcessing(memberId);
        await membersApi.updateKYCStatus(memberId, "REJECTED", "Documents incomplete or invalid");
        await alert("Rejected", "KYC status updated to REJECTED.");
        fetchMembers();
      } catch (err) {
        await alert("Error", err instanceof Error ? err.message : "Failed to reject KYC");
      } finally {
        setIsProcessing(null);
      }
    }
  };

  const filteredMembers = members.filter(
    (m) =>
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.phone.includes(searchQuery)
  );

  if (!canViewMembers(currentUser?.role, hasCommittee)) {
    return null;
  }

  return (
    <View className="flex-1 bg-surface-bg px-4">
      <ScreenHeader
        title="Members"
        subtitle={currentUser?.role === "ADMIN" ? "Manage all chit participants" : "View members of your chits"}
        transparent
      />

      <View className="mb-4">
        <Input
          placeholder="Search by name or phone..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          leftIcon={<Ionicons name="search" size={18} color="#64748b" />}
          rightElement={
            searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <Ionicons name="close-circle" size={18} color="#64748b" />
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
              description={canCreateCommittee(currentUser?.role) ? "Invite your first member to join your committees." : "No members found in the system."}
              actionLabel={canCreateCommittee(currentUser?.role) ? "Add Member" : undefined}
              onAction={canCreateCommittee(currentUser?.role) ? () => console.log("Add Member") : undefined}
            />
          ) : null
        }
        renderItem={({ item }) => (
          <View className="flex-row items-center justify-between bg-surface-card border border-slate-100 rounded-xl p-4 mb-3">
            <View className="flex-row items-center flex-1">
              <Avatar name={item.name} size={44} />
              <View className="ml-3 flex-1">
                <Text className="text-slate-900 font-bold text-sm">{item.name}</Text>
                <Text className="text-slate-500 text-xs mt-0.5">{item.phone}</Text>
              </View>
            </View>

            <View className="items-end">
              <Badge label={item.kycStatus} variant={kycVariant(item.kycStatus)} />
              {canVerifyKYC(currentUser?.role) && item.kycStatus === "PENDING" && (
                <TouchableOpacity
                  onPress={() => handleVerifyKYC(item.id, item.name)}
                  disabled={isProcessing === item.id}
                  className="mt-2 py-1 px-2.5 bg-brand-50 border border-brand-200 rounded min-w-[80px] items-center"
                >
                  {isProcessing === item.id ? (
                    <ActivityIndicator size="small" color={COLORS.brandPrimary} />
                  ) : (
                    <Text className="text-brand-600 text-[10px] font-bold uppercase">
                      Verify KYC
                    </Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      />

      <AlertComponent />
    </View>
  );
}
