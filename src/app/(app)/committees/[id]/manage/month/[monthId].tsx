// src/app/(app)/committees/[id]/manage/month/[monthId].tsx
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { committeesApi } from "../../../../../../services/committees.api";
import { useAuthStore } from "../../../../../../stores/auth.store";
import { canAccessAdminPanel } from "../../../../../../utils/rbac";
import { formatINR } from "../../../../../../utils/currency";
import { COLORS } from "../../../../../../constants/theme";
import Card from "../../../../../../components/ui/Card";
import Badge from "../../../../../../components/ui/Badge";
import Button from "../../../../../../components/ui/Button";

export default function OrganiserMonthDetail() {
  // useLocalSearchParams picks up all parent + current dynamic segments
  const params = useLocalSearchParams<{ id: string; monthId: string }>();
  const rawId = params.id;
  const rawMonthId = params.monthId;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const monthId = Array.isArray(rawMonthId) ? rawMonthId[0] : rawMonthId;

  const isValid =
    !!id && id !== "undefined" && id !== "null" &&
    !!monthId && monthId !== "undefined" && monthId !== "null";

  const router = useRouter();
  const currentUser = useAuthStore((s) => s.user);

  const [month, setMonth] = useState<any | null>(null);
  const [committee, setCommittee] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isResolving, setIsResolving] = useState(false);

  const loadData = async () => {
    if (!isValid) return;
    try {
      const [comRes, monthRes] = await Promise.all([
        committeesApi.getById(id),
        committeesApi.getMonth(id, monthId),
      ]);
      setCommittee(comRes.data.data);
      setMonth(monthRes.data.data);
    } catch (err) {
      console.error("[OrganiserMonthDetail] Failed to load:", err);
      Alert.alert("Error", "Failed to load month details");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (isValid) {
      loadData();
    } else {
      setLoading(false);
      Alert.alert("Error", "Invalid committee or month ID");
      router.back();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, monthId]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleResolveMonth = () => {
    Alert.alert(
      "Resolve Month",
      "Are you sure you want to close bidding and resolve this month? The lowest bid will win, or if there are no bids, a random lottery will be drawn. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm & Resolve",
          style: "destructive",
          onPress: async () => {
            try {
              setIsResolving(true);
              await committeesApi.resolveMonth(id, monthId);
              Alert.alert("Success", "Month resolved successfully!");
              loadData(); // Reload to show the resolved summary
            } catch (err: any) {
              const msg = err.response?.data?.message || err.message || "Failed to resolve month";
              Alert.alert("Error", msg);
            } finally {
              setIsResolving(false);
            }
          },
        },
      ]
    );
  };

  // Guard: invalid URL params
  if (!isValid) {
    return (
      <View className="flex-1 bg-surface-950 items-center justify-center px-6">
        <Ionicons name="alert-circle-outline" size={48} color="#71717a" />
        <Text className="text-white font-bold text-lg text-center mt-4">Invalid Link</Text>
        <Text className="text-neutral-500 text-sm text-center mt-2">
          This page requires a valid committee and month ID.
        </Text>
        <TouchableOpacity
          onPress={() => router.replace("/committees")}
          className="bg-brand-500 px-6 py-3 rounded-xl mt-6"
        >
          <Text className="text-white font-bold">Back to Committees</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading && !refreshing) {
    return (
      <View className="flex-1 bg-surface-950 items-center justify-center">
        <ActivityIndicator size="large" color={COLORS.brandPrimary} />
      </View>
    );
  }

  if (!month || !committee) {
    return (
      <View className="flex-1 bg-surface-950 items-center justify-center px-6">
        <Ionicons name="document-outline" size={48} color="#71717a" />
        <Text className="text-white font-bold text-lg text-center mt-4">Month Not Found</Text>
        <Text className="text-neutral-500 text-sm text-center mt-2">
          Could not load data for this month. It may not exist yet.
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="bg-surface-card border border-brand-primary/20 px-6 py-3 rounded-xl mt-6"
        >
          <Text className="text-white font-bold">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isOrganizer = committee.organizerId === currentUser?.id;
  const isAdminOrManager = canAccessAdminPanel(currentUser?.role);
  if (!isOrganizer && !isAdminOrManager) {
    return null;
  }

  const isBiddingOpen = month.status === "bidding_open";
  const isCompleted = month.status === "completed";

  // Calculate members who haven't bid yet
  const activeMembers = committee.members.filter((m: any) => m.isActive);
  const bidderIds = new Set((month.bids || []).map((b: any) => b.memberId));
  const nonBidders = activeMembers.filter((m: any) => !bidderIds.has(m.id) && !m.hasReceivedPayout);

  return (
    <ScrollView
      className="flex-1 bg-surface-950 px-4"
      contentContainerStyle={{ paddingTop: 64, paddingBottom: 120 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.brandPrimary} />
      }
    >
      <LinearGradient
        colors={[
          isCompleted ? COLORS.success + "15" : COLORS.brandPrimary + "15",
          "transparent",
        ]}
        className="absolute inset-0 h-80"
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      {/* Header */}
      <View className="flex-row items-center mb-6">
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-10 h-10 bg-surface-card rounded-full items-center justify-center border border-brand-primary/10 mr-4"
        >
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-white text-xl font-bold">Month {month.monthNumber}</Text>
          <Text className="text-neutral-400 text-xs">
            {new Date(month.monthDate).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </Text>
        </View>
        <Badge
          label={isCompleted ? "Completed" : isBiddingOpen ? "Bidding Open" : "Pending"}
          variant={isCompleted ? "success" : isBiddingOpen ? "info" : "neutral"}
        />
      </View>

      {/* Financial Overview (Pending/Bidding) */}
      {!isCompleted && (
        <Card style={{ marginBottom: 20 }} padding={0}>
          <View className="p-5">
            <Text className="text-white font-bold mb-4 border-b border-surface-card/50 pb-2">
              Financial Overview
            </Text>
            <View className="flex-row flex-wrap">
              <View className="w-1/2 mb-4">
                <Text className="text-neutral-500 text-[10px] uppercase font-bold tracking-wider">Total Pool</Text>
                <Text className="text-gold-400 font-bold text-base mt-1">{formatINR(month.totalPool)}</Text>
              </View>
              <View className="w-1/2 mb-4 items-end">
                <Text className="text-neutral-500 text-[10px] uppercase font-bold tracking-wider">Projected Interest</Text>
                <Text className="text-white font-bold text-base mt-1">{formatINR(month.projected.interestAmount)}</Text>
              </View>
              <View className="w-1/2">
                <Text className="text-neutral-500 text-[10px] uppercase font-bold tracking-wider">Max Allowed Bid</Text>
                <Text className="text-brand-400 font-bold text-base mt-1">{formatINR(month.projected.maxBidAllowed)}</Text>
              </View>
              <View className="w-1/2 items-end">
                <Text className="text-neutral-500 text-[10px] uppercase font-bold tracking-wider">Projected Dividend</Text>
                <Text className="text-success-400 font-bold text-base mt-1">+{formatINR(month.projected.perMemberDistribution)}</Text>
              </View>
            </View>
          </View>
        </Card>
      )}

      {/* Completed Summary Overview */}
      {isCompleted && (
        <View className="mb-6">
          <Card style={{ marginBottom: 16 }} padding={0}>
            <View className="p-5">
              <View className="flex-row items-center justify-between border-b border-surface-card/50 pb-4 mb-4">
                <View>
                  <Text className="text-neutral-500 text-[10px] uppercase font-bold tracking-wider mb-1">Resolution</Text>
                  <Badge
                    label={month.resolutionType.replace("_", " ").toUpperCase()}
                    variant={month.resolutionType === "lottery" ? "neutral" : "brand"}
                  />
                </View>
                <View className="items-end">
                  <Text className="text-neutral-500 text-[10px] uppercase font-bold tracking-wider mb-1">Winner</Text>
                  <Text className="text-white font-bold text-base">{month.winnerMember?.user?.name || "Unknown"}</Text>
                </View>
              </View>

              <View className="flex-row flex-wrap mb-4">
                <View className="w-1/2 mb-4">
                  <Text className="text-neutral-500 text-[10px] uppercase font-bold tracking-wider">Winning Bid / Payout</Text>
                  <Text className="text-gold-400 font-bold text-base mt-1">{formatINR(month.winningBidAmount)}</Text>
                </View>
                <View className="w-1/2 mb-4 items-end">
                  <Text className="text-neutral-500 text-[10px] uppercase font-bold tracking-wider">Interest Extracted</Text>
                  <Text className="text-white font-bold text-base mt-1">{formatINR(month.interestAmount)}</Text>
                </View>
                <View className="w-1/2">
                  <Text className="text-neutral-500 text-[10px] uppercase font-bold tracking-wider">Organiser Fee</Text>
                  <Text className="text-danger-400 font-bold text-base mt-1">-{formatINR(month.organiserFee)}</Text>
                </View>
                <View className="w-1/2 items-end">
                  <Text className="text-neutral-500 text-[10px] uppercase font-bold tracking-wider">Remaining Bal.</Text>
                  <Text className="text-white font-bold text-base mt-1">{formatINR(month.remainingBalance)}</Text>
                </View>
              </View>

              <View className="bg-success-500/10 border border-success-500/20 p-3 rounded-xl flex-row justify-between items-center">
                <Text className="text-success-400 font-bold text-xs">Dividend per Member</Text>
                <Text className="text-success-400 font-bold text-lg">+{formatINR(month.perMemberDistribution)}</Text>
              </View>
            </View>
          </Card>
        </View>
      )}

      {/* Bidding Open - Resolution Actions */}
      {isBiddingOpen && (
        <View className="mb-8">
          <Button
            label={isResolving ? "Resolving..." : "Close Bidding & Resolve Month"}
            variant="primary"
            disabled={isResolving}
            onPress={handleResolveMonth}
            icon={!isResolving && <Ionicons name="flash-outline" size={20} color="#fff" />}
          />
        </View>
      )}

      {/* Bids Placed */}
      {!isCompleted && month.bids && (
        <View className="mb-6">
          <Text className="text-white text-base font-bold mb-3">
            Bids Placed ({month.bids.length})
          </Text>
          {month.bids.length === 0 ? (
            <Text className="text-neutral-500 text-sm italic">No bids placed yet.</Text>
          ) : (
            month.bids.map((bid: any, idx: number) => (
              <View key={bid.id} className="bg-surface-card border border-brand-primary/10 rounded-xl p-4 mb-2 flex-row justify-between items-center">
                <View className="flex-row items-center">
                  <View className="w-8 h-8 rounded-full bg-brand-500/10 items-center justify-center mr-3">
                    <Text className="text-brand-500 font-bold text-xs">#{idx + 1}</Text>
                  </View>
                  <View>
                    <Text className="text-white font-bold">{bid.committeeMember?.user?.name || "Unknown"}</Text>
                    <Text className="text-neutral-500 text-[10px] mt-1">
                      {new Date(bid.placedAt).toLocaleString()}
                    </Text>
                  </View>
                </View>
                <Text className="text-gold-400 font-bold text-base">{formatINR(bid.bidAmount)}</Text>
              </View>
            ))
          )}
        </View>
      )}

      {/* Members who haven't bid */}
      {!isCompleted && nonBidders.length > 0 && (
        <View className="mb-6">
          <Text className="text-white text-sm font-bold mb-3">Waiting for Bids ({nonBidders.length})</Text>
          <View className="flex-row flex-wrap gap-2">
            {nonBidders.map((m: any) => (
              <View key={m.id} className="bg-surface-card border border-surface-card/50 px-3 py-1.5 rounded-full">
                <Text className="text-neutral-400 text-xs">{m.user?.name || "Member"}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Distributions Table */}
      {isCompleted && month.memberDistributions && (
        <View className="mb-6">
          <Text className="text-white text-base font-bold mb-3">Member Distributions</Text>
          <Card style={{ marginBottom: 0 }} padding={0}>
            <View className="p-4">
              <View className="flex-row border-b border-brand-primary/10 pb-2 mb-3">
                <Text className="w-8 text-neutral-400 font-bold text-xs">#</Text>
                <Text className="flex-1 text-neutral-400 font-bold text-xs">Member</Text>
                <Text className="w-24 text-right text-neutral-400 font-bold text-xs">Dividend</Text>
              </View>
              {month.memberDistributions.map((dist: any, idx: number) => (
                <View key={dist.id} className="flex-row py-2 border-b border-brand-primary/5 items-center">
                  <Text className="w-8 text-neutral-500 font-bold text-xs">{idx + 1}</Text>
                  <Text className="flex-1 text-white font-semibold text-sm">
                    {dist.committeeMember?.user?.name || "Unknown"}
                  </Text>
                  <Text className="w-24 text-right text-success-400 font-bold text-sm">
                    +{formatINR(dist.distributionAmount)}
                  </Text>
                </View>
              ))}
            </View>
          </Card>
        </View>
      )}

    </ScrollView>
  );
}
