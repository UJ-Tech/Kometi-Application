// src/app/(app)/member/committee/[committeeId]/index.tsx
// Member Dashboard — Committee Overview
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { committeesApi } from "../../../../../services/committees.api";
import { installmentsApi } from "../../../../../services/installments.api";
import { useAuthStore } from "../../../../../stores/auth.store";
import { formatINR } from "../../../../../utils/currency";
import { COLORS, GRADIENTS } from "../../../../../constants/theme";
import Card from "../../../../../components/ui/Card";
import Badge from "../../../../../components/ui/Badge";
import Button from "../../../../../components/ui/Button";

const F = (p: number | bigint | null | undefined) => formatINR(p ?? 0);
const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export default function MemberCommitteeOverview() {
  const { committeeId: rawId } = useLocalSearchParams<{ committeeId: string }>();
  const committeeId = Array.isArray(rawId) ? rawId[0] : rawId;
  const isValidId = !!committeeId && committeeId !== "undefined" && committeeId !== "null";
  const router = useRouter();
  const currentUser = useAuthStore((s: any) => s.user);

  const [committee, setCommittee] = useState<any>(null);
  const [monthsData, setMonthsData] = useState<any>(null);
  const [currentMonthDetail, setCurrentMonthDetail] = useState<any>(null);
  const [installments, setInstallments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!isValidId) return;
    setError(null);
    try {
      const [cRes, mRes, iRes] = await Promise.allSettled([
        committeesApi.getById(committeeId),
        committeesApi.getMonths(committeeId),
        installmentsApi.getByCommittee(committeeId),
      ]);

      if (cRes.status === "fulfilled") setCommittee(cRes.value.data.data);
      else { setError("Failed to load committee."); setLoading(false); setRefreshing(false); return; }

      if (mRes.status === "fulfilled") setMonthsData(mRes.value.data.data);
      if (iRes.status === "fulfilled") setInstallments(iRes.value.data.data || []);
    } catch {
      setError("Failed to load data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [committeeId, isValidId]);

  useEffect(() => {
    if (isValidId) loadData();
    else { setLoading(false); setError("Invalid committee ID"); }
  }, [isValidId, loadData]);

  // Load current month detail when months data is available
  useEffect(() => {
    if (!monthsData?.months?.length || !committeeId) return;
    const latestMonth = monthsData.months[monthsData.months.length - 1];
    if (latestMonth?.id) {
      committeesApi.getMonth(committeeId, latestMonth.id)
        .then((res: any) => setCurrentMonthDetail(res.data.data))
        .catch(() => {});
    }
  }, [monthsData, committeeId]);

  const onRefresh = useCallback(() => { setRefreshing(true); loadData(); }, [loadData]);

  if (!isValidId) {
    return (
      <View className="flex-1 bg-surface-950 items-center justify-center px-6">
        <Ionicons name="alert-circle-outline" size={40} color={COLORS.danger.light} />
        <Text className="text-white font-bold text-lg mt-4">Invalid Committee</Text>
        <TouchableOpacity onPress={() => router.back()} className="mt-4">
          <Text className="text-brand-400 text-sm font-medium">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading && !refreshing) {
    return (
      <View className="flex-1 bg-surface-950 items-center justify-center">
        <ActivityIndicator size="large" color={COLORS.brandPrimary} />
        <Text className="text-neutral-500 text-sm mt-4">Loading committee...</Text>
      </View>
    );
  }

  if (error && !committee) {
    return (
      <View className="flex-1 bg-surface-950 items-center justify-center px-6">
        <Ionicons name="cloud-offline-outline" size={40} color={COLORS.warning.light} />
        <Text className="text-white font-bold text-lg mt-4">{error}</Text>
        <TouchableOpacity onPress={loadData} className="mt-4 bg-brand-500 px-5 py-2.5 rounded-xl">
          <Text className="text-white font-bold text-sm">Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!committee) return null;

  const members: any[] = committee.members || [];
  const months: any[] = monthsData?.months || [];
  const totalSlots = committee.totalSlots || 0;
  const installment = Number(committee.installmentAmountPaise || 0); // paise
  const totalPool = installment * totalSlots; // paise
  const totalMembers = monthsData?.totalMembers || totalSlots;

  const myMembership = members.find((m: any) => m.userId === currentUser?.id);
  const myMemberId = myMembership?.id;
  const hasWon = myMembership?.hasReceivedPayout === true;
  const slotNumber = myMembership?.slotNumber;

  // Current month info
  const currentMonth = months.length > 0 ? months[months.length - 1] : null;
  const latestMonthId = currentMonth?.id;
  const latestMonthStatus = currentMonth?.status || "pending";

  // Calculate my totals from installments
  let myTotalPaid = 0;
  let myTotalDue = 0;
  let myPendingCount = 0;
  let myLateCount = 0;
  installments.forEach((inst: any) => {
    if (inst.userId === currentUser?.id) {
      myTotalDue += inst.amountDuePaise || 0;
      myTotalPaid += inst.amountPaidPaise || 0;
      if (inst.status === "PENDING" || inst.status === "OVERDUE" || inst.status === "PARTIAL") myPendingCount++;
      if (inst.status === "OVERDUE") myLateCount++;
    }
  });

  // My distributions from current month detail
  let myCurrentDistribution = 0;
  if (currentMonthDetail && myMemberId) {
    const dist = (currentMonthDetail.memberDistributions || []).find((d: any) => d.memberId === myMemberId);
    if (dist) myCurrentDistribution = (dist.distributionAmount || 0) + (dist.interestShare || 0);
  }

  // Total received across all months (from distributions loaded so far)
  let myTotalReceived = 0;
  // We only have current month detail; for others, use the month's perMemberDistribution if available
  months.forEach((m: any) => {
    if (m.perMemberDistribution) {
      myTotalReceived += m.perMemberDistribution;
    }
  });

  // If we have the current month detail with my actual distribution, override
  if (currentMonthDetail && myMemberId) {
    const dist = (currentMonthDetail.memberDistributions || []).find((d: any) => d.memberId === myMemberId);
    if (dist) {
      // Remove the approx we added and use actual
      myTotalReceived = myTotalReceived - (currentMonth?.perMemberDistribution || 0) + myCurrentDistribution;
    }
  }

  const myNetPosition = myTotalReceived - myTotalPaid;
  const progressPercent = totalPool > 0 ? Math.min((myTotalReceived / totalPool) * 100, 100) : 0;

  // Bidding info
  const canBid = !hasWon && latestMonthStatus === "bidding_open";
  const myCurrentBid = currentMonthDetail?.bids?.find((b: any) => b.committeeMemberId === myMemberId);

  return (
    <ScrollView
      className="flex-1 bg-surface-950"
      contentContainerStyle={{ paddingTop: 64, paddingBottom: 120 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.brandPrimary} />}
    >
      <LinearGradient
        colors={[COLORS.brandPrimary + "15", "transparent"]}
        className="absolute inset-0 h-80"
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      {/* Header */}
      <View className="px-4 flex-row items-center mb-5">
        <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 bg-surface-card rounded-full items-center justify-center border border-brand-primary/10 mr-4">
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-white text-xl font-bold" numberOfLines={1}>{committee.name}</Text>
          <Text className="text-neutral-400 text-xs">Member Dashboard</Text>
        </View>
        {slotNumber && (
          <View className="bg-brand-500/15 px-3 py-1.5 rounded-full">
            <Text className="text-brand-400 text-xs font-bold">Slot #{slotNumber}</Text>
          </View>
        )}
      </View>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* Committee Info Card                                               */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <View className="px-4 mb-5">
        <Card gradient>
          <View className="flex-row items-center justify-between mb-3">
            <View>
              <Text className="text-neutral-400 text-[10px] uppercase font-bold tracking-wider">Month Progress</Text>
              <Text className="text-white font-bold text-lg mt-0.5">
                Month {months.length} of {totalMembers}
              </Text>
            </View>
            <Badge
              label={committee.status}
              variant={committee.status === "ACTIVE" ? "success" : committee.status === "COMPLETED" ? "brand" : "neutral"}
              size="md"
            />
          </View>

          <View className="flex-row flex-wrap gap-3">
            <View className="flex-1 min-w-[100px] bg-surface-950 rounded-lg p-2.5">
              <Text className="text-neutral-500 text-[9px] uppercase font-bold">Total Pool</Text>
              <Text className="text-brand-400 font-bold text-sm mt-0.5">{F(totalPool)}</Text>
            </View>
            <View className="flex-1 min-w-[100px] bg-surface-950 rounded-lg p-2.5">
              <Text className="text-neutral-500 text-[9px] uppercase font-bold">My Contribution</Text>
              <Text className="text-white font-bold text-sm mt-0.5">{F(installment)}</Text>
            </View>
          </View>
        </Card>
      </View>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* My Stats                                                          */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <View className="px-4 mb-5">
        <View className="flex-row items-center mb-3">
          <View className="w-7 h-7 rounded-lg bg-brand-500/15 items-center justify-center mr-2">
            <Ionicons name="stats-chart-outline" size={14} color={COLORS.brandPrimary} />
          </View>
          <Text className="text-white font-bold text-sm">My Stats</Text>
        </View>

        <View className="flex-row gap-3">
          <Card padding={0} style={{ flex: 1 }}>
            <View className="p-3 items-center">
              <Ionicons name="arrow-up-circle-outline" size={20} color={COLORS.danger.light} />
              <Text className="text-neutral-500 text-[9px] uppercase font-bold mt-1">Contributed</Text>
              <Text className="text-danger-400 font-bold text-sm mt-0.5">{F(myTotalPaid)}</Text>
            </View>
          </Card>
          <Card padding={0} style={{ flex: 1 }}>
            <View className="p-3 items-center">
              <Ionicons name="arrow-down-circle-outline" size={20} color={COLORS.success.light} />
              <Text className="text-neutral-500 text-[9px] uppercase font-bold mt-1">Received</Text>
              <Text className="text-success-400 font-bold text-sm mt-0.5">{F(myTotalReceived)}</Text>
            </View>
          </Card>
          <Card padding={0} style={{ flex: 1 }}>
            <View className="p-3 items-center">
              <Ionicons name="trending-up-outline" size={20} color={myNetPosition >= 0 ? COLORS.success.light : COLORS.danger.light} />
              <Text className="text-neutral-500 text-[9px] uppercase font-bold mt-1">Net</Text>
              <Text className={`font-bold text-sm mt-0.5 ${myNetPosition >= 0 ? "text-success-400" : "text-danger-400"}`}>
                {myNetPosition >= 0 ? "+" : ""}{F(myNetPosition)}
              </Text>
            </View>
          </Card>
        </View>
      </View>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* Current Month Status                                              */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <View className="px-4 mb-5">
        <View className="flex-row items-center mb-3">
          <View className="w-7 h-7 rounded-lg bg-gold-500/15 items-center justify-center mr-2">
            <Ionicons name="flash-outline" size={14} color={COLORS.goldPrimary} />
          </View>
          <Text className="text-white font-bold text-sm">Current Month</Text>
          {currentMonth && (
            <Text className="text-neutral-500 text-xs ml-2">#{currentMonth.monthNumber}</Text>
          )}
        </View>

        <Card>
          {!currentMonth ? (
            <View className="items-center py-4">
              <Ionicons name="hourglass-outline" size={28} color={COLORS.text.muted} />
              <Text className="text-neutral-500 text-xs mt-2">No months created yet</Text>
            </View>
          ) : latestMonthStatus === "pending" ? (
            <View className="items-center py-4">
              <Ionicons name="time-outline" size={28} color={COLORS.warning.light} />
              <Text className="text-white font-bold text-sm mt-2">Bidding Opens Soon</Text>
              <Text className="text-neutral-500 text-xs mt-1">Month #{currentMonth.monthNumber} is being prepared</Text>
            </View>
          ) : latestMonthStatus === "bidding_open" ? (
            <View>
              <View className="flex-row items-center justify-between mb-3">
                <Badge label="Bidding Open" variant="success" size="md" />
                {hasWon && <Badge label="Already Won" variant="warning" size="sm" />}
              </View>

              {myCurrentBid ? (
                <View className="bg-brand-500/10 rounded-xl p-3 mb-3">
                  <Text className="text-neutral-400 text-[10px] uppercase font-bold mb-1">Your Current Bid</Text>
                  <Text className="text-brand-400 font-bold text-lg">{F(myCurrentBid.bidAmount)}</Text>
                  <Text className="text-neutral-500 text-[10px] mt-1">You can edit or cancel until bidding closes</Text>
                </View>
              ) : null}

              {canBid ? (
                <Button
                  label={myCurrentBid ? "Edit Your Bid" : "Place Your Bid"}
                  variant="primary"
                  onPress={() => router.push(`/member/committee/${committeeId}/bid` as any)}
                  icon={<Ionicons name="hammer-outline" size={18} color="#fff" />}
                />
              ) : hasWon ? (
                <View className="bg-warning-500/10 rounded-xl p-3">
                  <Text className="text-warning-400 text-xs font-bold text-center">
                    You have already won a payout. You cannot bid again.
                  </Text>
                </View>
              ) : (
                <Text className="text-neutral-500 text-xs text-center py-2">You are not eligible to bid this month</Text>
              )}
            </View>
          ) : latestMonthStatus === "completed" ? (
            <View>
              <View className="flex-row items-center justify-between mb-2">
                <Badge label="Resolved" variant="brand" size="md" />
                <Text className="text-neutral-500 text-[10px]">{currentMonth.resolutionType?.replace("_", " ")}</Text>
              </View>

              {currentMonth.winnerMemberId && (
                <View className="bg-surface-950 rounded-xl p-3 mb-2">
                  <Text className="text-neutral-500 text-[10px] uppercase font-bold mb-1">Winner</Text>
                  <Text className="text-white font-bold text-sm">
                    {members.find((m: any) => m.id === currentMonth.winnerMemberId)?.user?.name || "Unknown"}
                  </Text>
                  <Text className="text-gold-400 text-xs mt-0.5">
                    Winning bid: {F(currentMonth.winningBidAmount)}
                  </Text>
                </View>
              )}

              {myCurrentDistribution > 0 && (
                <View className="bg-success-500/10 rounded-xl p-3">
                  <Text className="text-neutral-500 text-[10px] uppercase font-bold mb-1">Your Distribution</Text>
                  <Text className="text-success-400 font-bold text-lg">+{F(myCurrentDistribution)}</Text>
                </View>
              )}

              {currentMonth.perMemberDistribution > 0 && !myCurrentDistribution && (
                <View className="bg-success-500/10 rounded-xl p-3">
                  <Text className="text-neutral-500 text-[10px] uppercase font-bold mb-1">Per-Member Distribution</Text>
                  <Text className="text-success-400 font-bold text-lg">+{F(currentMonth.perMemberDistribution)}</Text>
                </View>
              )}
            </View>
          ) : null}
        </Card>
      </View>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* Eligibility Status                                                */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <View className="px-4 mb-5">
        <Card>
          <View className="flex-row items-center">
            <View className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${hasWon ? "bg-success-500/15" : "bg-brand-500/15"}`}>
              <Ionicons
                name={hasWon ? "checkmark-circle-outline" : "person-outline"}
                size={20}
                color={hasWon ? COLORS.success.light : COLORS.brandPrimary}
              />
            </View>
            <View className="flex-1">
              <Text className="text-white font-bold text-sm">
                {hasWon ? "Payout Received" : "Eligible to Bid"}
              </Text>
              <Text className="text-neutral-500 text-xs mt-0.5">
                {hasWon
                  ? "You have already received your committee payout. Thank you for participating!"
                  : "You have not won yet. Keep participating to receive your payout."}
              </Text>
            </View>
          </View>
        </Card>
      </View>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* Patience Meter / Progress Bar                                     */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {!hasWon && (
        <View className="px-4 mb-5">
          <View className="flex-row items-center mb-3">
            <View className="w-7 h-7 rounded-lg bg-success-500/15 items-center justify-center mr-2">
              <Ionicons name="pie-chart-outline" size={14} color={COLORS.success.light} />
            </View>
            <Text className="text-white font-bold text-sm">Your Progress</Text>
          </View>

          <Card>
            <View className="mb-3">
              <View className="flex-row justify-between mb-1.5">
                <Text className="text-neutral-400 text-xs">Distributions received</Text>
                <Text className="text-success-400 text-xs font-bold">{F(myTotalReceived)} / {F(totalPool)}</Text>
              </View>
              {/* Progress bar */}
              <View className="h-3 bg-surface-950 rounded-full overflow-hidden">
                <LinearGradient
                  colors={GRADIENTS.successGreen}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{ width: `${progressPercent}%`, height: "100%", borderRadius: 9999 }}
                />
              </View>
              <Text className="text-neutral-500 text-[10px] mt-1.5 text-right">
                {progressPercent.toFixed(1)}% of final payout ({F(totalPool)})
              </Text>
            </View>
          </Card>
        </View>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* Quick Actions                                                     */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <View className="px-4 mb-5">
        <View className="flex-row gap-3">
          <View style={{ flex: 1 }}>
            <Button
              label="Payment History"
              variant="secondary"
              onPress={() => router.push(`/member/committee/${committeeId}/history` as any)}
              icon={<Ionicons name="receipt-outline" size={16} color={COLORS.brandPrimary} />}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              label="Audit Log"
              variant="secondary"
              onPress={() => router.push(`/committees/${committeeId}/audit`)}
              icon={<Ionicons name="document-text-outline" size={16} color={COLORS.brandPrimary} />}
            />
          </View>
        </View>
      </View>

      {/* Pending Dues */}
      {myPendingCount > 0 && (
        <View className="px-4 mb-5">
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center">
              <View className="w-7 h-7 rounded-lg bg-danger-500/15 items-center justify-center mr-2">
                <Ionicons name="alert-circle-outline" size={14} color={COLORS.danger.light} />
              </View>
              <Text className="text-white font-bold text-sm">Pending Dues</Text>
            </View>
            <Badge label={`${myPendingCount} pending`} variant="danger" size="sm" />
          </View>

          <Card padding={0}>
            {installments
              .filter((i: any) => i.userId === currentUser?.id && (i.status === "PENDING" || i.status === "OVERDUE" || i.status === "PARTIAL"))
              .slice(0, 5)
              .map((inst: any) => (
                <View key={inst.id} className="flex-row items-center px-3.5 py-2.5 border-b border-brand-primary/5">
                  <View className="w-8 h-8 rounded-full bg-danger-500/10 items-center justify-center mr-2.5">
                    <Ionicons name="time-outline" size={14} color={COLORS.danger.light} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-white text-xs font-semibold">Cycle #{inst.cycleNo}</Text>
                    <Text className="text-neutral-500 text-[10px]">Due: {fmtDate(inst.dueDate)}</Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-danger-400 text-xs font-bold">{F(inst.amountDuePaise)}</Text>
                    {inst.penaltyPaise > 0 && (
                      <Text className="text-warning-400 text-[9px]">+{F(inst.penaltyPaise)} late fee</Text>
                    )}
                  </View>
                </View>
              ))}
          </Card>
        </View>
      )}
    </ScrollView>
  );
}
