// src/app/(app)/member/committee/[committeeId]/index.tsx
// Member Dashboard — Committee Overview
import React, { useState, useEffect, useCallback, useRef } from "react";
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
import BrandedLoader from "../../../../../components/brand/BrandedLoader";
import { installmentsApi } from "../../../../../services/installments.api";
import { useAuthStore } from "../../../../../stores/auth.store";
import { useCommitteeStore } from "../../../../../stores/committee.store";
import { formatINR } from "../../../../../utils/currency";
import { COLORS, GRADIENTS, SHADOWS, BORDER_RADIUS, SPACING } from "../../../../../constants/theme";
import Card from "../../../../../components/ui/Card";
import Badge from "../../../../../components/ui/Badge";
import Button from "../../../../../components/ui/Button";
import GradientHero from "../../../../../components/brand/GradientHero";
import PayNowButton from "../../../../../components/payments/PayNowButton";
import PayNetButton from "../../../../../components/payments/PayNetButton";

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
  const [memberStats, setMemberStats] = useState<any>(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockedReason, setBlockedReason] = useState("");
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

      const cData = cRes.status === "fulfilled" ? cRes.value.data.data : null;
      if (cData) {
        const members: any[] = cData.members || [];
        const myMembership = members.find((m: any) => m.userId === currentUser?.id);
        if (myMembership?.id) {
          const sRes = await committeesApi.getMemberStats(committeeId, myMembership.id).catch(() => null);
          if (sRes) setMemberStats(sRes.data.data);
        }
      }
    } catch {
      setError("Failed to load data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [committeeId, isValidId, currentUser?.id]);

  // Use a ref for monthsData to avoid stale closures in intervals/socket handlers
  const monthsDataRef = useRef(monthsData);
  monthsDataRef.current = monthsData;

  useEffect(() => {
    if (isValidId) loadData();
    else { setLoading(false); setError("Invalid committee ID"); }
  }, [isValidId, loadData]);

  // Auto-refresh all committee data every 30 seconds
  useEffect(() => {
    if (!isValidId) return;
    const interval = setInterval(() => {
      loadData();
      const md = monthsDataRef.current;
      if (md?.months?.length) {
        const latestMonth = md.months[md.months.length - 1];
        if (latestMonth?.id) {
          committeesApi.getMonth(committeeId, latestMonth.id)
            .then((res: any) => setCurrentMonthDetail(res.data.data))
            .catch(() => {});
        }
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [isValidId, loadData, committeeId]);

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

  // NOTE: Month detail is refreshed in the main interval above (every 30s)

  // Instant refresh when socket events fire
  const biddingVersion = useCommitteeStore((s) => s.biddingOpenedVersion);
  const resolvedVersion = useCommitteeStore((s) => s.monthResolvedVersion);
  const bidVersion = useCommitteeStore((s) => s.bidPlacedVersion);
  const contributionVersion = useCommitteeStore((s) => s.contributionUpdatedVersion);
  const socketVersionSum = biddingVersion + resolvedVersion + bidVersion + contributionVersion;
  const lastSocketVersion = useRef(0);
  useEffect(() => {
    if (socketVersionSum > 0 && socketVersionSum !== lastSocketVersion.current) {
      lastSocketVersion.current = socketVersionSum;
      loadData();
      const md = monthsDataRef.current;
      if (md?.months?.length) {
        const latestMonth = md.months[md.months.length - 1];
        if (latestMonth?.id) {
          committeesApi.getMonth(committeeId, latestMonth.id)
            .then((res: any) => setCurrentMonthDetail(res.data.data))
            .catch(() => {});
        }
      }
    }
  }, [socketVersionSum, loadData, committeeId]);

  const onRefresh = useCallback(() => { setRefreshing(true); loadData(); }, [loadData]);

  if (!isValidId) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.surface.bg, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 }}>
        <Ionicons name="alert-circle-outline" size={40} color={COLORS.danger.light} />
        <Text style={{ color: COLORS.text.primary, fontWeight: "700", fontSize: 18, marginTop: 16 }}>Invalid Committee</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ color: COLORS.brand[600], fontSize: 13, fontWeight: "500" }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading && !refreshing) {
    return <BrandedLoader message="Loading committee..." />;
  }

  if (error && !committee) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.surface.bg, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 }}>
        <Ionicons name="cloud-offline-outline" size={40} color={COLORS.warning.light} />
        <Text style={{ color: COLORS.text.primary, fontWeight: "700", fontSize: 18, marginTop: 16 }}>{error}</Text>
        <TouchableOpacity onPress={loadData} style={{ backgroundColor: COLORS.brand[500], paddingHorizontal: 20, paddingVertical: 10, borderRadius: BORDER_RADIUS.xl, marginTop: 16 }}>
          <Text style={{ color: COLORS.white, fontWeight: "700", fontSize: 13 }}>Retry</Text>
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
  const memberIsBlocked = myMembership?.is_blocked === true;
  const memberBlockedReason = myMembership?.blocked_reason || "";

  // Current month info
  const currentMonth = months.length > 0 ? months[months.length - 1] : null;
  const latestMonthId = currentMonth?.id;
  const latestMonthStatus = currentMonth?.status || "pending";

  // ─── Winner detection for current resolved month ──────────────────────
  const isWinnerOfCurrentMonth = currentMonth?.status === "completed" && currentMonth?.winnerMemberId && myMemberId
    ? currentMonth.winnerMemberId === myMemberId
    : false;

  // ─── STATS: Use real data from member_payment_obligations ──────────────
  // All amounts in paise from the database
  // Fallback: sum all paid/completed installments if memberStats is unavailable
  const myPaidFromInstallments = installments
    .filter((i: any) => i.userId === currentUser?.id && (i.status === "PAID" || i.status === "COMPLETED"))
    .reduce((sum: number, i: any) => sum + (i.amountPaidPaise || i.amountDuePaise || 0), 0);
  const myTotalPaid = memberStats?.totalPaidPaise ?? myPaidFromInstallments;
  const myTotalReceived = memberStats?.totalCreditedPaise ?? 0;
  const myNetPosition = memberStats?.netPositionPaise ?? (myTotalReceived - myTotalPaid);
  // Progress: total received vs (monthly pool * completed months) — shows how much of total earnings received
  const completedMonths = monthsData?.completedMonths || months.filter((m: any) => m.status === "completed").length;
  const totalExpectedPayout = totalPool * Math.max(completedMonths, 1);
  const progressPercent = totalExpectedPayout > 0 ? Math.min((myTotalReceived / totalExpectedPayout) * 100, 100) : 0;

  // Pending dues count from installments
  // Exclude organiser's cycle 1 during organiser_commission month (they don't physically pay)
  const isOrganiser = committee.organizerId === currentUser?.id;
  const currentResolutionType = currentMonth?.resolutionType;

  // Build set of cycle numbers where this member is the winner (auto-paid via netting)
  const myWonCycleNos = new Set(
    months
      .filter((m: any) => m.status === "completed" && m.winnerMemberId === myMemberId)
      .map((m: any) => m.monthNumber)
  );

  let myPendingCount = 0;
  installments.forEach((inst: any) => {
    if (inst.userId === currentUser?.id) {
      if (inst.status === "PENDING" || inst.status === "OVERDUE" || inst.status === "PARTIAL") {
        // Skip organiser's cycle 1 during organiser_commission month
        if (isOrganiser && inst.cycleNo === 1 && currentResolutionType === "organiser_commission") return;
        // Skip any cycle where this member is the winner (netted from payout)
        if (myWonCycleNos.has(inst.cycleNo)) return;
        myPendingCount++;
      }
    }
  });

  // Current month distribution from detail
  let myCurrentDistribution = 0;
  if (currentMonthDetail && myMemberId) {
    const dist = (currentMonthDetail.memberDistributions || []).find((d: any) => d.memberId === myMemberId);
    if (dist) myCurrentDistribution = dist.distributionAmount || 0;
  }

  // Bidding info
  const canBid = !hasWon && !memberIsBlocked && latestMonthStatus === "bidding_open";
  const myCurrentBid = currentMonthDetail?.bids?.find((b: any) => b.memberId === myMemberId);
  const allBids: any[] = currentMonthDetail?.bids || [];
  const sortedBids = [...allBids].sort((a: any, b: any) => (a.bidAmount || 0) - (b.bidAmount || 0));
  const lowestBid = sortedBids.length > 0 ? sortedBids[0] : null;
  const myBidRank = myCurrentBid ? sortedBids.findIndex((b: any) => b.memberId === myMemberId) + 1 : 0;

  return (
    <ScrollView
      className="flex-1 bg-surface-50"
      contentContainerStyle={{ paddingTop: 0, paddingBottom: 120 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.brandPrimary} />}
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
          {slotNumber && (
            <View style={{ backgroundColor: "rgba(255,255,255,0.1)", borderRadius: BORDER_RADIUS.full, paddingHorizontal: 12, paddingVertical: 6 }}>
              <Text style={{ color: COLORS.gold[300], fontSize: 11, fontWeight: "700" }}>Slot #{slotNumber}</Text>
            </View>
          )}
        </View>

        <View className="mb-2">
          <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: "700", letterSpacing: 1, marginBottom: 4, textTransform: "uppercase" }}>
            Member Dashboard
          </Text>
          <Text style={{ color: COLORS.white, fontSize: 22, fontWeight: "700" }} numberOfLines={1}>
            {committee.name}
          </Text>
        </View>

        <View style={{ marginTop: 16, borderRadius: BORDER_RADIUS["2xl"], padding: 16, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" }}>
          <View className="flex-row items-center justify-between mb-3">
            <View>
              <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 10, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase" }}>Month Progress</Text>
              <Text style={{ color: COLORS.white, fontSize: 16, fontWeight: "700", marginTop: 2 }}>
                Month {months.length} of {totalMembers}
              </Text>
            </View>
            <Badge
              label={committee.status}
              variant={committee.status === "ACTIVE" ? "success" : committee.status === "COMPLETED" ? "brand" : "neutral"}
              size="md"
              dot
            />
          </View>
          <View className="flex-row gap-3">
            <View style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: BORDER_RADIUS.lg, padding: 10 }}>
              <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 9, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 }}>Total Pool</Text>
              <Text style={{ color: COLORS.gold[300], fontWeight: "700", fontSize: 15, marginTop: 2 }}>{F(totalPool)}</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: BORDER_RADIUS.lg, padding: 10 }}>
              <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 9, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 }}>My Contribution</Text>
              <Text style={{ color: COLORS.white, fontWeight: "700", fontSize: 15, marginTop: 2 }}>{F(installment)}</Text>
            </View>
          </View>
        </View>
      </GradientHero>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* My Stats                                                          */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <View style={{ paddingHorizontal: SPACING[5], marginBottom: SPACING[5] }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <View style={{ width: 4, height: 20, borderRadius: 999, backgroundColor: COLORS.brand[500] }} />
          <Text style={{ color: COLORS.text.primary, fontSize: 14, fontWeight: "700" }}>My Stats</Text>
        </View>

        <View className="flex-row gap-3">
          <Card padding={0} style={{ flex: 1 }} accent="brand">
            <View className="p-3 items-center">
              <Ionicons name="arrow-up-circle-outline" size={20} color={COLORS.danger.light} />
              <Text style={{ color: COLORS.text.secondary, fontSize: 9, fontWeight: "700", textTransform: "uppercase", marginTop: 4 }}>Contributed</Text>
              <Text style={{ color: COLORS.danger.dark, fontWeight: "700", fontSize: 13, marginTop: 2 }}>{F(myTotalPaid)}</Text>
            </View>
          </Card>
          <Card padding={0} style={{ flex: 1 }} accent="success">
            <View className="p-3 items-center">
              <Ionicons name="arrow-down-circle-outline" size={20} color={COLORS.success.light} />
              <Text style={{ color: COLORS.text.secondary, fontSize: 9, fontWeight: "700", textTransform: "uppercase", marginTop: 4 }}>Received</Text>
              <Text style={{ color: COLORS.success.dark, fontWeight: "700", fontSize: 13, marginTop: 2 }}>{F(myTotalReceived)}</Text>
            </View>
          </Card>
          <Card padding={0} style={{ flex: 1 }}>
            <View className="p-3 items-center">
              <Ionicons name="trending-up-outline" size={20} color={myNetPosition >= 0 ? COLORS.success.light : COLORS.danger.light} />
              <Text style={{ color: COLORS.text.secondary, fontSize: 9, fontWeight: "700", textTransform: "uppercase", marginTop: 4 }}>Net</Text>
              <Text style={{ color: myNetPosition >= 0 ? COLORS.success.dark : COLORS.danger.dark, fontWeight: "700", fontSize: 13, marginTop: 2 }}>
                {myNetPosition >= 0 ? "+" : ""}{F(myNetPosition)}
              </Text>
            </View>
          </Card>
        </View>
      </View>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* Blocked Status Card                                               */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {memberIsBlocked && (
        <View style={{ paddingHorizontal: SPACING[5], marginBottom: SPACING[4] }}>
          <Card accent="danger" padding={16} style={SHADOWS.cardSm}>
            <View className="flex-row items-center mb-2">
              <Ionicons name="lock-closed" size={20} color={COLORS.danger.light} />
              <Text style={{ color: COLORS.danger.dark, fontWeight: "700", fontSize: 13, marginLeft: 8 }}>Account Blocked</Text>
            </View>
            <Text style={{ color: COLORS.text.secondary, fontSize: 11 }}>
              {memberBlockedReason || "Your account is blocked due to overdue payment."}
            </Text>
            <Text style={{ color: COLORS.text.secondary, fontSize: 11, marginTop: 8 }}>
              Please pay the organiser to unblock your account.
            </Text>
          </Card>
        </View>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* Current Month Status                                              */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <View style={{ paddingHorizontal: SPACING[5], marginBottom: SPACING[5] }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <View style={{ width: 4, height: 20, borderRadius: 999, backgroundColor: COLORS.gold[500] }} />
          <Text style={{ color: COLORS.text.primary, fontSize: 14, fontWeight: "700" }}>Current Month</Text>
          {currentMonth && (
            <Text style={{ color: COLORS.text.muted, fontSize: 11, marginLeft: 4 }}>#{currentMonth.monthNumber || months.length}</Text>
          )}
        </View>

        <Card accent="info" style={SHADOWS.cardSm}>
          {!currentMonth ? (
            <View className="items-center py-4">
              <Ionicons name="hourglass-outline" size={28} color={COLORS.text.muted} />
              <Text style={{ color: COLORS.text.secondary, fontSize: 11, marginTop: 8 }}>No months created yet</Text>
            </View>
          ) : latestMonthStatus === "pending" ? (
            <View>
              <View className="flex-row items-center justify-between mb-3">
                <Badge label="Contribution Due" variant="warning" size="md" />
                <Text style={{ color: COLORS.text.secondary, fontSize: 10 }}>Month #{currentMonth.monthNumber || months.length}</Text>
              </View>

              {/* Projected Pool & Distribution */}
              <View style={{ backgroundColor: COLORS.surface.warm, borderRadius: BORDER_RADIUS.xl, padding: 12, marginBottom: 8 }}>
                <View className="flex-row justify-between items-center mb-2">
                  <Text style={{ color: COLORS.text.muted, fontSize: 10, fontWeight: "700", textTransform: "uppercase" }}>Total Pool</Text>
                  <Text style={{ color: COLORS.text.primary, fontWeight: "700", fontSize: 13 }}>{F(currentMonth.totalPool)}</Text>
                </View>
                <View className="flex-row justify-between items-center mb-2">
                  <Text style={{ color: COLORS.text.muted, fontSize: 10, fontWeight: "700", textTransform: "uppercase" }}>Your Contribution</Text>
                  <Text style={{ color: COLORS.text.primary, fontWeight: "700", fontSize: 13 }}>{F(installment)}</Text>
                </View>
                <View className="flex-row justify-between items-center">
                  <Text style={{ color: COLORS.text.muted, fontSize: 10, fontWeight: "700", textTransform: "uppercase" }}>Est. Distribution/Member</Text>
                  <Text style={{ color: COLORS.success.dark, fontWeight: "700", fontSize: 13 }}>+{F(currentMonth.perMemberDistribution)}</Text>
                </View>
              </View>

              {currentMonth.monthNumber === 1 || currentMonth.resolutionType === "organiser_commission" ? (
                hasWon ? (
                  <View style={{ backgroundColor: "rgba(22,163,74,0.10)", borderRadius: BORDER_RADIUS.xl, padding: 12, marginTop: 4 }}>
                    <View className="flex-row items-center">
                      <Ionicons name="checkmark-circle" size={16} color={COLORS.success.light} />
                      <Text style={{ color: COLORS.success.dark, fontSize: 11, fontWeight: "700", marginLeft: 6 }}>You already received a payout</Text>
                    </View>
                  </View>
                ) : (
                  <View>
                    <View style={{ backgroundColor: "#f0fdfa", borderRadius: BORDER_RADIUS.xl, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: "rgba(20,184,166,0.20)" }}>
                      <Text style={{ color: "#0f766e", fontSize: 11, fontWeight: "700", textAlign: "center" }}>
                        Organiser Commission Month
                      </Text>
                      <Text style={{ color: COLORS.text.secondary, fontSize: 10, textAlign: "center", marginTop: 4 }}>
                        Pay your contribution directly. No bidding needed.
                      </Text>
                    </View>
                    <PayNetButton
                      committeeId={committeeId}
                      monthId={currentMonth.id}
                      memberId={myMemberId}
                      monthNumber={currentMonth.monthNumber || 1}
                      netAmountPaise={installment}
                      contributionAmount={installment}
                      distributionShare={0}
                      isBlocked={memberIsBlocked}
                      onPaymentSuccess={loadData}
                    />
                  </View>
                )
              ) : (
                <Text style={{ color: COLORS.text.secondary, fontSize: 10, textAlign: "center", marginTop: 4 }}>
                  Waiting for organizer to open bidding
                </Text>
              )}
            </View>
          ) : latestMonthStatus === "bidding_open" ? (
            <View>
              <View className="flex-row items-center justify-between mb-3">
                <Badge label="Bidding Open" variant="success" size="md" dot />
                {hasWon && <Badge label="Already Won" variant="warning" size="sm" dot />}
              </View>

              {/* My bid status */}
              {myCurrentBid ? (
                <View style={{ backgroundColor: "rgba(79,70,229,0.08)", borderRadius: BORDER_RADIUS.xl, padding: 12, marginBottom: 12 }}>
                  <View className="flex-row items-center justify-between">
                    <View>
                      <Text style={{ color: COLORS.text.muted, fontSize: 10, fontWeight: "700", textTransform: "uppercase", marginBottom: 4 }}>Your Current Bid</Text>
                      <Text style={{ color: COLORS.brand[600], fontWeight: "700", fontSize: 18 }}>{F(myCurrentBid.bidAmount)}</Text>
                    </View>
                    {myBidRank > 0 && (
                      <View className="items-end">
                        <Text style={{ color: COLORS.text.secondary, fontSize: 10, fontWeight: "700", textTransform: "uppercase", marginBottom: 4 }}>Your Rank</Text>
                        <Text style={{ color: myBidRank === 1 ? COLORS.gold[600] : COLORS.text.muted, fontWeight: "700", fontSize: 18 }}>
                          #{myBidRank}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={{ color: COLORS.text.secondary, fontSize: 10, marginTop: 4 }}>You can edit or cancel until bidding closes</Text>
                </View>
              ) : null}

              {/* Lowest bid info */}
              {lowestBid && (
                <View style={{ backgroundColor: "rgba(245,158,11,0.08)", borderRadius: BORDER_RADIUS.xl, padding: 12, marginBottom: 12 }}>
                  <View className="flex-row items-center justify-between">
                    <View>
                      <Text style={{ color: COLORS.text.muted, fontSize: 10, fontWeight: "700", textTransform: "uppercase", marginBottom: 4 }}>Lowest Bid</Text>
                      <Text style={{ color: COLORS.gold[600], fontWeight: "700", fontSize: 18 }}>{F(lowestBid.bidAmount)}</Text>
                    </View>
                    <View className="items-end">
                      <Text style={{ color: COLORS.text.muted, fontSize: 10, fontWeight: "700", textTransform: "uppercase", marginBottom: 4 }}>Bids Placed</Text>
                      <Text style={{ color: COLORS.text.primary, fontWeight: "700", fontSize: 18 }}>{allBids.length}</Text>
                    </View>
                  </View>
                  <Text style={{ color: COLORS.text.secondary, fontSize: 10, marginTop: 4 }}>Lowest bidder wins the pool</Text>
                </View>
              )}

              {canBid ? (
                <Button
                  label={myCurrentBid ? "Edit Your Bid" : "Place Your Bid"}
                  variant="primary"
                  onPress={() => router.push(`/member/committee/${committeeId}/bid` as any)}
                  icon={<Ionicons name="hammer-outline" size={18} color="#fff" />}
                />
              ) : hasWon ? (
                <View style={{ backgroundColor: "rgba(217,119,6,0.10)", borderRadius: BORDER_RADIUS.xl, padding: 12 }}>
                  <Text style={{ color: COLORS.warning.dark, fontSize: 11, fontWeight: "700", textAlign: "center" }}>
                    You have already won a payout. You cannot bid again.
                  </Text>
                </View>
              ) : (
                <Text style={{ color: COLORS.text.secondary, fontSize: 11, textAlign: "center", paddingVertical: 8 }}>You are not eligible to bid this month</Text>
              )}
            </View>
          ) : latestMonthStatus === "completed" ? (
            <View>
              <View className="flex-row items-center justify-between mb-2">
                <Badge label="Resolved" variant="brand" size="md" dot />
                <Text style={{ color: COLORS.text.secondary, fontSize: 10 }}>{currentMonth.resolutionType?.replace("_", " ")}</Text>
              </View>

              {currentMonth.winnerMemberId && (
                <View style={{ backgroundColor: COLORS.surface.warm, borderRadius: BORDER_RADIUS.xl, padding: 12, marginBottom: 8 }}>
                  <Text style={{ color: COLORS.text.secondary, fontSize: 10, fontWeight: "700", textTransform: "uppercase", marginBottom: 4 }}>Winner</Text>
                  <Text style={{ color: COLORS.text.primary, fontWeight: "700", fontSize: 13 }}>
                    {members.find((m: any) => m.id === currentMonth.winnerMemberId)?.user?.name || "Unknown"}
                  </Text>
                  <Text style={{ color: COLORS.gold[600], fontSize: 11, marginTop: 2 }}>
                    Winning bid: {F(currentMonth.winningBidAmount)}
                  </Text>
                </View>
              )}

              {/* Net payment obligation for current member */}
              {isWinnerOfCurrentMonth ? (
                <View style={{ backgroundColor: "rgba(22,163,74,0.10)", borderRadius: BORDER_RADIUS.xl, padding: 12, marginTop: 8 }}>
                  <View className="flex-row items-center mb-1">
                    <Ionicons name="checkmark-circle" size={16} color={COLORS.success.light} />
                    <Text style={{ color: COLORS.success.dark, fontSize: 11, fontWeight: "700", marginLeft: 6 }}>Winner — Contribution Netted</Text>
                  </View>
                  <Text style={{ color: COLORS.text.muted, fontSize: 10, lineHeight: 16 }}>
                    You won this month. Your {F(installment)} contribution has been adjusted against your payout of {F(currentMonth.winningBidAmount)}. No payment needed.
                  </Text>
                </View>
              ) : currentMonthDetail?.paymentObligations && myMemberId && (() => {
                const myObligation = currentMonthDetail.paymentObligations.find(
                  (o: any) => o.memberId === myMemberId
                );
                if (!myObligation) return null;

                if (myObligation.direction === "pay" && (myObligation.status === "pending" || myObligation.status === "overdue")) {
                  return (
                    <View style={{ marginTop: 8 }}>
                      <PayNetButton
                        committeeId={committeeId}
                        monthId={currentMonth.id}
                        memberId={myMemberId}
                        monthNumber={currentMonth.monthNumber || months.length}
                        netAmountPaise={Math.abs(myObligation.netAmount)}
                        dueDate={myObligation.dueDate}
                        contributionAmount={myObligation.contributionAmount}
                        distributionShare={myObligation.distributionShare}
                        isBlocked={memberIsBlocked}
                        onPaymentSuccess={loadData}
                      />
                    </View>
                  );
                }

                if (myObligation.direction === "receive" && myObligation.status === "pending") {
                  return (
                    <View style={{ backgroundColor: "rgba(22,163,74,0.10)", borderRadius: BORDER_RADIUS.xl, padding: 12, marginTop: 8 }}>
                      <Text style={{ color: COLORS.text.secondary, fontSize: 10, fontWeight: "700", textTransform: "uppercase", marginBottom: 4 }}>Your Payout — Expected</Text>
                      <Text style={{ color: COLORS.success.dark, fontWeight: "700", fontSize: 18 }}>+{F(Math.abs(myObligation.netAmount))}</Text>
                      <Text style={{ color: COLORS.text.secondary, fontSize: 10, marginTop: 4 }}>
                        Credited to wallet after all members pay
                      </Text>
                    </View>
                  );
                }

                if (myObligation.status === "paid") {
                  return (
                    <View style={{ backgroundColor: "rgba(22,163,74,0.10)", borderRadius: BORDER_RADIUS.xl, padding: 12, marginTop: 8 }}>
                      <View className="flex-row items-center">
                        <Ionicons name="checkmark-circle" size={16} color={COLORS.success.light} />
                        <Text style={{ color: COLORS.success.dark, fontSize: 11, fontWeight: "700", marginLeft: 6 }}>Payment Completed</Text>
                      </View>
                    </View>
                  );
                }

                if (myObligation.status === "organiser_advanced") {
                  return (
                    <View style={{ backgroundColor: "rgba(217,119,6,0.10)", borderRadius: BORDER_RADIUS.xl, padding: 12, marginTop: 8 }}>
                      <View className="flex-row items-center">
                        <Ionicons name="person-outline" size={16} color={COLORS.warning.light} />
                        <Text style={{ color: COLORS.warning.dark, fontSize: 11, fontWeight: "700", marginLeft: 6 }}>Paid by Organizer</Text>
                      </View>
                      <Text style={{ color: COLORS.text.secondary, fontSize: 10, marginTop: 4 }}>
                        Organizer advanced {F(Math.abs(myObligation.netAmount))} on your behalf
                      </Text>
                      {memberIsBlocked && (
                        <Text style={{ color: COLORS.danger.dark, fontSize: 10, marginTop: 4 }}>
                          Pay this amount to the organiser to unblock your account.
                        </Text>
                      )}
                    </View>
                  );
                }

                return null;
              })()}

              {myCurrentDistribution > 0 && (
                <View style={{ backgroundColor: "rgba(22,163,74,0.10)", borderRadius: BORDER_RADIUS.xl, padding: 12, marginTop: 8 }}>
                  <Text style={{ color: COLORS.text.secondary, fontSize: 10, fontWeight: "700", textTransform: "uppercase", marginBottom: 4 }}>Your Distribution</Text>
                  <Text style={{ color: COLORS.success.dark, fontWeight: "700", fontSize: 18 }}>+{F(myCurrentDistribution)}</Text>
                </View>
              )}

              {currentMonth.perMemberDistribution > 0 && !myCurrentDistribution && (
                <View style={{ backgroundColor: "rgba(22,163,74,0.10)", borderRadius: BORDER_RADIUS.xl, padding: 12, marginTop: 8 }}>
                  <Text style={{ color: COLORS.text.secondary, fontSize: 10, fontWeight: "700", textTransform: "uppercase", marginBottom: 4 }}>Per-Member Distribution</Text>
                  <Text style={{ color: COLORS.success.dark, fontWeight: "700", fontSize: 18 }}>+{F(currentMonth.perMemberDistribution)}</Text>
                </View>
              )}
            </View>
          ) : null}
        </Card>
      </View>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* Eligibility Status                                                */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <View style={{ paddingHorizontal: SPACING[5], marginBottom: SPACING[5] }}>
        <Card accent={hasWon ? "success" : "brand"} style={SHADOWS.cardSm}>
          <View className="flex-row items-center">
            <View style={{
              width: 40, height: 40, borderRadius: 999,
              backgroundColor: hasWon ? "rgba(22,163,74,0.10)" : "rgba(79,70,229,0.10)",
              alignItems: "center", justifyContent: "center", marginRight: 12,
            }}>
              <Ionicons
                name={hasWon ? "checkmark-circle-outline" : "person-outline"}
                size={20}
                color={hasWon ? COLORS.success.light : COLORS.brandPrimary}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: COLORS.text.primary, fontWeight: "700", fontSize: 13 }}>
                {hasWon ? "Payout Received" : "Eligible to Bid"}
              </Text>
              <Text style={{ color: COLORS.text.secondary, fontSize: 11, marginTop: 2 }}>
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
        <View style={{ paddingHorizontal: SPACING[5], marginBottom: SPACING[5] }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <View style={{ width: 4, height: 20, borderRadius: 999, backgroundColor: COLORS.success.dark }} />
            <Text style={{ color: COLORS.text.primary, fontSize: 14, fontWeight: "700" }}>Your Progress</Text>
          </View>

          <Card accent="success" style={SHADOWS.cardSm}>
            <View>
              <View className="flex-row justify-between mb-1.5">
                <Text style={{ color: COLORS.text.muted, fontSize: 11 }}>Distributions received</Text>
                <Text style={{ color: COLORS.success.dark, fontSize: 11, fontWeight: "700" }}>{F(myTotalReceived)} / {F(totalExpectedPayout)}</Text>
              </View>
              {/* Progress bar */}
              <View style={{ height: 10, backgroundColor: COLORS.surface.warm, borderRadius: 999, overflow: "hidden" }}>
                <LinearGradient
                  colors={GRADIENTS.successGreen}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{ width: `${progressPercent}%`, height: "100%", borderRadius: 9999 }}
                />
              </View>
              <Text style={{ color: COLORS.text.secondary, fontSize: 10, marginTop: 6, textAlign: "right" }}>
                {progressPercent.toFixed(1)}% of expected total ({F(totalExpectedPayout)})
              </Text>
            </View>
          </Card>
        </View>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* Pay Contribution (Razorpay) — disabled for winner of resolved month */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {(() => {
        // Show winner message for resolved month where user won
        if (isWinnerOfCurrentMonth) {
          return (
            <View style={{ paddingHorizontal: SPACING[5], marginBottom: SPACING[5] }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <View style={{ width: 4, height: 20, borderRadius: 999, backgroundColor: COLORS.success.dark }} />
                <Text style={{ color: COLORS.text.primary, fontSize: 14, fontWeight: "700" }}>Payment Status</Text>
              </View>
              <Card accent="success" style={SHADOWS.cardSm}>
                <View style={{ backgroundColor: "rgba(22,163,74,0.08)", borderRadius: BORDER_RADIUS.xl, padding: 16 }}>
                  <View className="flex-row items-center mb-2">
                    <Ionicons name="checkmark-circle" size={20} color={COLORS.success.light} />
                    <Text style={{ color: COLORS.success.dark, fontWeight: "700", fontSize: 13, marginLeft: 8 }}>Winner — No Payment Needed</Text>
                  </View>
                  <Text style={{ color: COLORS.text.muted, fontSize: 11, lineHeight: 18 }}>
                    You are the winner of Month #{currentMonth.monthNumber}. Your contribution of {F(installment)} has been netted from your payout. No physical payment is required.
                  </Text>
                </View>
              </Card>
            </View>
          );
        }

        // For months 2+, only show Pay Contribution after month is resolved
        const isMonth1 = currentMonth?.monthNumber === 1 || currentMonth?.resolutionType === "organiser_commission";
        if (!isMonth1 && latestMonthStatus !== "completed") return null;

        // Find latest pending contribution for current member
        const myPendingInst = installments
          .filter((i: any) => i.userId === currentUser?.id && (i.status === "PENDING" || i.status === "OVERDUE" || i.status === "PARTIAL"))
          .sort((a: any, b: any) => a.cycleNo - b.cycleNo)[0];

        if (!myPendingInst || !myMemberId || !currentMonth) return null;

        // Don't show Pay Contribution for organiser during organiser_commission month (Month 1)
        const isOrganiser = committee.organizerId === currentUser?.id;
        const isOrganiserCommissionMonth = currentMonth.resolutionType === "organiser_commission";
        if (isOrganiser && isOrganiserCommissionMonth) return null;

        const totalDue = (myPendingInst.amountDuePaise || 0) + (myPendingInst.penaltyPaise || 0);
        if (totalDue <= 0) return null;

        return (
          <View style={{ paddingHorizontal: SPACING[5], marginBottom: SPACING[5] }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <View style={{ width: 4, height: 20, borderRadius: 999, backgroundColor: COLORS.gold[500] }} />
              <Text style={{ color: COLORS.text.primary, fontSize: 14, fontWeight: "700" }}>Pay Contribution</Text>
            </View>

            <Card accent="gold" style={SHADOWS.cardSm}>
              <PayNowButton
                committeeId={committeeId}
                monthId={currentMonth.id}
                memberId={myMemberId}
                committeeName={committee.name}
                monthNumber={currentMonth.monthNumber || months.length}
                amountPaise={totalDue}
                lateFeePaise={myPendingInst.penaltyPaise || 0}
                onPaymentSuccess={loadData}
              />
            </Card>
          </View>
        );
      })()}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* Quick Actions                                                     */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <View style={{ paddingHorizontal: SPACING[5], marginBottom: SPACING[5] }}>
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
        <View style={{ paddingHorizontal: SPACING[5], marginBottom: SPACING[5] }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={{ width: 4, height: 20, borderRadius: 999, backgroundColor: COLORS.danger.light }} />
              <Text style={{ color: COLORS.text.primary, fontSize: 14, fontWeight: "700" }}>Pending Dues</Text>
            </View>
            <Badge label={`${myPendingCount} pending`} variant="danger" size="sm" dot />
          </View>

          <Card padding={0} accent="danger" style={SHADOWS.cardSm}>
            {installments
              .filter((i: any) => {
                if (i.userId !== currentUser?.id) return false;
                if (i.status !== "PENDING" && i.status !== "OVERDUE" && i.status !== "PARTIAL") return false;
                // Exclude organiser's cycle 1 during organiser_commission month
                if (isOrganiser && i.cycleNo === 1 && currentResolutionType === "organiser_commission") return false;
                // Exclude any cycle where this member is the winner (netted from payout)
                if (myWonCycleNos.has(i.cycleNo)) return false;
                return true;
              })
              .slice(0, 5)
              .map((inst: any) => (
                <View key={inst.id} style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.surface.border }}>
                  <View style={{ width: 32, height: 32, borderRadius: 999, backgroundColor: "rgba(220,38,38,0.10)", alignItems: "center", justifyContent: "center", marginRight: 10 }}>
                    <Ionicons name="time-outline" size={14} color={COLORS.danger.light} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: COLORS.text.primary, fontSize: 11, fontWeight: "600" }}>Cycle #{inst.cycleNo}</Text>
                    <Text style={{ color: COLORS.text.secondary, fontSize: 10 }}>Due: {fmtDate(inst.dueDate)}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={{ color: COLORS.danger.dark, fontSize: 11, fontWeight: "700" }}>{F(inst.amountDuePaise)}</Text>
                    {inst.penaltyPaise > 0 && (
                      <Text style={{ color: COLORS.warning.dark, fontSize: 9 }}>+{F(inst.penaltyPaise)} late fee</Text>
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
