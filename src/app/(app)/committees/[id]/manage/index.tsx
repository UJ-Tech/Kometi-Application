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
import { formatINR } from "../../../../../utils/currency";
import { COLORS, SHADOWS, BORDER_RADIUS, SPACING } from "../../../../../constants/theme";
import Card from "../../../../../components/ui/Card";
import Badge from "../../../../../components/ui/Badge";
import Button from "../../../../../components/ui/Button";
import GradientHero from "../../../../../components/brand/GradientHero";
import BrandedLoader from "../../../../../components/brand/BrandedLoader";
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
      <View style={{ flex: 1, backgroundColor: COLORS.surface.bg, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 }}>
        <View style={{ width: 64, height: 64, borderRadius: 999, backgroundColor: "rgba(220,38,38,0.10)", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
          <Ionicons name="alert-circle-outline" size={32} color={COLORS.danger.light} />
        </View>
        <Text style={{ color: COLORS.text.primary, fontWeight: "700", fontSize: 18, textAlign: "center" }}>Invalid Committee</Text>
        <Text style={{ color: COLORS.text.secondary, fontSize: 13, textAlign: "center", marginTop: 8 }}>
          This committee could not be found. Please go back and try again.
        </Text>
        <View style={{ marginTop: 16 }}>
          <Button
            label="Back to Chits"
            variant="secondary"
            size="sm"
            onPress={() => router.replace("/committees")}
            icon={<Ionicons name="arrow-back" size={16} color={COLORS.brandPrimary} />}
          />
        </View>
      </View>
    );
  }

  // ─── Loading ────────────────────────────────────────────────────────────
  if (loading && !refreshing) {
    return <BrandedLoader message="Loading dashboard..." />;
  }

  // ─── Error State ────────────────────────────────────────────────────────
  if (error && !committee) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.surface.bg, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 }}>
        <View style={{ width: 64, height: 64, borderRadius: 999, backgroundColor: "rgba(217,119,6,0.10)", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
          <Ionicons name="cloud-offline-outline" size={32} color={COLORS.warning.light} />
        </View>
        <Text style={{ color: COLORS.text.primary, fontWeight: "700", fontSize: 18, textAlign: "center" }}>Something went wrong</Text>
        <Text style={{ color: COLORS.text.secondary, fontSize: 13, textAlign: "center", marginTop: 8, marginBottom: 24 }}>{error}</Text>
        <Button
          label="Try Again"
          variant="primary"
          size="sm"
          onPress={loadData}
          icon={<Ionicons name="refresh" size={16} color={COLORS.white} />}
        />
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ marginTop: 12 }}
        >
          <Text style={{ color: COLORS.brand[600], fontSize: 13, fontWeight: "500" }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ─── Role Guard ─────────────────────────────────────────────────────────
  if (committee) {
    const isOrganizer = committee.organizerId === currentUser?.id;
    if (!isOrganizer) {
      return (
        <View style={{ flex: 1, backgroundColor: COLORS.surface.bg, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 }}>
          <View style={{ width: 64, height: 64, borderRadius: 999, backgroundColor: "rgba(220,38,38,0.10)", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
            <Ionicons name="lock-closed-outline" size={32} color={COLORS.danger.light} />
          </View>
          <Text style={{ color: COLORS.text.primary, fontWeight: "700", fontSize: 18, textAlign: "center" }}>Access Denied</Text>
          <Text style={{ color: COLORS.text.secondary, fontSize: 13, textAlign: "center", marginTop: 8, marginBottom: 24 }}>
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
      style={{ flex: 1, backgroundColor: COLORS.surface.bg }}
      contentContainerStyle={{ paddingTop: 0, paddingBottom: 120 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.brandPrimary} />
      }
    >
      {/* Hero Header */}
      <GradientHero
        gradient={["#1e1b4b", "#312e81", "#3730a3"]}
        borderRadius={BORDER_RADIUS["4xl"]}
      >
        <View className="flex-row items-center justify-between mb-6">
          <TouchableOpacity
            onPress={() => router.back()}
            style={{
              width: 38, height: 38, borderRadius: BORDER_RADIUS.lg,
              backgroundColor: "rgba(255,255,255,0.1)",
              alignItems: "center", justifyContent: "center",
            }}
          >
            <Ionicons name="arrow-back" size={20} color={COLORS.white} />
          </TouchableOpacity>
          <Badge
            label={committee.status}
            variant={committee.status === "ACTIVE" ? "success" : committee.status === "DRAFT" ? "brand" : "neutral"}
            size="sm"
            dot
          />
        </View>

        <View className="mb-4">
          <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: "700", letterSpacing: 1, marginBottom: 4, textTransform: "uppercase" }}>
            Organiser Dashboard
          </Text>
          <Text style={{ color: COLORS.white, fontSize: 22, fontWeight: "700" }} numberOfLines={1}>
            {committee.name}
          </Text>
        </View>

        <View style={{ borderRadius: BORDER_RADIUS["2xl"], padding: 16, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" }}>
          <View className="flex-row flex-wrap">
            <View style={{ width: "50%", marginBottom: 16 }}>
              <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 }}>Total Pool</Text>
              <Text style={{ color: COLORS.gold[300], fontWeight: "700", fontSize: 16, marginTop: 4 }}>{formatINR(totalPool)}</Text>
            </View>
            <View style={{ width: "50%", marginBottom: 16, alignItems: "flex-end" }}>
              <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 }}>Organiser Reward</Text>
              <Text style={{ color: COLORS.gold[300], fontWeight: "700", fontSize: 16, marginTop: 4 }}>Month 1</Text>
            </View>
            <View style={{ width: "50%" }}>
              <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 }}>Members</Text>
              <Text style={{ color: COLORS.white, fontWeight: "700", fontSize: 16, marginTop: 4 }}>{totalMembers}</Text>
            </View>
            <View style={{ width: "50%", alignItems: "flex-end" }}>
              <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 }}>Progress</Text>
              <Text style={{ color: COLORS.gold[300], fontWeight: "700", fontSize: 16, marginTop: 4 }}>
                {completedMonths} / {totalMembers} Months
              </Text>
            </View>
          </View>
        </View>
      </GradientHero>

      {/* Error Banner (partial — committee loaded but months failed) */}
      {error && (
        <View style={{ marginHorizontal: SPACING[5], marginBottom: SPACING[4], backgroundColor: "rgba(217,119,6,0.10)", borderWidth: 1, borderColor: "rgba(217,119,6,0.20)", borderRadius: BORDER_RADIUS.xl, padding: 16, flexDirection: "row", alignItems: "center" }}>
          <Ionicons name="warning-outline" size={18} color={COLORS.warning.dark} />
          <Text style={{ color: COLORS.warning.dark, fontSize: 11, marginLeft: 8, flex: 1 }}>{error}</Text>
          <TouchableOpacity onPress={loadData}>
            <Ionicons name="refresh" size={16} color={COLORS.warning.dark} />
          </TouchableOpacity>
        </View>
      )}

      {/* Overdue Payment Obligations */}

      {/* Members List with Remove */}
      <View style={{ paddingHorizontal: SPACING[5], marginBottom: SPACING[4] }}>
        <Card accent="info" style={SHADOWS.cardSm}>
          <View style={{ padding: 16 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <View style={{ width: 4, height: 20, borderRadius: 999, backgroundColor: COLORS.info.dark }} />
              <Text style={{ color: COLORS.text.primary, fontSize: 14, fontWeight: "700" }}>
                Committee Members ({members.length})
              </Text>
            </View>
            {members.length === 0 ? (
              <View style={{ backgroundColor: "#fef2f2", borderWidth: 1, borderColor: "#fecaca", borderRadius: BORDER_RADIUS.xl, padding: 12 }}>
                <Text style={{ color: "#b91c1c", fontSize: 11, textAlign: "center" }}>
                  No members found in database. Re-add members to continue.
                </Text>
              </View>
            ) : (
              members.map((member: any) => {
                const userName = member.user?.name || "Unknown";
                const isBlocked = member.is_blocked;
                return (
                  <View key={member.id} style={{
                    borderWidth: 1, borderRadius: BORDER_RADIUS.xl, padding: 12, marginBottom: 8,
                    backgroundColor: isBlocked ? "#fef2f2" : COLORS.surface.warm,
                    borderColor: isBlocked ? "#fecaca" : COLORS.surface.border,
                  }}>
                    <View className="flex-row justify-between items-center">
                      <View style={{ flex: 1 }}>
                        <View className="flex-row items-center" style={{ gap: 6 }}>
                          <Text style={{ color: COLORS.text.primary, fontWeight: "600", fontSize: 11 }}>{userName}</Text>
                          {isBlocked && <Badge label="Blocked" variant="danger" size="sm" dot />}
                        </View>
                        <Text style={{ color: COLORS.text.secondary, fontSize: 10 }}>Slot #{member.slotNumber}</Text>
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
                        style={{ opacity: removingMember === member.id ? 0.5 : 1, backgroundColor: "#fef2f2", borderWidth: 1, borderColor: "#fecaca", paddingHorizontal: 12, paddingVertical: 6, borderRadius: BORDER_RADIUS.lg }}
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
        <View style={{ paddingHorizontal: SPACING[5], marginBottom: SPACING[4] }}>
          <Card accent="danger" style={SHADOWS.cardSm}>
            <View style={{ padding: 16 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <View style={{ width: 4, height: 20, borderRadius: 999, backgroundColor: COLORS.danger.light }} />
                <Text style={{ color: COLORS.danger.dark, fontWeight: "700", fontSize: 13 }}>Overdue Payments ({overdueObligations.length})</Text>
              </View>
              {overdueObligations.map((obl: any) => {
                const memberName = obl.committeeMember?.user?.name || "Member";
                const daysOverdue = obl.daysOverdue || 0;
                const canAdvance = daysOverdue >= 3 && obl.direction === "pay";
                return (
                  <View key={obl.id} style={{ backgroundColor: "#fef2f2", borderWidth: 1, borderColor: "#fecaca", borderRadius: BORDER_RADIUS.xl, padding: 12, marginBottom: 8 }}>
                    <View className="flex-row justify-between items-center mb-1">
                      <Text style={{ color: COLORS.text.primary, fontWeight: "600", fontSize: 11 }}>{memberName}</Text>
                      <Text style={{ color: COLORS.danger.dark, fontWeight: "700", fontSize: 11 }}>{formatINR(obl.netAmount / 100)}</Text>
                    </View>
                    <View className="flex-row justify-between items-center mb-2">
                      <Text style={{ color: COLORS.text.secondary, fontSize: 10 }}>Month {obl.committeeMonth?.month_number || "?"}</Text>
                      <Text style={{ color: COLORS.danger.dark, fontSize: 10, fontWeight: "600" }}>{daysOverdue} day{daysOverdue !== 1 ? "s" : ""} overdue</Text>
                    </View>
                    {canAdvance && (
                      <TouchableOpacity
                        onPress={() => handleAdvancePayment(obl.committeeMonth?.id, obl.memberId, memberName)}
                        disabled={advancingMember === obl.memberId}
                        style={{ opacity: advancingMember === obl.memberId ? 0.6 : 1, backgroundColor: "#fffbeb", borderWidth: 1, borderColor: "#fde68a", paddingHorizontal: 12, paddingVertical: 8, borderRadius: BORDER_RADIUS.lg, flexDirection: "row", alignItems: "center", justifyContent: "center" }}
                      >
                        {advancingMember === obl.memberId ? (
                          <ActivityIndicator size="small" color="#d97706" />
                        ) : (
                          <>
                            <Ionicons name="cash-outline" size={14} color="#d97706" />
                            <Text style={{ color: COLORS.gold[700], fontWeight: "700", fontSize: 11, marginLeft: 6 }}>Advance Payment for {memberName}</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    )}
                    {!canAdvance && (
                      <Text style={{ color: COLORS.text.secondary, fontSize: 10, fontStyle: "italic", textAlign: "center" }}>
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
        <View style={{ paddingHorizontal: SPACING[5], marginBottom: SPACING[4] }}>
          <Card accent="gold" style={SHADOWS.cardSm}>
            <View style={{ padding: 16 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <View style={{ width: 4, height: 20, borderRadius: 999, backgroundColor: COLORS.gold[500] }} />
                <Text style={{ color: COLORS.text.primary, fontSize: 14, fontWeight: "700" }}>My Advances ({organiserAdvances.length})</Text>
              </View>
              {organiserAdvances.map((adv: any) => {
                const memberName = adv.committeeMember?.user?.name || "Member";
                const isRepaid = adv.repaidStatus === "repaid";
                return (
                  <View key={adv.id} style={{
                    borderWidth: 1, borderRadius: BORDER_RADIUS.xl, padding: 12, marginBottom: 8,
                    backgroundColor: isRepaid ? "#f0fdf4" : COLORS.surface.warm,
                    borderColor: isRepaid ? "#bbf7d0" : COLORS.surface.border,
                  }}>
                    <View className="flex-row justify-between items-center mb-1">
                      <Text style={{ color: COLORS.text.primary, fontWeight: "600", fontSize: 11 }}>{memberName}</Text>
                      <Text style={{ color: isRepaid ? COLORS.success.dark : COLORS.gold[600], fontWeight: "700", fontSize: 11 }}>{formatINR(adv.netAmount / 100)}</Text>
                    </View>
                    <View className="flex-row justify-between items-center">
                      <Text style={{ color: COLORS.text.secondary, fontSize: 10 }}>Month {adv.committeeMonth?.month_number || "?"}</Text>
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
        <View style={{ paddingHorizontal: SPACING[5], marginBottom: SPACING[4] }}>
          <Card accent="danger" style={SHADOWS.cardSm}>
            <View style={{ padding: 16 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <View style={{ width: 4, height: 20, borderRadius: 999, backgroundColor: COLORS.danger.light }} />
                <Text style={{ color: COLORS.danger.dark, fontWeight: "700", fontSize: 13 }}>
                  Blocked Members ({blockedMembers.length})
                </Text>
              </View>
              {blockedMembers.map((member: any) => (
                <View key={member.id} style={{ backgroundColor: "#fef2f2", borderWidth: 1, borderColor: "#fecaca", borderRadius: BORDER_RADIUS.xl, padding: 12, marginBottom: 8 }}>
                  <View className="flex-row justify-between items-center mb-1">
                    <Text style={{ color: COLORS.text.primary, fontWeight: "600", fontSize: 11 }}>{member.name}</Text>
                    <Text style={{ color: COLORS.danger.dark, fontSize: 10 }}>
                      Slot #{member.slotNumber}
                    </Text>
                  </View>
                  <Text style={{ color: COLORS.text.secondary, fontSize: 10, marginBottom: 4 }}>
                    {member.blockedReason}
                  </Text>
                  {member.blockedAt && (
                    <Text style={{ color: COLORS.text.secondary, fontSize: 10, marginBottom: 8 }}>
                      Blocked: {new Date(member.blockedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </Text>
                  )}
                  <TouchableOpacity
                    onPress={() => handleUnblock(member.id, member.name)}
                    style={{ backgroundColor: "#f0fdf4", borderWidth: 1, borderColor: "#bbf7d0", paddingHorizontal: 12, paddingVertical: 8, borderRadius: BORDER_RADIUS.lg }}
                  >
                    <Text style={{ color: COLORS.success.dark, fontWeight: "700", fontSize: 11, textAlign: "center" }}>
                      Unblock {member.name}
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </Card>
        </View>
      )}

      <View style={{ paddingHorizontal: SPACING[5], marginBottom: SPACING[3], flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={{ width: 4, height: 20, borderRadius: 999, backgroundColor: COLORS.brand[500] }} />
          <Text style={{ color: COLORS.text.primary, fontSize: 15, fontWeight: "700" }}>Monthly Timeline</Text>
        </View>
        {months.length > 0 && (
          <Text style={{ color: COLORS.text.secondary, fontSize: 11 }}>{months.length} months</Text>
        )}
      </View>

      {/* Delete Month Button (local only — not wired to DB yet) */}
      {months.length > 0 && (
        <View style={{ paddingHorizontal: SPACING[5], marginBottom: SPACING[4] }}>
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
            style={{ backgroundColor: "#fef2f2", borderWidth: 1, borderColor: "#fecaca", paddingHorizontal: 16, paddingVertical: 12, borderRadius: BORDER_RADIUS.xl, flexDirection: "row", alignItems: "center", justifyContent: "center" }}
          >
            <Ionicons name="trash-outline" size={16} color="#ef4444" />
            <Text style={{ color: COLORS.danger.dark, fontWeight: "700", fontSize: 13, marginLeft: 8 }}>Delete Last Month (Local Only)</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Create Month Button */}
      <View style={{ paddingHorizontal: SPACING[5], marginBottom: SPACING[4] }}>
        {committee && committee.status !== "ACTIVE" ? (
          <Card accent="warning" style={SHADOWS.cardSm}>
            <View className="flex-row items-center" style={{ gap: 12 }}>
              <View style={{ width: 40, height: 40, borderRadius: 999, backgroundColor: "#fffbeb", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#fde68a" }}>
                <Ionicons name="time-outline" size={18} color="#d97706" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: COLORS.text.primary, fontWeight: "600", fontSize: 13 }}>Committee not started</Text>
                <Text style={{ color: COLORS.text.secondary, fontSize: 11, marginTop: 2 }}>
                  Start the committee from the dashboard once all {committee.totalSlots} slots are filled ({committee.filledSlots ?? 0}/{committee.totalSlots} joined).
                </Text>
              </View>
            </View>
          </Card>
        ) : committee && (committee.filledSlots ?? 0) < committee.totalSlots ? (
          <Card accent="warning" style={SHADOWS.cardSm}>
            <View className="flex-row items-center" style={{ gap: 12 }}>
              <View style={{ width: 40, height: 40, borderRadius: 999, backgroundColor: "#fffbeb", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#fde68a" }}>
                <Ionicons name="people-outline" size={18} color="#d97706" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: COLORS.text.primary, fontWeight: "600", fontSize: 13 }}>Waiting for members</Text>
                <Text style={{ color: COLORS.text.secondary, fontSize: 11, marginTop: 2 }}>
                  All {committee.totalSlots} slots must be filled before creating months. Currently {committee.filledSlots ?? 0}/{committee.totalSlots} joined.
                </Text>
              </View>
            </View>
          </Card>
        ) : months.length >= (committee?.totalSlots ?? 0) ? (
          <Card accent="success" style={SHADOWS.cardSm}>
            <View className="flex-row items-center" style={{ gap: 12 }}>
              <View style={{ width: 40, height: 40, borderRadius: 999, backgroundColor: "#f0fdf4", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#bbf7d0" }}>
                <Ionicons name="checkmark-circle-outline" size={18} color="#16a34a" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: COLORS.text.primary, fontWeight: "600", fontSize: 13 }}>All months created</Text>
                <Text style={{ color: COLORS.text.secondary, fontSize: 11, marginTop: 2 }}>
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
            style={{ backgroundColor: "rgba(79,70,229,0.08)", borderWidth: 1, borderColor: COLORS.brand[200], paddingHorizontal: 16, paddingVertical: 12, borderRadius: BORDER_RADIUS.xl, flexDirection: "row", alignItems: "center", justifyContent: "center" }}
          >
            <Ionicons name="add-circle-outline" size={18} color={COLORS.brandPrimary} />
            <Text style={{ color: COLORS.brand[700], fontWeight: "700", fontSize: 13, marginLeft: 8 }}>Create New Month</Text>
          </TouchableOpacity>
          ) : (
            <Card padding={0} accent="brand" style={SHADOWS.cardSm}>
              <View className="p-4">
                <View className="flex-row items-center justify-between mb-3">
                  <Text style={{ color: COLORS.text.secondary, fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 }}>New Month Details</Text>
                  <TouchableOpacity onPress={() => setShowCreateMonth(false)}>
                    <Ionicons name="close" size={18} color={COLORS.text.muted} />
                  </TouchableOpacity>
                </View>

                <Text style={{ color: COLORS.text.secondary, fontSize: 11, fontWeight: "600", marginBottom: 6 }}>Month Number</Text>
                <View style={{ backgroundColor: COLORS.surface.warm, borderWidth: 1, borderColor: COLORS.surface.border, borderRadius: BORDER_RADIUS.xl, paddingHorizontal: 16, height: 44, justifyContent: "center", marginBottom: 12 }}>
                  <TextInput
                    value={newMonthNumber}
                    onChangeText={setNewMonthNumber}
                    keyboardType="numeric"
                    placeholder="1"
                    placeholderTextColor={COLORS.text.muted}
                    style={{ color: COLORS.text.primary, fontWeight: "600", fontSize: 13 }}
                  />
                </View>

                <Text style={{ color: COLORS.text.secondary, fontSize: 11, fontWeight: "600", marginBottom: 6 }}>Month Date</Text>
                <View style={{ backgroundColor: COLORS.surface.warm, borderWidth: 1, borderColor: COLORS.surface.border, borderRadius: BORDER_RADIUS.xl, paddingHorizontal: 16, height: 44, justifyContent: "center", marginBottom: 12 }}>
                  <TextInput
                    value={newMonthDate}
                    onChangeText={setNewMonthDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={COLORS.text.muted}
                    style={{ color: COLORS.text.primary, fontWeight: "600", fontSize: 13 }}
                  />
                </View>

                <Text style={{ color: COLORS.text.secondary, fontSize: 10, marginBottom: 16 }}>
                  Month 1 = Organiser commission. Months 2+ = Auto-detected based on bids.
                </Text>

                <View className="flex-row gap-3">
                  <TouchableOpacity
                    onPress={() => setShowCreateMonth(false)}
                    style={{ flex: 1, height: 44, borderRadius: BORDER_RADIUS.xl, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: COLORS.surface.border }}
                  >
                    <Text style={{ color: COLORS.text.secondary, fontWeight: "700", fontSize: 13 }}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleCreateMonth}
                    disabled={isCreating}
                    style={{ flex: 1, backgroundColor: COLORS.brand[500], height: 44, borderRadius: BORDER_RADIUS.xl, alignItems: "center", justifyContent: "center", opacity: isCreating ? 0.6 : 1 }}
                  >
                    {isCreating ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={{ color: COLORS.white, fontWeight: "700", fontSize: 13 }}>Create Month</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </Card>
          )}
        </View>

      {/* Empty State */}
      {months.length === 0 && !showCreateMonth && (
        <View style={{ paddingHorizontal: SPACING[5] }}>
          <Card style={SHADOWS.cardSm}>
            <View className="items-center py-8">
              <View style={{ width: 56, height: 56, borderRadius: 999, backgroundColor: "rgba(79,70,229,0.08)", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                <Ionicons name="calendar-outline" size={28} color={COLORS.brandPrimary} />
              </View>
              <Text style={{ color: COLORS.text.primary, fontWeight: "700", fontSize: 13, marginBottom: 4 }}>No Months Created</Text>
              <Text style={{ color: COLORS.text.secondary, fontSize: 11, textAlign: "center", paddingHorizontal: 16, marginBottom: 16 }}>
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
                    <View style={{ padding: 16 }}>
                      <View className="flex-row justify-between items-center mb-2">
                        <View className="flex-row items-center">
                          <Text style={{ color: COLORS.text.primary, fontWeight: "700", fontSize: 13 }}>Month {month.monthNumber}</Text>
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

                      <Text style={{ color: COLORS.text.secondary, fontSize: 10 }}>
                        {new Date(month.monthDate).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </Text>

                      {isCompleted && (
                        <View style={{ marginTop: 12, backgroundColor: COLORS.surface.warm, borderRadius: BORDER_RADIUS.lg, padding: 12 }}>
                          <View className="flex-row justify-between mb-2">
                            <Text style={{ color: COLORS.text.secondary, fontSize: 11 }}>Winner Payout</Text>
                            <Text style={{ color: COLORS.gold[600], fontWeight: "700", fontSize: 11 }}>{formatINR(month.winningBidAmount || 0)}</Text>
                          </View>
                          <View className="flex-row justify-between mb-2">
                            <Text style={{ color: COLORS.text.secondary, fontSize: 11 }}>Member Dividend</Text>
                            <Text style={{ color: COLORS.success.dark, fontWeight: "700", fontSize: 11 }}>+{formatINR(month.perMemberDistribution || 0)}</Text>
                          </View>
                          {month.nonWinnerNetPayable > 0 && (
                            <View style={{ flexDirection: "row", justifyContent: "space-between", paddingTop: 8, borderTopWidth: 1, borderTopColor: COLORS.surface.border }}>
                              <Text style={{ color: COLORS.text.secondary, fontSize: 11 }}>Non-Winner Net Pay</Text>
                              <Text style={{ color: COLORS.danger.dark, fontWeight: "700", fontSize: 11 }}>{formatINR(month.nonWinnerNetPayable)}</Text>
                            </View>
                          )}
                        </View>
                      )}

                      {isCurrent && isPending && month.monthNumber > 1 && month.monthNumber < totalMembers && (
                        <View style={{ marginTop: 12 }}>
                          <Button
                            label={processingOpen === month.monthNumber ? "Opening..." : "Open Bidding"}
                            variant="primary"
                            size="sm"
                            disabled={processingOpen === month.monthNumber}
                            isLoading={processingOpen === month.monthNumber}
                            onPress={() => handleOpenBidding(month.monthNumber)}
                          />
                          <Text style={{ color: COLORS.text.secondary, fontSize: 10, textAlign: "center", marginTop: 8, fontStyle: "italic" }}>
                            Members pay after resolution (netted flow).
                          </Text>
                        </View>
                      )}

                      {isCurrent && isPending && month.monthNumber === 1 && (
                        <View style={{ marginTop: 12, backgroundColor: "#f0fdfa", padding: 12, borderRadius: BORDER_RADIUS.lg, borderWidth: 1, borderColor: "rgba(20,184,166,0.20)" }}>
                          <Text style={{ color: "#0f766e", fontSize: 11, fontWeight: "700", textAlign: "center" }}>
                            Organiser Commission
                          </Text>
                          <Text style={{ color: COLORS.text.secondary, fontSize: 10, textAlign: "center", marginTop: 4 }}>
                            Month 1 is auto-resolved. Organiser receives the full pool.
                          </Text>
                        </View>
                      )}

                      {isBiddingOpen && (
                        <TouchableOpacity
                          style={{ marginTop: 12, backgroundColor: "rgba(79,70,229,0.08)", padding: 12, borderRadius: BORDER_RADIUS.lg, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
                          onPress={() => router.push(`/committees/${id}/manage/month/${month.id}`)}
                        >
                          <View className="flex-row items-center">
                            <View style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: COLORS.brand[400], marginRight: 8 }} />
                            <Text style={{ color: COLORS.brand[700], fontWeight: "600", fontSize: 11 }}>Active Bidding Session</Text>
                          </View>
                          <Ionicons name="chevron-forward" size={16} color={COLORS.brandPrimary} />
                        </TouchableOpacity>
                      )}

                      {isCurrent && !isPending && !isBiddingOpen && (
                        <View style={{ marginTop: 12, backgroundColor: COLORS.surface.warm, padding: 12, borderRadius: BORDER_RADIUS.lg }}>
                          <Text style={{ color: COLORS.text.secondary, fontSize: 11, textAlign: "center", fontStyle: "italic" }}>
                            Month is not yet active. Create a new month above.
                          </Text>
                        </View>
                      )}

                      {isCurrent && isPending && month.monthNumber === totalMembers && (
                        <View style={{ marginTop: 12, backgroundColor: "#fffbeb", padding: 12, borderRadius: BORDER_RADIUS.lg, borderWidth: 1, borderColor: "rgba(217,119,6,0.20)" }}>
                          <Text style={{ color: COLORS.gold[700], fontSize: 11, fontWeight: "700", textAlign: "center" }}>
                            Last month — auto-resolves when created
                          </Text>
                          <Text style={{ color: COLORS.text.secondary, fontSize: 10, textAlign: "center", marginTop: 4 }}>
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
