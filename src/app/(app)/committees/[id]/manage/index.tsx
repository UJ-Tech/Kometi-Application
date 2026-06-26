// src/app/(app)/committees/[id]/manage/index.tsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { committeesApi } from "../../../../../services/committees.api";
import { useAuthStore } from "../../../../../stores/auth.store";
import { useCommitteeStore } from "../../../../../stores/committee.store";
import { canAccessAdminPanel } from "../../../../../utils/rbac";
import { formatINR } from "../../../../../utils/currency";
import { COLORS } from "../../../../../constants/theme";
import Card from "../../../../../components/ui/Card";
import Badge from "../../../../../components/ui/Badge";
import Button from "../../../../../components/ui/Button";
import { useAlertModal } from "../../../../../components/ui/AlertModal";

export default function OrganiserManageTimeline() {
  const params = useLocalSearchParams<{ id: string }>();
  const rawId = params.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const isValidId = !!id && id !== "undefined" && id !== "null";
  const router = useRouter();
  const currentUser = useAuthStore((s) => s.user);
  const { alert, confirm, AlertComponent } = useAlertModal();

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
  const [overdueObligations, setOverdueObligations] = useState<any[]>([]);
  const [organiserAdvances, setOrganiserAdvances] = useState<any[]>([]);
  const [blockedMembers, setBlockedMembers] = useState<any[]>([]);
  const [removingMember, setRemovingMember] = useState<string | null>(null);
  const [advancingMember, setAdvancingMember] = useState<string | null>(null);

  const notify = async (title: string, message: string) => {
    await alert(title, message);
  };

  const confirmAction = async (title: string, message: string, confirmLabel = "Confirm") => {
    return confirm(title, message, { confirmLabel });
  };

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
    }

    // Fetch overdue obligations, organiser advances, and blocked members (non-blocking)
    try {
      const [overdueRes, advancesRes, blockedRes] = await Promise.all([
        committeesApi.getOverdueObligations(id),
        committeesApi.getOrganiserAdvances(id),
        committeesApi.getBlockedMembers(id),
      ]);
      setOverdueObligations(overdueRes.data.data || []);
      setOrganiserAdvances(advancesRes.data.data || []);
      setBlockedMembers(blockedRes.data.data?.members || []);
    } catch (err: any) {
      console.error("[OrganiserManageTimeline] Obligations/advances/blocked load failed:", err);
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

  // Socket-triggered instant refresh
  const bidVersion = useCommitteeStore((s) => s.bidPlacedVersion);
  const biddingVersion = useCommitteeStore((s) => s.biddingOpenedVersion);
  const resolvedVersion = useCommitteeStore((s) => s.monthResolvedVersion);
  const contributionVersion = useCommitteeStore((s) => s.contributionUpdatedVersion);
  const socketVersionSum = bidVersion + biddingVersion + resolvedVersion + contributionVersion;
  const lastSocketVersion = useRef(0);
  const pendingRefresh = useRef(false);
  useEffect(() => {
    if (socketVersionSum > 0 && socketVersionSum !== lastSocketVersion.current) {
      lastSocketVersion.current = socketVersionSum;
      if (showCreateMonth) {
        pendingRefresh.current = true;
      } else {
        loadData();
      }
    }
  }, [socketVersionSum, loadData, showCreateMonth]);

  // Refresh deferred data when user closes the create month form
  useEffect(() => {
    if (!showCreateMonth && pendingRefresh.current) {
      pendingRefresh.current = false;
      loadData();
    }
  }, [showCreateMonth, loadData]);

  // Fallback polling every 60 seconds (in case socket disconnects)
  useEffect(() => {
    if (!isValidId) return;
    const interval = setInterval(() => {
      if (showCreateMonth) {
        pendingRefresh.current = true;
      } else {
        loadData();
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [isValidId, loadData, showCreateMonth]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const handleOpenBidding = async (monthNumber: number) => {
    try {
      setProcessingOpen(monthNumber);
      await committeesApi.openBidding(id, monthNumber);
      await notify("Success", `Bidding opened for Month ${monthNumber}`);
      loadData();
    } catch (err: any) {
      const msg = err?.message || "Failed to open bidding";
      await notify("Error", msg);
    } finally {
      setProcessingOpen(null);
    }
  };

  const handleCreateMonth = async () => {
    if (committee && committee.status !== "ACTIVE") {
      await notify("Cannot Create Month", "Start the committee first from the committee details page.");
      return;
    }
    if (committee && (committee.filledSlots ?? 0) < committee.totalSlots) {
      await notify("Cannot Create Month", `All slots must be filled first. Currently ${committee.filledSlots ?? 0}/${committee.totalSlots} joined.`);
      return;
    }
    if (months.length >= (committee?.totalSlots ?? 0)) {
      await notify("Cannot Create Month", `All ${committee?.totalSlots} months have already been created.`);
      return;
    }

    const monthNum = Number(newMonthNumber);
    if (!monthNum || monthNum < 1) {
      await notify("Invalid Input", "Month number must be at least 1.");
      return;
    }
    if (!newMonthDate.trim()) {
      await notify("Invalid Input", "Please enter a month date (YYYY-MM-DD).");
      return;
    }

    try {
      setIsCreating(true);
      await committeesApi.createMonth(id, {
        monthNumber: monthNum,
        monthDate: newMonthDate.trim(),
        resolutionType: monthNum === 1 ? "organiser_commission" : "bid_auction",
      });
      await notify("Success", `Month ${monthNum} created successfully!`);
      setNewMonthNumber("");
      setNewMonthDate("");
      setShowCreateMonth(false);
      loadData();
    } catch (err: any) {
      await notify("Error", err?.message || "Failed to create month");
    } finally {
      setIsCreating(false);
    }
  };

  const handleAdvancePayment = async (monthId: string, memberId: string, memberName: string) => {
    try {
      setAdvancingMember(memberId);
      await committeesApi.organiserAdvance(id, monthId, memberId);
      await notify("Success", `Payment advanced for ${memberName}. They now owe you this amount.`);
      loadData();
    } catch (err: any) {
      const msg = err?.message || "Failed to advance payment";
      await notify("Error", msg);
    } finally {
      setAdvancingMember(null);
    }
  };

  const handleUnblock = async (memberId: string, memberName: string) => {
    const confirmed = await confirmAction(
      "Unblock Member",
      `Are you sure you want to unblock ${memberName}? They must have paid you directly.`,
      "Unblock"
    );
    if (!confirmed) return;
    try {
      await committeesApi.unblockMember(id, memberId);
      await notify("Success", `${memberName} has been unblocked.`);
      loadData();
    } catch (err: any) {
      const msg = err?.message || "Failed to unblock member";
      await notify("Error", msg);
    }
  };

  // ─── Invalid ID ─────────────────────────────────────────────────────────
  if (!isValidId) {
    return (
      <View className="flex-1 bg-surface-50 items-center justify-center px-6">
        <View className="w-16 h-16 rounded-full bg-danger-500/10 items-center justify-center mb-4">
          <Ionicons name="alert-circle-outline" size={32} color={COLORS.danger.light} />
        </View>
        <Text className="text-slate-900 font-bold text-lg text-center">Invalid Committee</Text>
        <Text className="text-slate-500 text-sm text-center mt-2">
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
      <View className="flex-1 bg-surface-50 items-center justify-center">
        <ActivityIndicator size="large" color={COLORS.brandPrimary} />
        <Text className="text-slate-500 text-sm mt-4">Loading dashboard...</Text>
      </View>
    );
  }

  // ─── Error State ────────────────────────────────────────────────────────
  if (error && !committee) {
    return (
      <View className="flex-1 bg-surface-50 items-center justify-center px-6">
        <View className="w-16 h-16 rounded-full bg-warning-500/10 items-center justify-center mb-4">
          <Ionicons name="cloud-offline-outline" size={32} color={COLORS.warning.light} />
        </View>
        <Text className="text-slate-900 font-bold text-lg text-center">Something went wrong</Text>
        <Text className="text-slate-500 text-sm text-center mt-2 mb-6">{error}</Text>
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
          <Text className="text-brand-600 text-sm font-medium">Go Back</Text>
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
        <View className="flex-1 bg-surface-50 items-center justify-center px-6">
          <View className="w-16 h-16 rounded-full bg-danger-500/10 items-center justify-center mb-4">
            <Ionicons name="lock-closed-outline" size={32} color={COLORS.danger.light} />
          </View>
          <Text className="text-slate-900 font-bold text-lg text-center">Access Denied</Text>
          <Text className="text-slate-500 text-sm text-center mt-2 mb-6">
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
  const completedMonths = monthsData.completedMonths || 0;
  const members: any[] = committee.members || [];

  const currentMonthIndex = months.findIndex((m: any) => m.status !== "completed");
  const currentMonth = currentMonthIndex !== -1 ? months[currentMonthIndex] : null;

  // ─── Render ─────────────────────────────────────────────────────────────
  return (
    <ScrollView
      className="flex-1 bg-surface-bg"
      contentContainerStyle={{ paddingTop: 64, paddingBottom: 120 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.brandPrimary} />
      }
    >
      {/* Header */}
      <View className="px-4 flex-row items-center mb-6">
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-10 h-10 bg-surface-card rounded-full items-center justify-center border border-slate-100 mr-4"
        >
          <Ionicons name="arrow-back" size={20} color="#64748b" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-slate-900 text-xl font-bold">Fund Management</Text>
          <Text className="text-slate-500 text-xs">{committee.name}</Text>
        </View>
        <View className="w-10 h-10 bg-brand-50 rounded-full items-center justify-center">
          <Ionicons name="wallet-outline" size={18} color={COLORS.brandPrimary} />
        </View>
      </View>

      {/* Error Banner (partial — committee loaded but months failed) */}
      {error && (
        <View className="mx-4 mb-4 bg-warning-500/10 border border-warning-500/20 rounded-xl p-4 flex-row items-center">
          <Ionicons name="warning-outline" size={18} color={COLORS.warning.dark} />
          <Text className="text-warning-dark text-xs ml-2 flex-1">{error}</Text>
          <TouchableOpacity onPress={loadData}>
            <Ionicons name="refresh" size={16} color={COLORS.warning.dark} />
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
              <Text className="text-slate-900 font-bold text-sm">Committee Overview</Text>
            </View>
            <View className="flex-row flex-wrap">
              <View className="w-1/2 mb-4">
                <Text className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Total Pool</Text>
                <Text className="text-gold-600 font-bold text-base mt-1">{formatINR(totalPool)}</Text>
              </View>
              <View className="w-1/2 mb-4 items-end">
                <Text className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Organiser Reward</Text>
                <Text className="text-gold-600 font-bold text-base mt-1">Month 1</Text>
              </View>
              <View className="w-1/2">
                <Text className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Members</Text>
                <Text className="text-slate-900 font-bold text-base mt-1">{totalMembers}</Text>
              </View>
              <View className="w-1/2 items-end">
                <Text className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Progress</Text>
                <Text className="text-brand-600 font-bold text-base mt-1">
                  {completedMonths} / {totalMembers} Months
                </Text>
              </View>
            </View>
          </View>
        </Card>
      </View>

      {/* Overdue Payment Obligations */}

      {/* Members List with Remove */}
      <View className="px-4 mb-4">
        <Card>
          <View className="p-5">
            <View className="flex-row items-center justify-between mb-4">
              <View className="flex-row items-center">
                <View className="w-8 h-8 rounded-lg bg-brand-50 border border-brand-200/50 items-center justify-center mr-3">
                  <Ionicons name="people-outline" size={16} color={COLORS.brandPrimary} />
                </View>
                <Text className="text-slate-900 font-bold text-sm">
                  Committee Members ({members.length})
                </Text>
              </View>
            </View>
            {members.length === 0 ? (
              <View className="bg-red-50 border border-red-200 rounded-xl p-3">
                <Text className="text-red-700 text-xs text-center">
                  No members found in database. Re-add members to continue.
                </Text>
              </View>
            ) : (
              members.map((member: any) => {
                const userName = member.user?.name || "Unknown";
                const isBlocked = member.is_blocked;
                return (
                  <View key={member.id} className={`border rounded-xl p-3 mb-2 ${isBlocked ? "bg-red-50 border-red-200" : "bg-slate-50 border-slate-100"}`}>
                    <View className="flex-row justify-between items-center">
                      <View className="flex-1">
                        <View className="flex-row items-center">
                          <Text className="text-slate-900 font-semibold text-xs">{userName}</Text>
                          {isBlocked && <Badge label="Blocked" variant="danger" size="sm" />}
                        </View>
                        <Text className="text-slate-500 text-[10px]">Slot #{member.slotNumber}</Text>
                      </View>
                        <TouchableOpacity
                        onPress={async () => {
                          const confirmed = await confirmAction(
                            "Remove Member",
                            `Remove ${userName} from this committee?`,
                            "Remove"
                          );
                          if (!confirmed) return;
                          try {
                            setRemovingMember(member.id);
                            await committeesApi.removeMember(id, member.id);
                            await notify("Success", `${userName} removed from committee.`);
                            loadData();
                          } catch (err: any) {
                            await notify("Error", err?.message || "Failed to remove member");
                          } finally {
                            setRemovingMember(null);
                          }
                        }}
                        disabled={removingMember === member.id}
                        style={{ opacity: removingMember === member.id ? 0.5 : 1 }}
                        className="bg-red-50 border border-red-150 px-3 py-1.5 rounded-lg"
                      >
                        {removingMember === member.id ? (
                          <ActivityIndicator size="small" color="#ef4444" />
                        ) : (
                          <Ionicons name="trash-outline" size={14} color="#ef4444" />
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </Card>
      </View>

      {/* Overdue Payment Obligations */}
      {overdueObligations.length > 0 && (
        <View className="px-4 mb-4">
          <Card>
            <View className="p-5">
              <View className="flex-row items-center mb-4">
                <View className="w-8 h-8 rounded-lg bg-danger-500/15 items-center justify-center mr-3">
                  <Ionicons name="warning-outline" size={16} color={COLORS.danger.light} />
                </View>
                <Text className="text-red-700 font-bold text-sm">Overdue Payments ({overdueObligations.length})</Text>
              </View>
              {overdueObligations.map((obl: any) => {
                const memberName = obl.committeeMember?.user?.name || "Member";
                const daysOverdue = obl.daysOverdue || 0;
                const canAdvance = daysOverdue >= 3 && obl.direction === "pay";
                return (
                  <View key={obl.id} className="bg-red-50 border border-red-200 rounded-xl p-3 mb-2">
                    <View className="flex-row justify-between items-center mb-1">
                      <Text className="text-slate-900 font-semibold text-xs">{memberName}</Text>
                      <Text className="text-red-600 font-bold text-xs">{formatINR(obl.netAmount / 100)}</Text>
                    </View>
                    <View className="flex-row justify-between items-center mb-2">
                      <Text className="text-slate-500 text-[10px]">Month {obl.committeeMonth?.month_number || "?"}</Text>
                      <Text className="text-red-600 text-[10px] font-semibold">{daysOverdue} day{daysOverdue !== 1 ? "s" : ""} overdue</Text>
                    </View>
                    {canAdvance && (
                      <TouchableOpacity
                        onPress={() => handleAdvancePayment(obl.committeeMonth?.id, obl.memberId, memberName)}
                        disabled={advancingMember === obl.memberId}
                        className="bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg flex-row items-center justify-center"
                        style={{ opacity: advancingMember === obl.memberId ? 0.6 : 1 }}
                      >
                        {advancingMember === obl.memberId ? (
                          <ActivityIndicator size="small" color="#d97706" />
                        ) : (
                          <>
                            <Ionicons name="cash-outline" size={14} color="#d97706" />
                            <Text className="text-amber-700 font-bold text-[11px] ml-1.5">Advance Payment for {memberName}</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    )}
                    {!canAdvance && (
                      <Text className="text-slate-500 text-[10px] italic text-center">
                        Advance available after 3-day deadline
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>
          </Card>
        </View>
      )}

      {/* Organiser Advances Made */}
      {organiserAdvances.length > 0 && (
        <View className="px-4 mb-4">
          <Card>
            <View className="p-5">
              <View className="flex-row items-center mb-4">
                <View className="w-8 h-8 rounded-lg bg-gold-500/15 items-center justify-center mr-3">
                  <Ionicons name="wallet-outline" size={16} color={COLORS.goldPrimary} />
                </View>
                <Text className="text-slate-900 font-bold text-sm">My Advances ({organiserAdvances.length})</Text>
              </View>
              {organiserAdvances.map((adv: any) => {
                const memberName = adv.committeeMember?.user?.name || "Member";
                const isRepaid = adv.repaidStatus === "repaid";
                return (
                  <View key={adv.id} className={`border rounded-xl p-3 mb-2 ${isRepaid ? "bg-green-50 border-green-200" : "bg-slate-50 border-slate-100"}`}>
                    <View className="flex-row justify-between items-center mb-1">
                      <Text className="text-slate-900 font-semibold text-xs">{memberName}</Text>
                      <Text className={`font-bold text-xs ${isRepaid ? "text-green-700" : "text-gold-600"}`}>{formatINR(adv.netAmount / 100)}</Text>
                    </View>
                    <View className="flex-row justify-between items-center">
                      <Text className="text-slate-500 text-[10px]">Month {adv.committeeMonth?.month_number || "?"}</Text>
                      <Badge
                        label={isRepaid ? "Repaid" : "Pending"}
                        variant={isRepaid ? "success" : "warning"}
                        dot
                      />
                    </View>
                  </View>
                );
              })}
            </View>
          </Card>
        </View>
      )}

      {/* Blocked Members */}
      {blockedMembers.length > 0 && (
        <View className="px-4 mb-4">
          <Card>
            <View className="p-5">
              <View className="flex-row items-center mb-4">
                <View className="w-8 h-8 rounded-lg bg-danger-500/15 items-center justify-center mr-3">
                  <Ionicons name="lock-closed" size={16} color="#ef4444" />
                </View>
                <Text className="text-red-700 font-bold text-sm">
                  Blocked Members ({blockedMembers.length})
                </Text>
              </View>
              {blockedMembers.map((member: any) => (
                <View key={member.id} className="bg-red-50 border border-red-200 rounded-xl p-3 mb-2">
                  <View className="flex-row justify-between items-center mb-1">
                    <Text className="text-slate-900 font-semibold text-xs">{member.name}</Text>
                    <Text className="text-red-600 text-[10px]">
                      Slot #{member.slotNumber}
                    </Text>
                  </View>
                  <Text className="text-slate-500 text-[10px] mb-1">
                    {member.blockedReason}
                  </Text>
                  {member.blockedAt && (
                    <Text className="text-slate-500 text-[10px] mb-2">
                      Blocked: {new Date(member.blockedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </Text>
                  )}
                  <TouchableOpacity
                    onPress={() => handleUnblock(member.id, member.name)}
                    className="bg-green-50 border border-green-200 px-3 py-2 rounded-lg"
                  >
                    <Text className="text-green-700 font-bold text-[11px] text-center">
                      Unblock {member.name}
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </Card>
        </View>
      )}

      <View className="px-4 mb-3 flex-row items-center justify-between">
        <Text className="text-slate-900 text-base font-bold">Monthly Timeline</Text>
        {months.length > 0 && (
          <Text className="text-slate-500 text-xs">{months.length} months</Text>
        )}
      </View>

      {/* Delete Month Button (local only — not wired to DB yet) */}
      {months.length > 0 && (
        <View className="px-4 mb-4">
          <TouchableOpacity
            onPress={async () => {
              const confirmed = await confirmAction(
                "Delete Month (Local)",
                `Remove Month ${months[months.length - 1]?.monthNumber} from view? This is local only — the DB record still exists.`,
                "Delete"
              );
              if (!confirmed) return;
              const updatedMonths = months.slice(0, -1);
              setMonthsData({ ...monthsData, months: updatedMonths });
              await notify("Done", "Month removed from view. Recreate it from the app.");
            }}
            className="bg-red-50 border border-red-200 px-4 py-3 rounded-xl flex-row items-center justify-center"
          >
            <Ionicons name="trash-outline" size={16} color="#ef4444" />
            <Text className="text-red-700 font-bold text-sm ml-2">Delete Last Month (Local Only)</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Create Month Button */}
      <View className="px-4 mb-4">
        {committee && committee.status !== "ACTIVE" ? (
          <Card>
            <View className="flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-full bg-amber-50 items-center justify-center border border-amber-200">
                <Ionicons name="time-outline" size={18} color="#d97706" />
              </View>
              <View className="flex-1">
                <Text className="text-slate-900 font-semibold text-sm">Committee not started</Text>
                <Text className="text-slate-500 text-[11px] mt-0.5">
                  Start the committee from the dashboard once all {committee.totalSlots} slots are filled ({committee.filledSlots ?? 0}/{committee.totalSlots} joined).
                </Text>
              </View>
            </View>
          </Card>
        ) : committee && (committee.filledSlots ?? 0) < committee.totalSlots ? (
          <Card>
            <View className="flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-full bg-amber-50 items-center justify-center border border-amber-200">
                <Ionicons name="people-outline" size={18} color="#d97706" />
              </View>
              <View className="flex-1">
                <Text className="text-slate-900 font-semibold text-sm">Waiting for members</Text>
                <Text className="text-slate-500 text-[11px] mt-0.5">
                  All {committee.totalSlots} slots must be filled before creating months. Currently {committee.filledSlots ?? 0}/{committee.totalSlots} joined.
                </Text>
              </View>
            </View>
          </Card>
        ) : months.length >= (committee?.totalSlots ?? 0) ? (
          <Card>
            <View className="flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-full bg-success-50 items-center justify-center border border-success-200">
                <Ionicons name="checkmark-circle-outline" size={18} color="#16a34a" />
              </View>
              <View className="flex-1">
                <Text className="text-slate-900 font-semibold text-sm">All months created</Text>
                <Text className="text-slate-500 text-[11px] mt-0.5">
                  {months.length} of {committee?.totalSlots} months have been created.
                </Text>
              </View>
            </View>
          </Card>
        ) : !showCreateMonth ? (
          <TouchableOpacity
            onPress={() => {
              const nextNum = (months.length || 0) + 1;
              setNewMonthNumber(String(nextNum));
              setNewMonthDate(new Date().toISOString().split("T")[0]);
              setShowCreateMonth(true);
            }}
            className="bg-brand-50 border border-brand-200/50 px-4 py-3 rounded-xl flex-row items-center justify-center"
          >
            <Ionicons name="add-circle-outline" size={18} color={COLORS.brandPrimary} />
            <Text className="text-brand-700 font-bold text-sm ml-2">Create New Month</Text>
          </TouchableOpacity>
          ) : (
            <Card padding={0}>
              <View className="p-4">
                <View className="flex-row items-center justify-between mb-3">
                  <Text className="text-slate-500 text-xs font-semibold uppercase tracking-wider">New Month Details</Text>
                  <TouchableOpacity onPress={() => setShowCreateMonth(false)}>
                    <Ionicons name="close" size={18} color={COLORS.text.muted} />
                  </TouchableOpacity>
                </View>

                <Text className="text-slate-500 text-xs font-semibold mb-1.5">Month Number</Text>
                <View className="bg-slate-50 border border-slate-200 rounded-xl px-4 h-11 justify-center mb-3">
                  <TextInput
                    value={newMonthNumber}
                    onChangeText={setNewMonthNumber}
                    keyboardType="numeric"
                    placeholder="1"
                    placeholderTextColor="#94a3b8"
                    className="text-slate-900 font-semibold text-sm"
                  />
                </View>

                <Text className="text-slate-500 text-xs font-semibold mb-1.5">Month Date</Text>
                <View className="bg-slate-50 border border-slate-200 rounded-xl px-4 h-11 justify-center mb-3">
                  <TextInput
                    value={newMonthDate}
                    onChangeText={setNewMonthDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#94a3b8"
                    className="text-slate-900 font-semibold text-sm"
                  />
                </View>

                <Text className="text-slate-500 text-[10px] mb-4">
                  Month 1 = Organiser commission. Months 2+ = Auto-detected based on bids.
                </Text>

                <View className="flex-row gap-3">
                  <TouchableOpacity
                    onPress={() => setShowCreateMonth(false)}
                    className="flex-1 h-11 rounded-xl items-center justify-center border border-slate-200"
                  >
                    <Text className="text-slate-500 font-bold text-sm">Cancel</Text>
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
              <View className="w-14 h-14 rounded-full bg-brand-50 items-center justify-center mb-4">
                <Ionicons name="calendar-outline" size={28} color={COLORS.brandPrimary} />
              </View>
              <Text className="text-slate-900 font-bold text-sm mb-1">No Months Created</Text>
              <Text className="text-slate-500 text-xs text-center px-4 mb-4">
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
        <View className="ml-6 mr-4 border-l-2 border-slate-200 pl-6 mb-10">
          {months.map((month: any, idx: number) => {
            const isCurrent = month.id === currentMonth?.id;
            const isCompleted = month.status === "completed";
            const isBiddingOpen = month.status === "bidding_open";
            const isPending = month.status === "pending";

            return (
              <View key={month.id} className="mb-6 relative">
                {/* Timeline dot */}
                <View
                  className={`absolute -left-[31px] top-4 w-4 h-4 rounded-full border-4 border-slate-50 ${
                    isCompleted ? "bg-success-500" : isCurrent ? "bg-brand-500" : "bg-white"
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
                          <Text className="text-slate-900 font-bold text-sm">Month {month.monthNumber}</Text>
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

                      <Text className="text-slate-500 text-[10px]">
                        {new Date(month.monthDate).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </Text>

                      {isCompleted && (
                        <View className="mt-3 bg-slate-50 rounded-lg p-3">
                          <View className="flex-row justify-between mb-2">
                            <Text className="text-slate-500 text-xs">Winner Payout</Text>
                            <Text className="text-gold-600 font-bold text-xs">{formatINR(month.winningBidAmount || 0)}</Text>
                          </View>
                          <View className="flex-row justify-between mb-2">
                            <Text className="text-slate-500 text-xs">Member Dividend</Text>
                            <Text className="text-green-700 font-bold text-xs">+{formatINR(month.perMemberDistribution || 0)}</Text>
                          </View>
                          {month.nonWinnerNetPayable > 0 && (
                            <View className="flex-row justify-between pt-2 border-t border-slate-100">
                              <Text className="text-slate-500 text-xs">Non-Winner Net Pay</Text>
                              <Text className="text-red-600 font-bold text-xs">{formatINR(month.nonWinnerNetPayable)}</Text>
                            </View>
                          )}
                        </View>
                      )}

                      {isCurrent && isPending && month.monthNumber > 1 && month.monthNumber < totalMembers && (
                        <View className="mt-3">
                          <Button
                            label={processingOpen === month.monthNumber ? "Opening..." : "Open Bidding"}
                            variant="primary"
                            size="sm"
                            disabled={processingOpen === month.monthNumber}
                            isLoading={processingOpen === month.monthNumber}
                            onPress={() => handleOpenBidding(month.monthNumber)}
                          />
                          <Text className="text-slate-500 text-[10px] text-center mt-2 italic">
                            Members pay after resolution (netted flow).
                          </Text>
                        </View>
                      )}

                      {isCurrent && isPending && month.monthNumber === 1 && (
                        <View className="mt-3 bg-teal-50 p-3 rounded-lg">
                          <Text className="text-teal-700 text-xs text-center font-bold">
                            Organiser Commission
                          </Text>
                          <Text className="text-slate-500 text-[10px] text-center mt-1">
                            Month 1 is auto-resolved. Organiser receives the full pool.
                          </Text>
                        </View>
                      )}

                      {isBiddingOpen && (
                        <TouchableOpacity
                          className="mt-3 bg-brand-50 p-3 rounded-lg flex-row items-center justify-between"
                          onPress={() => router.push(`/committees/${id}/manage/month/${month.id}`)}
                        >
                          <View className="flex-row items-center">
                            <View className="w-2 h-2 rounded-full bg-brand-400 mr-2" />
                            <Text className="text-brand-700 font-semibold text-xs">Active Bidding Session</Text>
                          </View>
                          <Ionicons name="chevron-forward" size={16} color={COLORS.brandPrimary} />
                        </TouchableOpacity>
                      )}

                      {isCurrent && !isPending && !isBiddingOpen && (
                        <View className="mt-3 bg-slate-50 p-3 rounded-lg">
                          <Text className="text-slate-500 text-xs text-center italic">
                            Month is not yet active. Create a new month above.
                          </Text>
                        </View>
                      )}

                      {isCurrent && isPending && month.monthNumber === totalMembers && (
                        <View className="mt-3 bg-amber-50 p-3 rounded-lg">
                          <Text className="text-amber-700 text-xs text-center font-bold">
                            Last month — auto-resolves when created
                          </Text>
                          <Text className="text-slate-500 text-[10px] text-center mt-1">
                            Only 1 member remains, no bidding needed
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
      <AlertComponent />
      </ScrollView>
  );
}
