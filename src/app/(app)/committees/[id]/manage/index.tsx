// src/app/(app)/committees/[id]/manage/index.tsx
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  TextInput,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { committeesApi } from "../../../../../services/committees.api";
import { useAuthStore } from "../../../../../stores/auth.store";
import { canAccessAdminPanel } from "../../../../../utils/rbac";
import { formatINR } from "../../../../../utils/currency";
import { COLORS } from "../../../../../constants/theme";
import Card from "../../../../../components/ui/Card";
import Badge from "../../../../../components/ui/Badge";
import Button from "../../../../../components/ui/Button";

export default function OrganiserManageTimeline() {
  const params = useLocalSearchParams<{ id: string }>();
  const rawId = params.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const isValidId = !!id && id !== "undefined" && id !== "null";
  const router = useRouter();
  const currentUser = useAuthStore((s) => s.user);

  const [committee, setCommittee] = useState<any | null>(null);
  const [monthsData, setMonthsData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingOpen, setProcessingOpen] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCreateMonth, setShowCreateMonth] = useState(false);
  const [newMonthNumber, setNewMonthNumber] = useState("");
  const [newMonthDate, setNewMonthDate] = useState("");
  const [newMonthResolution, setNewMonthResolution] = useState<"bid_single" | "bid_auction" | "lottery">("bid_auction");
  const [isCreating, setIsCreating] = useState(false);

  const loadData = useCallback(async () => {
    if (!isValidId) return;
    setError(null);
    try {
      const committeeRes = await committeesApi.getById(id);
      setCommittee(committeeRes.data.data);
    } catch (err: any) {
      console.error("[OrganiserManageTimeline] Committee load failed:", err);
      setError("Failed to load committee details. Pull down to retry.");
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const monthsRes = await committeesApi.getMonths(id);
      setMonthsData(monthsRes.data.data);
    } catch (err: any) {
      console.error("[OrganiserManageTimeline] Months load failed:", err);
      setError("Failed to load months data. Pull down to retry.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id, isValidId]);

  useEffect(() => {
    if (isValidId) {
      loadData();
    } else {
      setLoading(false);
      setError("Invalid committee ID");
    }
  }, [isValidId, loadData]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const handleOpenBidding = async (monthNumber: number) => {
    try {
      setProcessingOpen(monthNumber);
      await committeesApi.openBidding(id, monthNumber);
      Alert.alert("Success", `Bidding opened for Month ${monthNumber}`);
      loadData();
    } catch (err: any) {
      const msg = err?.message || "Failed to open bidding";
      Alert.alert("Error", msg);
    } finally {
      setProcessingOpen(null);
    }
  };

  const handleCreateMonth = async () => {
    const monthNum = Number(newMonthNumber);
    if (!monthNum || monthNum < 1) {
      Alert.alert("Invalid Input", "Month number must be at least 1.");
      return;
    }
    if (!newMonthDate.trim()) {
      Alert.alert("Invalid Input", "Please enter a month date (YYYY-MM-DD).");
      return;
    }

    try {
      setIsCreating(true);
      await committeesApi.createMonth(id, {
        monthNumber: monthNum,
        monthDate: newMonthDate.trim(),
        resolutionType: newMonthResolution,
      });
      Alert.alert("Success", `Month ${monthNum} created successfully!`);
      setNewMonthNumber("");
      setNewMonthDate("");
      setShowCreateMonth(false);
      loadData();
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to create month");
    } finally {
      setIsCreating(false);
    }
  };

  // ─── Invalid ID ─────────────────────────────────────────────────────────
  if (!isValidId) {
    return (
      <View className="flex-1 bg-surface-950 items-center justify-center px-6">
        <View className="w-16 h-16 rounded-full bg-danger-500/10 items-center justify-center mb-4">
          <Ionicons name="alert-circle-outline" size={32} color={COLORS.danger.light} />
        </View>
        <Text className="text-white font-bold text-lg text-center">Invalid Committee</Text>
        <Text className="text-neutral-500 text-sm text-center mt-2">
          This committee could not be found. Please go back and try again.
        </Text>
        <Button
          label="Back to Chits"
          variant="secondary"
          size="sm"
          onPress={() => router.replace("/committees")}
          icon={<Ionicons name="arrow-back" size={16} color={COLORS.brandPrimary} />}
        />
      </View>
    );
  }

  // ─── Loading ────────────────────────────────────────────────────────────
  if (loading && !refreshing) {
    return (
      <View className="flex-1 bg-surface-950 items-center justify-center">
        <ActivityIndicator size="large" color={COLORS.brandPrimary} />
        <Text className="text-neutral-500 text-sm mt-4">Loading dashboard...</Text>
      </View>
    );
  }

  // ─── Error State ────────────────────────────────────────────────────────
  if (error && !committee) {
    return (
      <View className="flex-1 bg-surface-950 items-center justify-center px-6">
        <View className="w-16 h-16 rounded-full bg-warning-500/10 items-center justify-center mb-4">
          <Ionicons name="cloud-offline-outline" size={32} color={COLORS.warning.light} />
        </View>
        <Text className="text-white font-bold text-lg text-center">Something went wrong</Text>
        <Text className="text-neutral-500 text-sm text-center mt-2 mb-6">{error}</Text>
        <Button
          label="Try Again"
          variant="primary"
          size="sm"
          onPress={loadData}
          icon={<Ionicons name="refresh" size={16} color={COLORS.white} />}
        />
        <TouchableOpacity
          onPress={() => router.back()}
          className="mt-3"
        >
          <Text className="text-brand-400 text-sm font-medium">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ─── Role Guard ─────────────────────────────────────────────────────────
  if (committee) {
    const isOrganizer = committee.organizerId === currentUser?.id;
    const isAdminOrManager = canAccessAdminPanel(currentUser?.role);
    if (!isOrganizer && !isAdminOrManager) {
      return (
        <View className="flex-1 bg-surface-950 items-center justify-center px-6">
          <View className="w-16 h-16 rounded-full bg-danger-500/10 items-center justify-center mb-4">
            <Ionicons name="lock-closed-outline" size={32} color={COLORS.danger.light} />
          </View>
          <Text className="text-white font-bold text-lg text-center">Access Denied</Text>
          <Text className="text-neutral-500 text-sm text-center mt-2 mb-6">
            Only the committee organiser can access this dashboard.
          </Text>
          <Button
            label="Go Back"
            variant="secondary"
            size="sm"
            onPress={() => router.replace(`/committees/${id}`)}
            icon={<Ionicons name="arrow-back" size={16} color={COLORS.brandPrimary} />}
          />
        </View>
      );
    }
  }

  if (!committee || !monthsData) return null;

  const months = Array.isArray(monthsData.months) ? monthsData.months : [];
  const totalMembers = monthsData.totalMembers || 0;
  const totalPool = monthsData.totalPool || 0;
  const feePercent = monthsData.feePercent || 0;
  const completedMonths = monthsData.completedMonths || 0;

  const currentMonthIndex = months.findIndex((m: any) => m.status !== "completed");
  const currentMonth = currentMonthIndex !== -1 ? months[currentMonthIndex] : null;

  // ─── Render ─────────────────────────────────────────────────────────────
  return (
    <ScrollView
      className="flex-1 bg-surface-950"
      contentContainerStyle={{ paddingTop: 64, paddingBottom: 120 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.brandPrimary} />
      }
    >
      <LinearGradient
        colors={[COLORS.brandPrimary + "15", "transparent"]}
        className="absolute inset-0 h-80"
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      {/* Header */}
      <View className="px-4 flex-row items-center mb-6">
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-10 h-10 bg-surface-card rounded-full items-center justify-center border border-brand-primary/10 mr-4"
        >
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-white text-xl font-bold">Fund Management</Text>
          <Text className="text-neutral-400 text-xs">{committee.name}</Text>
        </View>
        <View className="w-10 h-10 bg-brand-500/10 rounded-full items-center justify-center">
          <Ionicons name="wallet-outline" size={18} color={COLORS.brandPrimary} />
        </View>
      </View>

      {/* Error Banner (partial — committee loaded but months failed) */}
      {error && (
        <View className="mx-4 mb-4 bg-warning-500/10 border border-warning-500/20 rounded-xl p-4 flex-row items-center">
          <Ionicons name="warning-outline" size={18} color={COLORS.warning.light} />
          <Text className="text-warning-light text-xs ml-2 flex-1">{error}</Text>
          <TouchableOpacity onPress={loadData}>
            <Ionicons name="refresh" size={16} color={COLORS.warning.light} />
          </TouchableOpacity>
        </View>
      )}

      {/* Summary Stats */}
      <View className="px-4 mb-5">
        <Card padding={0}>
          <View className="p-5">
            <View className="flex-row items-center mb-4">
              <View className="w-8 h-8 rounded-lg bg-gold-500/15 items-center justify-center mr-3">
                <Ionicons name="stats-chart-outline" size={16} color={COLORS.goldPrimary} />
              </View>
              <Text className="text-white font-bold text-sm">Committee Overview</Text>
            </View>
            <View className="flex-row flex-wrap">
              <View className="w-1/2 mb-4">
                <Text className="text-neutral-500 text-[10px] uppercase font-bold tracking-wider">Total Pool</Text>
                <Text className="text-gold-400 font-bold text-base mt-1">{formatINR(totalPool)}</Text>
              </View>
              <View className="w-1/2 mb-4 items-end">
                <Text className="text-neutral-500 text-[10px] uppercase font-bold tracking-wider">Organiser Fee</Text>
                <Text className="text-white font-bold text-base mt-1">{feePercent}%</Text>
              </View>
              <View className="w-1/2">
                <Text className="text-neutral-500 text-[10px] uppercase font-bold tracking-wider">Members</Text>
                <Text className="text-white font-bold text-base mt-1">{totalMembers}</Text>
              </View>
              <View className="w-1/2 items-end">
                <Text className="text-neutral-500 text-[10px] uppercase font-bold tracking-wider">Progress</Text>
                <Text className="text-brand-400 font-bold text-base mt-1">
                  {completedMonths} / {totalMembers} Months
                </Text>
              </View>
            </View>
          </View>
        </Card>
      </View>

      <View className="px-4 mb-3 flex-row items-center justify-between">
        <Text className="text-white text-base font-bold">Monthly Timeline</Text>
        {months.length > 0 && (
          <Text className="text-neutral-500 text-xs">{months.length} months</Text>
        )}
      </View>

      {/* Create Month Button */}
      <View className="px-4 mb-4">
        {!showCreateMonth ? (
          <TouchableOpacity
            onPress={() => {
              const nextNum = (months.length || 0) + 1;
              setNewMonthNumber(String(nextNum));
              setNewMonthDate(new Date().toISOString().split("T")[0]);
              setShowCreateMonth(true);
            }}
            className="bg-brand-500/15 border border-brand-500/20 px-4 py-3 rounded-xl flex-row items-center justify-center"
          >
            <Ionicons name="add-circle-outline" size={18} color={COLORS.brandPrimary} />
            <Text className="text-brand-400 font-bold text-sm ml-2">Create New Month</Text>
          </TouchableOpacity>
          ) : (
            <Card padding={0}>
              <View className="p-4">
                <View className="flex-row items-center justify-between mb-3">
                  <Text className="text-neutral-400 text-xs font-semibold uppercase tracking-wider">New Month Details</Text>
                  <TouchableOpacity onPress={() => setShowCreateMonth(false)}>
                    <Ionicons name="close" size={18} color={COLORS.text.muted} />
                  </TouchableOpacity>
                </View>

                <Text className="text-neutral-400 text-xs font-semibold mb-1.5">Month Number</Text>
                <View className="bg-surface-950 border border-brand-primary/10 rounded-xl px-4 h-11 justify-center mb-3">
                  <TextInput
                    value={newMonthNumber}
                    onChangeText={setNewMonthNumber}
                    keyboardType="numeric"
                    placeholder="1"
                    placeholderTextColor="#525252"
                    className="text-white font-semibold text-sm"
                  />
                </View>

                <Text className="text-neutral-400 text-xs font-semibold mb-1.5">Month Date</Text>
                <View className="bg-surface-950 border border-brand-primary/10 rounded-xl px-4 h-11 justify-center mb-3">
                  <TextInput
                    value={newMonthDate}
                    onChangeText={setNewMonthDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#525252"
                    className="text-white font-semibold text-sm"
                  />
                </View>

                <Text className="text-neutral-400 text-xs font-semibold mb-2">Resolution Type</Text>
                <View className="flex-row gap-2 mb-4">
                  {(["bid_auction", "bid_single", "lottery"] as const).map((type) => (
                    <TouchableOpacity
                      key={type}
                      onPress={() => setNewMonthResolution(type)}
                      className={`flex-1 h-10 rounded-xl items-center justify-center border ${
                        newMonthResolution === type
                          ? "bg-brand-500 border-brand-500"
                          : "bg-surface-950 border-brand-primary/10"
                      }`}
                    >
                      <Text
                        className={`font-bold text-xs ${
                          newMonthResolution === type ? "text-white" : "text-neutral-400"
                        }`}
                      >
                        {type === "bid_auction" ? "Auction" : type === "bid_single" ? "Single Bid" : "Lottery"}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View className="flex-row gap-3">
                  <TouchableOpacity
                    onPress={() => setShowCreateMonth(false)}
                    className="flex-1 h-11 rounded-xl items-center justify-center border border-brand-primary/10"
                  >
                    <Text className="text-neutral-400 font-bold text-sm">Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleCreateMonth}
                    disabled={isCreating}
                    className="flex-1 bg-brand-500 h-11 rounded-xl items-center justify-center"
                    style={{ opacity: isCreating ? 0.6 : 1 }}
                  >
                    {isCreating ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text className="text-white font-bold text-sm">Create Month</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </Card>
          )}
        </View>

      {/* Empty State */}
      {months.length === 0 && !showCreateMonth && (
        <View className="px-4">
          <Card>
            <View className="items-center py-8">
              <View className="w-14 h-14 rounded-full bg-brand-500/10 items-center justify-center mb-4">
                <Ionicons name="calendar-outline" size={28} color={COLORS.brandPrimary} />
              </View>
              <Text className="text-white font-bold text-sm mb-1">No Months Created</Text>
              <Text className="text-neutral-500 text-xs text-center px-4 mb-4">
                Create your first month to start managing fund disbursements.
              </Text>
              <Button
                label="Create First Month"
                variant="primary"
                size="sm"
                onPress={() => {
                  const nextNum = (months.length || 0) + 1;
                  setNewMonthNumber(String(nextNum));
                  setNewMonthDate(new Date().toISOString().split("T")[0]);
                  setShowCreateMonth(true);
                }}
                icon={<Ionicons name="add" size={14} color={COLORS.white} />}
              />
            </View>
          </Card>
        </View>
      )}

      {/* Timeline List */}
      {months.length > 0 && (
        <View className="ml-6 mr-4 border-l-2 border-surface-card/50 pl-6 mb-10">
          {months.map((month: any, idx: number) => {
            const isCurrent = month.id === currentMonth?.id;
            const isCompleted = month.status === "completed";
            const isBiddingOpen = month.status === "bidding_open";
            const isPending = month.status === "pending";

            return (
              <View key={month.id} className="mb-6 relative">
                {/* Timeline dot */}
                <View
                  className={`absolute -left-[31px] top-4 w-4 h-4 rounded-full border-4 border-surface-950 ${
                    isCompleted ? "bg-success-500" : isCurrent ? "bg-brand-500" : "bg-surface-card"
                  }`}
                />

                <TouchableOpacity
                  activeOpacity={isCompleted || isBiddingOpen ? 0.7 : 1}
                  onPress={() => {
                    if (isCompleted || isBiddingOpen) {
                      router.push(`/committees/${id}/manage/month/${month.id}`);
                    }
                  }}
                  disabled={!isCompleted && !isBiddingOpen}
                >
                  <Card
                    style={{
                      marginBottom: 0,
                      borderColor: isCurrent ? COLORS.brandPrimary + "40" : undefined,
                      borderWidth: isCurrent ? 1 : 0,
                    }}
                    padding={0}
                  >
                    <View className="p-4">
                      <View className="flex-row justify-between items-center mb-2">
                        <View className="flex-row items-center">
                          <Text className="text-white font-bold text-sm">Month {month.monthNumber}</Text>
                          {(isCompleted || isBiddingOpen) && (
                            <Ionicons name="chevron-forward" size={14} color={COLORS.text.muted} style={{ marginLeft: 4 }} />
                          )}
                        </View>
                        <Badge
                          label={
                            isCompleted ? "Completed" : isBiddingOpen ? "Bidding Open" : "Pending"
                          }
                          variant={isCompleted ? "success" : isBiddingOpen ? "info" : "neutral"}
                          dot
                        />
                      </View>

                      <Text className="text-neutral-500 text-[10px]">
                        {new Date(month.monthDate).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </Text>

                      {isCompleted && (
                        <View className="mt-3 bg-surface-elevated rounded-lg p-3">
                          <View className="flex-row justify-between mb-2">
                            <Text className="text-neutral-400 text-xs">Winner Payout</Text>
                            <Text className="text-gold-400 font-bold text-xs">{formatINR(month.winningBidAmount || 0)}</Text>
                          </View>
                          <View className="flex-row justify-between">
                            <Text className="text-neutral-400 text-xs">Member Dividend</Text>
                            <Text className="text-success-400 font-bold text-xs">+{formatINR(month.perMemberDistribution || 0)}</Text>
                          </View>
                        </View>
                      )}

                      {isCurrent && isPending && (
                        <View className="mt-3">
                          <Button
                            label={processingOpen === month.monthNumber ? "Opening..." : "Open Bidding"}
                            variant="primary"
                            size="sm"
                            disabled={processingOpen === month.monthNumber}
                            isLoading={processingOpen === month.monthNumber}
                            onPress={() => handleOpenBidding(month.monthNumber)}
                          />
                          <Text className="text-neutral-500 text-[10px] text-center mt-2 italic">
                            Ensure all members have paid before opening bidding.
                          </Text>
                        </View>
                      )}

                      {isBiddingOpen && (
                        <TouchableOpacity
                          className="mt-3 bg-brand-500/10 p-3 rounded-lg flex-row items-center justify-between"
                          onPress={() => router.push(`/committees/${id}/manage/month/${month.id}`)}
                        >
                          <View className="flex-row items-center">
                            <View className="w-2 h-2 rounded-full bg-brand-400 mr-2" />
                            <Text className="text-brand-400 font-semibold text-xs">Active Bidding Session</Text>
                          </View>
                          <Ionicons name="chevron-forward" size={16} color={COLORS.brandPrimary} />
                        </TouchableOpacity>
                      )}

                      {isCurrent && !isPending && !isBiddingOpen && (
                        <View className="mt-3 bg-surface-elevated/50 p-3 rounded-lg">
                          <Text className="text-neutral-500 text-xs text-center italic">
                            Month is not yet active. Create a new month above.
                          </Text>
                        </View>
                      )}
                    </View>
                  </Card>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}
