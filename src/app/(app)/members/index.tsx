import React, { useState, useEffect } from "react";
import { View, Text, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemberStore } from "../../../stores/member.store";
import { useCommitteeStore } from "../../../stores/committee.store";
import { membersApi } from "../../../services/members.api";
import { COLORS, BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from "../../../constants/theme";
import Input from "../../../components/ui/Input";
import Avatar from "../../../components/ui/Avatar";
import Badge, { kycVariant } from "../../../components/ui/Badge";
import EmptyState from "../../../components/ui/EmptyState";
import ScreenHeader from "../../../components/shared/ScreenHeader";
import { canViewMembers } from "../../../utils/rbac";
import { useAlertModal } from "../../../components/ui/AlertModal";

export default function Members() {
  const router = useRouter();
  const { members, isLoading, searchQuery, setSearchQuery, fetchMembers } = useMemberStore();
  const committees = useCommitteeStore((s) => s.committees);
  const hasCommittee = committees.length > 0;
  const [refreshing, setRefreshing] = useState(false);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const { alert, confirm, AlertComponent } = useAlertModal();

  useEffect(() => {
    if (!canViewMembers(hasCommittee)) {
      router.replace("/dashboard");
    }
  }, [hasCommittee, router]);

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

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.surface.bg, paddingHorizontal: SPACING[5] }}>
      <ScreenHeader title="Members" subtitle="Manage committee members and KYC" transparent />

      <View style={{ marginBottom: 16 }}>
        <Input
          placeholder="Search members..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          leftIcon={<Ionicons name="search-outline" size={18} color={COLORS.text.muted} />}
        />
      </View>

      <FlatList
        data={members}
        keyExtractor={(item: any) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={loadData}
            tintColor={COLORS.brandPrimary}
          />
        }
        contentContainerStyle={{ paddingBottom: 100, flexGrow: 1 }}
        ListEmptyComponent={
          !isLoading ? (
            <EmptyState
              icon="people-outline"
              title="No members found"
              description={searchQuery ? "Try a different search term." : "Members will appear here once they join your committee."}
            />
          ) : null
        }
        renderItem={({ item }: { item: any }) => (
          <TouchableOpacity
            activeOpacity={0.7}
            className="flex-row items-center bg-white rounded-2xl p-4 mb-3"
            style={{
              borderWidth: 1,
              borderColor: COLORS.surface.border,
              ...SHADOWS.cardSm,
            }}
          >
            <Avatar
              name={item.user?.name || item.name || "Member"}
              imageUrl={item.user?.profileImageUrl}
              size={48}
            />
            <View className="ml-3 flex-1">
              <Text className="text-slate-800 font-bold text-sm">
                {item.user?.name || item.name || "Unknown Member"}
              </Text>
              <View className="flex-row items-center gap-2 mt-0.5">
                <Text className="text-slate-400 text-xs">
                  {item.user?.phone || ""}
                </Text>
                {item.slotNumber && (
                  <>
                    <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: COLORS.text.muted }} />
                    <Text className="text-slate-400 text-xs">Slot #{item.slotNumber}</Text>
                  </>
                )}
              </View>
            </View>
            <TouchableOpacity
              onPress={() => handleVerifyKYC(item.id, item.user?.name || item.name || "Member")}
              disabled={isProcessing === item.id}
              className="rounded-full px-3 py-1"
              style={{
                backgroundColor: item.user?.kycStatus === "VERIFIED" ? "rgba(34,197,94,0.1)" :
                  item.user?.kycStatus === "REJECTED" ? "rgba(239,68,68,0.1)" :
                  item.user?.kycStatus === "SUBMITTED" ? "rgba(59,130,246,0.1)" :
                  "rgba(245,158,11,0.1)",
              }}
            >
              {isProcessing === item.id ? (
                <ActivityIndicator size="small" color={COLORS.brand[500]} />
              ) : (
                <View className="flex-row items-center gap-1">
                  <Badge
                    label={item.user?.kycStatus || "PENDING"}
                    variant={kycVariant(item.user?.kycStatus || "PENDING")}
                    size="sm"
                    dot
                  />
                </View>
              )}
            </TouchableOpacity>
          </TouchableOpacity>
        )}
      />
      <AlertComponent />
    </View>
  );
}
