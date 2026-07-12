// src/app/(app)/committees/[id]/index.tsx
// Moved from committees/[id].tsx → committees/[id]/index.tsx
// so the [id]/ directory can hold nested manage/ screens without conflict.
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  ActivityIndicator,
  Share,
  Keyboard,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Clipboard from "expo-clipboard";

import { committeesApi } from "../../../../services/committees.api";
import { useAuthStore } from "../../../../stores/auth.store";
import BrandedLoader from "../../../../components/brand/BrandedLoader";
import { useCommitteeStore } from "../../../../stores/committee.store";
import { formatINR } from "../../../../utils/currency";
import { COLORS, BORDER_RADIUS, SPACING, SHADOWS } from "../../../../constants/theme";
import Card from "../../../../components/ui/Card";
import Badge from "../../../../components/ui/Badge";
import Button from "../../../../components/ui/Button";
import KKMark, { KKMarkWatermark } from "../../../../components/brand/KKMark";
import { useAlertModal } from "../../../../components/ui/AlertModal";
import PaymentStatusDashboard from "../../../../components/committees/PaymentStatusDashboard";

export default function CommitteeDetail() {
  const rawId = useLocalSearchParams<{ id: string }>().id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const isValidId = id && id !== "undefined" && id !== "null";
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const currentUser = useAuthStore((s) => s.user);
  const { alert, confirm, AlertComponent } = useAlertModal();

  const [committee, setCommittee] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [bidAmount, setBidAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [joinRequests, setJoinRequests] = useState<any[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<any[] | null>(null);
  const [monthsData, setMonthsData] = useState<any[] | null>(null);
  const [showAdjustSize, setShowAdjustSize] = useState(false);
  const [adjustSizeValue, setAdjustSizeValue] = useState("");
  const [isAdjusting, setIsAdjusting] = useState(false);

  const confirmAction = async (title: string, message: string, confirmLabel = "Confirm") => {
    return confirm(title, message, { confirmLabel });
  };

  const markRequestProcessed = (requestId: string, status: "APPROVED" | "REJECTED") => {
    setJoinRequests((prev) =>
      prev.map((request) => (
        request.id === requestId
          ? { ...request, status, reviewedAt: new Date().toISOString() }
          : request
      ))
    );
  };

  const loadCommittee = useCallback(async () => {
    try {
      const res = await committeesApi.getById(id);
      setCommittee(res.data.data);
    } catch (err) {
      console.error("[CommitteeDetail] Failed to load:", err);
      alert("Error", "Failed to load chit committee details");
      router.back();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  const loadJoinRequests = useCallback(async () => {
    try {
      const res = await committeesApi.getJoinRequests(id);
      setJoinRequests(res.data.data);
    } catch (err) {
      console.error("[CommitteeDetail] Failed to load join requests:", err);
    }
  }, [id]);

  const loadSchedule = useCallback(async (committeeData?: any) => {
    if (!id) return;
    const status = committeeData?.status;
    if (status === "DRAFT") return;
    try {
      const res = await committeesApi.getSchedule(id);
      setSchedule(res.data.data.cycles);
    } catch (err) {
      console.error("[CommitteeDetail] Failed to load schedule:", err);
    }
  }, [id]);

  const loadMonths = useCallback(async () => {
    try {
      const res = await committeesApi.getMonths(id);
      const data = res.data.data;
      setMonthsData(data.months || []);
    } catch (err) {
      console.error("[CommitteeDetail] Failed to load months:", err);
    }
  }, [id]);

  const syncCommitteeData = useCallback(async () => {
    await Promise.all([loadCommittee(), loadJoinRequests()]);
  }, [loadCommittee, loadJoinRequests]);

  useEffect(() => {
    if (isValidId) {
      loadCommittee();
    }
  }, [id, isValidId, loadCommittee]);

  // Socket-triggered instant refresh (committee status, bids, join requests)
  const biddingVersion = useCommitteeStore((s) => s.biddingOpenedVersion);
  const resolvedVersion = useCommitteeStore((s) => s.monthResolvedVersion);
  const bidVersion = useCommitteeStore((s) => s.bidPlacedVersion);
  const contributionVersion = useCommitteeStore((s) => s.contributionUpdatedVersion);
  const joinRequestVersion = useCommitteeStore((s) => s.joinRequestVersion);
  const socketVersionSum = biddingVersion + resolvedVersion + bidVersion + contributionVersion + joinRequestVersion;
  const lastSocketVersion = useRef(0);
  const pendingCommitteeRefresh = useRef(false);
  const isTypingInput = bidAmount.length > 0 || adjustSizeValue.length > 0;
  useEffect(() => {
    if (socketVersionSum > 0 && socketVersionSum !== lastSocketVersion.current) {
      lastSocketVersion.current = socketVersionSum;
      if (isTypingInput) {
        pendingCommitteeRefresh.current = true;
      } else {
        syncCommitteeData();
      }
    }
  }, [socketVersionSum, syncCommitteeData, isTypingInput]);

  // Flush pending refresh when user clears inputs
  useEffect(() => {
    if (!isTypingInput && pendingCommitteeRefresh.current) {
      pendingCommitteeRefresh.current = false;
      syncCommitteeData();
    }
  }, [isTypingInput, syncCommitteeData]);

  useEffect(() => {
    if (id && committee?.organizerId === currentUser?.id && committee?.status === "DRAFT") {
      loadJoinRequests();
    }
  }, [id, committee?.organizerId, committee?.status, loadJoinRequests, currentUser?.id]);

  useEffect(() => {
    if (committee && committee.status !== "DRAFT") {
      loadSchedule(committee);
      loadMonths();
    }
  }, [committee, loadSchedule, loadMonths]);

  if (!isValidId) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.surface.bg, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 }}>
        <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.surface.card, alignItems: "center", justifyContent: "center", marginBottom: 20, borderWidth: 1, borderColor: COLORS.surface.border }}>
          <Ionicons name="alert-circle-outline" size={36} color={COLORS.text.muted} />
        </View>
        <Text style={{ color: COLORS.text.primary, fontSize: 18, fontWeight: "700", textAlign: "center", marginBottom: 8 }}>
          Committee Not Found
        </Text>
        <Text style={{ color: COLORS.text.secondary, fontSize: 14, textAlign: "center", lineHeight: 20, marginBottom: 24 }}>
          The committee you're looking for doesn't exist or the link is invalid.
        </Text>
        <TouchableOpacity onPress={() => router.replace("/committees")} activeOpacity={0.8}
          style={{ backgroundColor: COLORS.brand[500], paddingHorizontal: 24, paddingVertical: 12, borderRadius: BORDER_RADIUS.xl }}
        >
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>Back to Chits</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleApproveRequest = async (requestId: string, userName: string) => {
    const confirmed = await confirmAction(
      "Approve Member",
      `Approve ${userName} to join this committee?`,
      "Approve"
    );
    if (!confirmed) return;

    try {
      setProcessingId(requestId);
      const res = await committeesApi.approveJoinRequest(id, requestId);
      if (res.data.success) {
        markRequestProcessed(requestId, "APPROVED");
        alert("Approved", `${userName} has been added to the committee.`);
        await syncCommitteeData();
      }
    } catch (err) {
      console.error("[CommitteeDetail] Approve failed:", err);
      const message = err instanceof Error ? err.message : "Failed to approve member";
      await syncCommitteeData();
      alert("Error", message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectRequest = async (requestId: string, userName: string) => {
    const confirmed = await confirmAction(
      "Reject Member",
      `Reject ${userName}'s request to join?`,
      "Reject"
    );
    if (!confirmed) return;

    try {
      setProcessingId(requestId);
      const res = await committeesApi.rejectJoinRequest(id, requestId);
      if (res.data.success) {
        markRequestProcessed(requestId, "REJECTED");
        alert("Rejected", `${userName}'s request has been rejected.`);
        await syncCommitteeData();
      }
    } catch (err) {
      console.error("[CommitteeDetail] Reject failed:", err);
      const message = err instanceof Error ? err.message : "Failed to reject member";
      await syncCommitteeData();
      alert("Error", message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleStartCommittee = async () => {
    const confirmed = await confirmAction(
      "Start Chit Committee",
      "Are you sure you want to start this chit? This will generate the installment schedule and activate the first cycle. You cannot add more members after starting.",
      "Start Now"
    );
    if (!confirmed) return;

    try {
      setLoading(true);
      await committeesApi.start(id);
      alert("Success", "Committee has been started successfully!");
      await loadCommittee();
    } catch (err) {
      alert("Error", err instanceof Error ? err.message : "Failed to start committee");
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    Promise.all([loadCommittee(), loadJoinRequests()]).finally(() => setRefreshing(false));
  };

  const handlePlaceBid = async () => {
    if (!bidAmount || isNaN(Number(bidAmount))) {
      alert("Invalid Input", "Please enter a valid numeric payout amount.");
      return;
    }

    const payoutRupees = Number(bidAmount);
    const amountPaise = Math.round(payoutRupees * 100);

    try {
      setIsSubmitting(true);
      await committeesApi.submitBid(id, amountPaise);
      alert("Success", `Your bid of ${formatINR(amountPaise)} has been submitted!`);
      setBidAmount("");
      loadCommittee();
    } catch (err) {
      alert("Bid Failed", err instanceof Error ? err.message : "Failed to place bid");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResolveMonth = async () => {
    if (!monthsData || monthsData.length === 0) {
      await confirmAction("No Months", "No months have been created yet. Create a month first.", "OK");
      return;
    }

    const currentMonth = monthsData.find((m: any) => m.status !== "completed");
    if (!currentMonth) {
      await confirmAction("All Resolved", "All months have already been resolved.", "OK");
      return;
    }

    const confirmed = await confirmAction(
      "Confirm Resolution",
      `Are you sure you want to resolve Month #${currentMonth.monthNumber}? If no bids are submitted, a random winner will be selected.`,
      "Resolve"
    );
    if (!confirmed) return;

    try {
      setLoading(true);
      const res = await committeesApi.resolveMonth(id, currentMonth.id);
      const result = res.data.data;
      const winner = committee.members.find((m: any) => m.userId === result.winnerMemberId)?.user?.name || "Member";
      const summary = result.summary;

      let message = `Winner: ${winner}\n`;
      if (summary?.winnerNetReceivable) {
        message += `Winner receives: ₹${(summary.winnerNetReceivable).toFixed(0)}\n`;
      }
      if (summary?.nonWinnerNetPayable) {
        message += `Non-winners pay: ₹${(summary.nonWinnerNetPayable).toFixed(0)} each\n`;
      }
      if (summary?.paymentDeadline) {
        message += `Payment deadline: ${new Date(summary.paymentDeadline).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`;
      }

      await confirmAction(
        "Month Resolved",
        message || `Month #${currentMonth.monthNumber} has been resolved.`,
        "OK"
      );
      loadCommittee();
    } catch (err) {
      await confirmAction("Resolution Failed", err instanceof Error ? err.message : "Failed to resolve month", "OK");
    } finally {
      setLoading(false);
    }
  };

  const handleShareInviteCode = async () => {
    try {
      await Share.share({
        message: `Join my chit committee "${committee.name}" using this invite code:\n\n${committee.inviteCode}\n\nOpen Monio app → Enter this code to request membership.`,
      });
    } catch {}
  };

  const handleCopyInviteCode = async () => {
    if (committee.inviteCode) {
      await Clipboard.setStringAsync(committee.inviteCode);
      alert("Copied!", `Invite code copied to clipboard:\n\n${committee.inviteCode}`);
    }
  };

  const handleAdjustSize = async () => {
    const newSize = Number(adjustSizeValue);
    if (!newSize || newSize < 2) {
      alert("Invalid Input", "Committee must have at least 2 members.");
      return;
    }
    if (newSize > committee.totalSlots) {
      alert("Invalid Input", `Cannot increase size beyond original ${committee.totalSlots} slots.`);
      return;
    }
    if (newSize < committee.filledSlots) {
      alert("Invalid Input", `Cannot reduce below ${committee.filledSlots} — that many members already joined.`);
      return;
    }
    if (newSize === committee.totalSlots) {
      alert("No Change", "New size is the same as current size.");
      return;
    }

    const confirmed = await confirmAction(
      "Adjust Committee Size",
      `Change total slots from ${committee.totalSlots} to ${newSize}?\n\n` +
      `${committee.filledSlots} members have already joined. ` +
      (newSize === committee.filledSlots
        ? "This will fill all slots and unlock the committee."
        : `${newSize - committee.filledSlots} more slot(s) will need to be filled.`),
      "Adjust"
    );
    if (!confirmed) return;

    try {
      setIsAdjusting(true);
      const res = await committeesApi.adjustCommitteeSize(id, newSize);
      if (res.data.success) {
        alert(
          "Size Adjusted",
          res.data.data.isNowFull
            ? "All slots are now filled! You can start the committee."
            : `Committee size updated to ${newSize} members.`
        );
        setAdjustSizeValue("");
        setShowAdjustSize(false);
        await loadCommittee();
      }
    } catch (err) {
      alert("Error", err instanceof Error ? err.message : "Failed to adjust size");
    } finally {
      setIsAdjusting(false);
    }
  };

  if (loading && !refreshing) {
    return <BrandedLoader />;
  }

  if (!committee) return null;

  const totalPot = Number(committee.installmentAmountPaise) * committee.totalSlots;
  const isOrganizer = committee.organizerId === currentUser?.id;

  // Find current user's membership
  const myMembership = committee.members?.find((m: any) => m.userId === currentUser?.id);
  const userHasWon = myMembership?.hasReceivedPayout;

  // Active bids (sorted ascending, lowest bid first)
  const activeBids = (committee.bids || [])
    .filter((b: any) => b.cycleNo === committee.currentCycleNo)
    .sort((a: any, b: any) => Number(a.bidAmountPaise) - Number(b.bidAmountPaise));

  const leadingBid = activeBids[0];

  // Calculate bidding limits
  const maxDiscRate = Number(committee.maxDiscountPct || 30);
  const maxDiscountPaise = (totalPot * maxDiscRate) / 100;
  const minPayoutAllowed = totalPot - maxDiscountPaise;
  const maxPayoutAllowed = totalPot;
  const pendingJoinRequests = joinRequests.filter((request) => request.status === "PENDING");

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: COLORS.surface.bg }}
      contentContainerStyle={{ paddingBottom: 120 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.brandPrimary} />
      }
    >
      {/* ── Hero ── */}
      <LinearGradient
        colors={["#1e1b4b", "#312e81", "#3730a3"]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{
          paddingTop: insets.top + SPACING[4],
          paddingHorizontal: SPACING[5],
          paddingBottom: SPACING[12],
          borderBottomLeftRadius: BORDER_RADIUS["4xl"],
          borderBottomRightRadius: BORDER_RADIUS["4xl"],
          position: "relative", overflow: "hidden",
        }}
      >
        <KKMarkWatermark size={180} color={COLORS.white} opacity={0.05} />

        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <TouchableOpacity onPress={() => router.back()}
            style={{ width: 38, height: 38, borderRadius: BORDER_RADIUS.lg, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" }}
          >
            <Ionicons name="arrow-back" size={20} color={COLORS.white} />
          </TouchableOpacity>
          <Badge label={committee.status} variant={committee.status === "ACTIVE" ? "success" : committee.status === "DRAFT" ? "brand" : "neutral"} />
        </View>

        <View style={{ marginBottom: 20 }}>
          <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
            {isOrganizer ? "Your Committee" : "Auction Chit"}
          </Text>
          <Text style={{ color: COLORS.white, fontSize: 22, fontWeight: "700" }}>{committee.name}</Text>
          {committee.description ? (
            <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, marginTop: 4 }}>{committee.description}</Text>
          ) : null}
        </View>

        <View style={{ borderRadius: BORDER_RADIUS["2xl"], padding: 16, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 12 }}>
            <View>
              <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 }}>Total Pot</Text>
              <Text style={{ color: COLORS.gold[300], fontSize: 18, fontWeight: "700", marginTop: 2 }}>{formatINR(totalPot)}</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 }}>Installment</Text>
              <Text style={{ color: COLORS.white, fontSize: 18, fontWeight: "700", marginTop: 2 }}>{formatINR(committee.installmentAmountPaise)}</Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 12 }}>
            <View>
              <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 }}>Cycle</Text>
              <Text style={{ color: COLORS.white, fontSize: 13, fontWeight: "600", marginTop: 2 }}>{committee.cycleDurationDays} days</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 }}>Current Cycle</Text>
              <Text style={{ color: COLORS.white, fontSize: 13, fontWeight: "600", marginTop: 2 }}>#{committee.currentCycleNo} / {committee.totalSlots}</Text>
            </View>
          </View>
          <View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
              <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 }}>Slots Filled</Text>
              <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: "600" }}>{committee.filledSlots} / {committee.totalSlots}</Text>
            </View>
            <View style={{ height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.15)", overflow: "hidden" }}>
              <View style={{ width: `${(committee.filledSlots / committee.totalSlots) * 100}%`, height: "100%", borderRadius: 2, backgroundColor: COLORS.gold[400] }} />
            </View>
          </View>
        </View>
      </LinearGradient>

      {/* ── Content ── */}
      <View style={{ paddingHorizontal: SPACING[5], marginTop: SPACING[3] }}>

        {/* Quick Actions */}
        <View style={{ marginBottom: 24 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <View style={{ width: 4, height: 20, borderRadius: 2, backgroundColor: COLORS.brand[400] }} />
            <Text style={{ color: COLORS.text.primary, fontSize: 15, fontWeight: "700" }}>Quick Actions</Text>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {isOrganizer && (
              <TouchableOpacity onPress={() => router.push(`/committees/${id}/manage`)} activeOpacity={0.7}
                style={{ flexDirection: "row", alignItems: "center", borderRadius: BORDER_RADIUS.xl, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: "rgba(99,102,241,0.08)", borderWidth: 1, borderColor: "rgba(99,102,241,0.2)", gap: 6 }}
              >
                <Ionicons name="settings-outline" size={16} color={COLORS.brand[500]} />
                <Text style={{ color: COLORS.brand[700], fontSize: 12, fontWeight: "700" }}>Manage</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => router.push(`/committees/${id}/audit`)} activeOpacity={0.7}
              style={{ flexDirection: "row", alignItems: "center", borderRadius: BORDER_RADIUS.xl, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: "rgba(34,197,94,0.08)", borderWidth: 1, borderColor: "rgba(34,197,94,0.2)", gap: 6 }}
            >
              <Ionicons name="document-text-outline" size={16} color={COLORS.success.DEFAULT} />
              <Text style={{ color: COLORS.success.dark, fontSize: 12, fontWeight: "700" }}>Audit Log</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push(`/member/committee/${id}` as any)} activeOpacity={0.7}
              style={{ flexDirection: "row", alignItems: "center", borderRadius: BORDER_RADIUS.xl, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: "rgba(99,102,241,0.08)", borderWidth: 1, borderColor: "rgba(99,102,241,0.2)", gap: 6 }}
            >
              <Ionicons name="person-circle-outline" size={16} color={COLORS.brand[500]} />
              <Text style={{ color: COLORS.brand[700], fontSize: 12, fontWeight: "700" }}>My Dashboard</Text>
            </TouchableOpacity>
            {!isOrganizer && (() => {
              const latestMonth = monthsData && monthsData.length > 0 ? monthsData[monthsData.length - 1] : null;
              const isBiddingOpen = latestMonth?.status === "bidding_open";
              const canMemberBid = isBiddingOpen && !userHasWon;
              return canMemberBid ? (
                <TouchableOpacity onPress={() => router.push(`/member/committee/${id}/bid` as any)} activeOpacity={0.7}
                  style={{ flexDirection: "row", alignItems: "center", borderRadius: BORDER_RADIUS.xl, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: "rgba(245,158,11,0.1)", borderWidth: 1, borderColor: "rgba(245,158,11,0.2)", gap: 6 }}
                >
                  <Ionicons name="hammer-outline" size={16} color={COLORS.gold[500]} />
                  <Text style={{ color: COLORS.gold[700], fontSize: 12, fontWeight: "700" }}>Place Bid</Text>
                </TouchableOpacity>
              ) : null;
            })()}
          </View>
        </View>

        {/* Draft: Waiting / Invite / Start */}
        {committee.status === "DRAFT" && isOrganizer && (
          <View style={{ marginBottom: 24 }}>
            {committee.filledSlots < committee.totalSlots ? (
              <>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <View style={{ width: 4, height: 20, borderRadius: 2, backgroundColor: COLORS.warning.dark }} />
                  <Text style={{ color: COLORS.text.primary, fontSize: 15, fontWeight: "700" }}>Waiting for Members</Text>
                </View>
                <Card accent="warning" padding={20}>
                  <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
                    <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(245,158,11,0.1)", alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                      <Ionicons name="time-outline" size={20} color={COLORS.warning.dark} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: COLORS.text.primary, fontSize: 14, fontWeight: "700" }}>{committee.totalSlots - committee.filledSlots} more slot(s) to fill</Text>
                      <Text style={{ color: COLORS.text.secondary, fontSize: 11, marginTop: 2 }}>Share the invite code below to add members</Text>
                    </View>
                  </View>
                  <View style={{ height: 6, borderRadius: 3, backgroundColor: COLORS.surface.warm, overflow: "hidden", marginBottom: 12 }}>
                    <View style={{ width: `${(committee.filledSlots / committee.totalSlots) * 100}%`, height: "100%", borderRadius: 3, backgroundColor: COLORS.gold[400] }} />
                  </View>

                  {committee.inviteCode && (
                    <View style={{ backgroundColor: "rgba(245,158,11,0.06)", borderRadius: BORDER_RADIUS.xl, padding: 14, borderWidth: 1, borderColor: "rgba(245,158,11,0.15)", marginBottom: 12 }}>
                      <Text style={{ color: COLORS.text.muted, fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Invite Code</Text>
                      <Text style={{ color: COLORS.gold[600], fontSize: 20, fontWeight: "700", letterSpacing: 2, marginBottom: 10 }}>{committee.inviteCode}</Text>
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        <TouchableOpacity onPress={handleCopyInviteCode} style={{ flex: 1, height: 38, borderRadius: BORDER_RADIUS.lg, backgroundColor: "rgba(99,102,241,0.08)", borderWidth: 1, borderColor: "rgba(99,102,241,0.2)", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}>
                          <Ionicons name="copy-outline" size={14} color={COLORS.brand[500]} />
                          <Text style={{ color: COLORS.brand[700], fontSize: 12, fontWeight: "700" }}>Copy</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={handleShareInviteCode} style={{ flex: 1, height: 38, borderRadius: BORDER_RADIUS.lg, backgroundColor: "rgba(245,158,11,0.08)", borderWidth: 1, borderColor: "rgba(245,158,11,0.2)", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}>
                          <Ionicons name="share-outline" size={14} color={COLORS.gold[500]} />
                          <Text style={{ color: COLORS.gold[700], fontSize: 12, fontWeight: "700" }}>Share</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  {!showAdjustSize ? (
                    <TouchableOpacity onPress={() => { setAdjustSizeValue(String(committee.filledSlots)); setShowAdjustSize(true); }}
                      style={{ height: 40, borderRadius: BORDER_RADIUS.lg, backgroundColor: "rgba(99,102,241,0.08)", borderWidth: 1, borderColor: "rgba(99,102,241,0.2)", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}
                    >
                      <Ionicons name="resize-outline" size={14} color={COLORS.brand[500]} />
                      <Text style={{ color: COLORS.brand[700], fontSize: 12, fontWeight: "700" }}>Adjust Committee Size</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={{ backgroundColor: COLORS.surface.warm, borderRadius: BORDER_RADIUS.xl, padding: 14, borderWidth: 1, borderColor: COLORS.surface.border }}>
                      <Text style={{ color: COLORS.text.secondary, fontSize: 11, fontWeight: "600", marginBottom: 8 }}>New Total Slots (min: {committee.filledSlots})</Text>
                      <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
                        <View style={{ flex: 1, backgroundColor: COLORS.surface.card, borderWidth: 1, borderColor: COLORS.surface.border, borderRadius: BORDER_RADIUS.xl, paddingHorizontal: 14, height: 44, justifyContent: "center" }}>
                          <TextInput value={adjustSizeValue} onChangeText={setAdjustSizeValue} keyboardType="numeric" returnKeyType="done" blurOnSubmit onSubmitEditing={() => Keyboard.dismiss()} placeholder={`${committee.filledSlots}`} placeholderTextColor={COLORS.text.muted} style={{ color: COLORS.text.primary, fontWeight: "600", fontSize: 14 }} />
                        </View>
                        <TouchableOpacity onPress={() => { Keyboard.dismiss(); setAdjustSizeValue(String(committee.filledSlots)); }} style={{ backgroundColor: COLORS.surface.card, borderWidth: 1, borderColor: COLORS.surface.border, height: 44, paddingHorizontal: 12, borderRadius: BORDER_RADIUS.xl, alignItems: "center", justifyContent: "center" }}>
                          <Text style={{ color: COLORS.text.secondary, fontWeight: "700", fontSize: 11 }}>Min</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => { Keyboard.dismiss(); setAdjustSizeValue(String(committee.totalSlots)); }} style={{ backgroundColor: COLORS.surface.card, borderWidth: 1, borderColor: COLORS.surface.border, height: 44, paddingHorizontal: 12, borderRadius: BORDER_RADIUS.xl, alignItems: "center", justifyContent: "center" }}>
                          <Text style={{ color: COLORS.text.secondary, fontWeight: "700", fontSize: 11 }}>Max</Text>
                        </TouchableOpacity>
                      </View>
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        <TouchableOpacity onPress={() => { Keyboard.dismiss(); setShowAdjustSize(false); }} style={{ flex: 1, height: 38, borderRadius: BORDER_RADIUS.lg, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: COLORS.surface.border }}>
                          <Text style={{ color: COLORS.text.secondary, fontWeight: "700", fontSize: 12 }}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => { Keyboard.dismiss(); setTimeout(() => handleAdjustSize(), 100); }} disabled={isAdjusting} activeOpacity={0.7} style={{ flex: 1, height: 38, borderRadius: BORDER_RADIUS.lg, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.brand[500], opacity: isAdjusting ? 0.6 : 1 }}>
                          {isAdjusting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "700", fontSize: 12 }}>Confirm</Text>}
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </Card>
              </>
            ) : (
              <Button label="Start Chit Committee" variant="primary" onPress={handleStartCommittee} icon={<Ionicons name="play-circle-outline" size={20} color="#fff" />} />
            )}
          </View>
        )}

        {/* Draft Member: Not Ready */}
        {!isOrganizer && committee.status === "DRAFT" && committee.filledSlots < committee.totalSlots && (
          <View style={{ marginBottom: 24 }}>
            <Card accent="warning" padding={20}>
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(245,158,11,0.1)", alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                  <Ionicons name="time-outline" size={20} color={COLORS.warning.dark} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: COLORS.text.primary, fontSize: 14, fontWeight: "700" }}>Committee Not Ready Yet</Text>
                  <Text style={{ color: COLORS.text.secondary, fontSize: 11, marginTop: 2 }}>Waiting for {committee.totalSlots - committee.filledSlots} more member(s)</Text>
                </View>
              </View>
              <Text style={{ color: COLORS.text.secondary, fontSize: 12, lineHeight: 18 }}>The organizer will start the committee once all slots are filled. You'll be notified when it's active.</Text>
            </Card>
          </View>
        )}

        {/* Join Requests */}
        {isOrganizer && committee.status === "DRAFT" && pendingJoinRequests.length > 0 && (
          <View style={{ marginBottom: 24 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <View style={{ width: 4, height: 20, borderRadius: 2, backgroundColor: COLORS.info.DEFAULT }} />
              <Text style={{ color: COLORS.text.primary, fontSize: 15, fontWeight: "700" }}>Join Requests ({pendingJoinRequests.length})</Text>
            </View>
            {pendingJoinRequests.map((request: any) => (
              <Card key={request.id} accent="info" style={{ marginBottom: 8 }} padding={14}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                    <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(14,165,233,0.1)", alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                      <Ionicons name="person-outline" size={18} color={COLORS.info.DEFAULT} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: COLORS.text.primary, fontSize: 13, fontWeight: "700" }}>{request.user?.name || "Unknown"}</Text>
                      <Text style={{ color: COLORS.text.muted, fontSize: 10, marginTop: 2 }}>{request.user?.phone} · {new Date(request.createdAt).toLocaleDateString()}</Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: "row", gap: 6 }}>
                    <TouchableOpacity onPress={() => handleApproveRequest(request.id, request.user?.name || "Member")} disabled={processingId === request.id}
                      style={{ width: 38, height: 38, borderRadius: BORDER_RADIUS.lg, backgroundColor: "rgba(34,197,94,0.15)", borderWidth: 1, borderColor: "rgba(34,197,94,0.2)", alignItems: "center", justifyContent: "center" }}
                    >
                      {processingId === request.id ? <ActivityIndicator size="small" color={COLORS.success.DEFAULT} /> : <Ionicons name="checkmark-outline" size={18} color={COLORS.success.DEFAULT} />}
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleRejectRequest(request.id, request.user?.name || "Member")} disabled={processingId === request.id}
                      style={{ width: 38, height: 38, borderRadius: BORDER_RADIUS.lg, backgroundColor: "rgba(239,68,68,0.15)", borderWidth: 1, borderColor: "rgba(239,68,68,0.2)", alignItems: "center", justifyContent: "center" }}
                    >
                      <Ionicons name="close-outline" size={18} color={COLORS.danger.DEFAULT} />
                    </TouchableOpacity>
                  </View>
                </View>
              </Card>
            ))}
          </View>
        )}

        {/* Months — Organizer Active */}
        {isOrganizer && committee.status === "ACTIVE" && (
          <View style={{ marginBottom: 24 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <View style={{ width: 4, height: 20, borderRadius: 2, backgroundColor: COLORS.brand[500] }} />
              <Text style={{ color: COLORS.text.primary, fontSize: 15, fontWeight: "700" }}>Committee Months</Text>
            </View>
            {monthsData && monthsData.length > 0 ? (
              <Card accent="brand" padding={0}>
                <View style={{ padding: 16 }}>
                  <View style={{ flexDirection: "row", borderBottomWidth: 1, borderBottomColor: COLORS.surface.border, paddingBottom: 8, marginBottom: 8 }}>
                    <Text style={{ width: 50, color: COLORS.text.muted, fontWeight: "700", fontSize: 11 }}>Month</Text>
                    <Text style={{ flex: 1, color: COLORS.text.muted, fontWeight: "700", fontSize: 11 }}>Date</Text>
                    <Text style={{ width: 80, textAlign: "right", color: COLORS.text.muted, fontWeight: "700", fontSize: 11 }}>Pool</Text>
                    <Text style={{ width: 80, textAlign: "right", color: COLORS.text.muted, fontWeight: "700", fontSize: 11 }}>Status</Text>
                  </View>
                  {monthsData.map((m: any) => (
                    <TouchableOpacity key={m.id} onPress={() => router.push(`/committees/${id}/manage/month/${m.id}`)}
                      style={{ flexDirection: "row", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.surface.border, alignItems: "center" }}
                    >
                      <Text style={{ width: 50, color: COLORS.text.primary, fontWeight: "700", fontSize: 13 }}>#{m.monthNumber}</Text>
                      <Text style={{ flex: 1, color: COLORS.text.secondary, fontWeight: "600", fontSize: 12 }}>{new Date(m.monthDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</Text>
                      <Text style={{ width: 80, textAlign: "right", color: COLORS.gold[600], fontWeight: "700", fontSize: 12 }}>{formatINR(Number(m.totalPool))}</Text>
                      <View style={{ width: 80, alignItems: "flex-end" }}>
                        <Badge label={m.status === "bidding_open" ? "BIDDING" : m.status.toUpperCase()} variant={m.status === "completed" ? "success" : m.status === "bidding_open" ? "brand" : "neutral"} size="sm" />
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </Card>
            ) : (
              <View style={{ alignItems: "center", paddingVertical: 24, backgroundColor: COLORS.surface.card, borderRadius: BORDER_RADIUS["2xl"], borderWidth: 1, borderColor: COLORS.surface.border, borderStyle: "dashed" }}>
                <Ionicons name="calendar-outline" size={28} color={COLORS.text.muted} />
                <Text style={{ color: COLORS.text.secondary, fontSize: 12, marginTop: 8 }}>No months created yet</Text>
                <Text style={{ color: COLORS.text.muted, fontSize: 10, marginTop: 2 }}>Create the first month to start bidding.</Text>
              </View>
            )}
          </View>
        )}

        {/* Auction Panel */}
        {committee.status === "ACTIVE" && (() => {
          const latestMonth = monthsData && monthsData.length > 0 ? monthsData[monthsData.length - 1] : null;
          const isMonthBiddingOpen = latestMonth?.status === "bidding_open";
          return (
            <View style={{ marginBottom: 24 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <View style={{ width: 4, height: 20, borderRadius: 2, backgroundColor: COLORS.gold[500] }} />
                <Text style={{ color: COLORS.text.primary, fontSize: 15, fontWeight: "700" }}>Live Auction</Text>
              </View>
              <Card accent="gold" padding={0}>
                <View style={{ padding: 16 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <Text style={{ color: COLORS.text.secondary, fontWeight: "600", fontSize: 12 }}>Leading Lowest Payout</Text>
                    <Text style={{ color: COLORS.text.primary, fontWeight: "700", fontSize: 15 }}>{leadingBid ? formatINR(leadingBid.bidAmountPaise) : "No bids yet"}</Text>
                  </View>
                  <View style={{ backgroundColor: COLORS.surface.warm, borderRadius: BORDER_RADIUS.xl, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: COLORS.surface.border }}>
                    <Text style={{ color: COLORS.text.secondary, fontSize: 10, fontWeight: "700", marginBottom: 4 }}>BIDDING RULES</Text>
                    <Text style={{ color: COLORS.text.muted, fontSize: 11 }}>Min: {formatINR(minPayoutAllowed)} · Max: {formatINR(maxPayoutAllowed)}</Text>
                  </View>

                  {!isOrganizer && isMonthBiddingOpen && myMembership && !userHasWon ? (
                    <View>
                      <View style={{ backgroundColor: "rgba(245,158,11,0.08)", borderRadius: BORDER_RADIUS.xl, padding: 12, borderWidth: 1, borderColor: "rgba(245,158,11,0.15)", marginBottom: 12 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
                          <Ionicons name="hammer-outline" size={14} color={COLORS.gold[500]} />
                          <Text style={{ color: COLORS.gold[700], fontWeight: "700", fontSize: 13 }}>Bidding is Open!</Text>
                        </View>
                        <Text style={{ color: COLORS.text.secondary, fontSize: 11 }}>Place your bid in the reverse auction. Lowest bidder wins the full pool.</Text>
                      </View>
                      <Button label="Place Your Bid Now" variant="gold" onPress={() => router.push(`/member/committee/${id}/bid` as any)} icon={<Ionicons name="hammer-outline" size={18} color={COLORS.black} />} />
                    </View>
                  ) : myMembership && !userHasWon ? (
                    <View>
                      <Text style={{ color: COLORS.text.muted, fontSize: 10, fontWeight: "700", textTransform: "uppercase", marginBottom: 6 }}>Place Your Bid (Payout Request)</Text>
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        <View style={{ flex: 1, backgroundColor: COLORS.surface.warm, borderWidth: 1, borderColor: COLORS.surface.border, borderRadius: BORDER_RADIUS.xl, paddingHorizontal: 14, height: 44, justifyContent: "center" }}>
                          <TextInput value={bidAmount} onChangeText={setBidAmount} keyboardType="numeric" placeholder={`e.g. ${maxPayoutAllowed / 100 - 500}`} placeholderTextColor={COLORS.text.muted} style={{ color: COLORS.text.primary, fontWeight: "600", fontSize: 14 }} />
                        </View>
                        <TouchableOpacity onPress={handlePlaceBid} disabled={isSubmitting} style={{ paddingHorizontal: 20, borderRadius: BORDER_RADIUS.xl, backgroundColor: COLORS.brand[500], alignItems: "center", justifyContent: "center" }}>
                          {isSubmitting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>Bid</Text>}
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <View style={{ backgroundColor: "rgba(239,68,68,0.06)", borderRadius: BORDER_RADIUS.xl, padding: 12, borderWidth: 1, borderColor: "rgba(239,68,68,0.12)" }}>
                      <Text style={{ color: COLORS.danger.dark, fontSize: 11, fontWeight: "600", textAlign: "center" }}>
                        {userHasWon ? "You have already received a payout, so you are ineligible to bid." : "Only chit members can place bids."}
                      </Text>
                    </View>
                  )}

                  {isOrganizer && monthsData && monthsData.some((m: any) => m.status !== "completed") && (
                    <TouchableOpacity onPress={handleResolveMonth} disabled={loading}
                      style={{ marginTop: 12, height: 44, borderRadius: BORDER_RADIUS.xl, backgroundColor: loading ? "rgba(245,158,11,0.5)" : COLORS.gold[500], flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}
                    >
                      {loading ? <ActivityIndicator size="small" color={COLORS.black} /> : <Ionicons name="flash-outline" size={16} color={COLORS.black} />}
                      <Text style={{ color: COLORS.black, fontWeight: "700", fontSize: 13 }}>{loading ? "Resolving..." : "Resolve & Distribute Payout"}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </Card>

              <Text style={{ color: COLORS.text.primary, fontWeight: "700", fontSize: 14, marginBottom: 8, marginTop: 8 }}>Active Bids (Cycle #{committee.currentCycleNo})</Text>
              {activeBids.map((bid: any, idx: number) => (
                <TouchableOpacity key={bid.id} activeOpacity={0.7}
                  style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: COLORS.surface.card, borderRadius: BORDER_RADIUS["2xl"], padding: 14, marginBottom: 8, borderWidth: 1, borderColor: COLORS.surface.border, ...SHADOWS.cardSm }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: "rgba(99,102,241,0.08)", borderWidth: 1, borderColor: "rgba(99,102,241,0.15)", alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                      <Text style={{ color: COLORS.brand[700], fontWeight: "700", fontSize: 11 }}>#{idx + 1}</Text>
                    </View>
                    <View>
                      <Text style={{ color: COLORS.text.primary, fontWeight: "700", fontSize: 13 }}>{bid.user?.name || "Anonymous"}</Text>
                      <Text style={{ color: COLORS.text.muted, fontSize: 10 }}>Requested payout</Text>
                    </View>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={{ color: COLORS.text.primary, fontWeight: "700", fontSize: 13 }}>{formatINR(bid.bidAmountPaise)}</Text>
                    <Text style={{ color: COLORS.text.muted, fontSize: 10 }}>Discount: {formatINR(totalPot - Number(bid.bidAmountPaise))}</Text>
                  </View>
                </TouchableOpacity>
              ))}
              {activeBids.length === 0 && (
                <View style={{ alignItems: "center", paddingVertical: 20, backgroundColor: COLORS.surface.card, borderRadius: BORDER_RADIUS["2xl"], borderWidth: 1, borderColor: COLORS.surface.border, borderStyle: "dashed" }}>
                  <Text style={{ color: COLORS.text.muted, fontSize: 12 }}>No bids placed yet for this cycle</Text>
                </View>
              )}
            </View>
          );
        })()}

        {/* Payout History */}
        {committee.status === "ACTIVE" && (
          <View style={{ marginBottom: 24 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <View style={{ width: 4, height: 20, borderRadius: 2, backgroundColor: COLORS.success.DEFAULT }} />
              <Text style={{ color: COLORS.text.primary, fontSize: 15, fontWeight: "700" }}>Payout History</Text>
            </View>
            <Card accent="success" padding={16}>
              {(committee.payoutCycles || []).length > 0 ? (
                <>
                  <View style={{ flexDirection: "row", borderBottomWidth: 1, borderBottomColor: COLORS.surface.border, paddingBottom: 8, marginBottom: 8 }}>
                    <Text style={{ width: 50, color: COLORS.text.muted, fontWeight: "700", fontSize: 11 }}>Cycle</Text>
                    <Text style={{ flex: 1, color: COLORS.text.muted, fontWeight: "700", fontSize: 11 }}>Winner</Text>
                    <Text style={{ width: 90, textAlign: "right", color: COLORS.text.muted, fontWeight: "700", fontSize: 11 }}>Payout</Text>
                  </View>
                  {(committee.payoutCycles || [])
                    .sort((a: any, b: any) => a.cycleNo - b.cycleNo)
                    .map((item: any) => {
                      const winnerName = committee.members?.find((m: any) => m.userId === item.winnerId)?.user?.name || "Winner";
                      return (
                        <View key={item.id} style={{ flexDirection: "row", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.surface.border, alignItems: "center" }}>
                          <Text style={{ width: 50, color: COLORS.text.primary, fontWeight: "700", fontSize: 13 }}>#{item.cycleNo}</Text>
                          <Text style={{ flex: 1, color: COLORS.text.secondary, fontWeight: "600", fontSize: 12 }}>{winnerName}</Text>
                          <Text style={{ width: 90, textAlign: "right", color: COLORS.gold[600], fontWeight: "700", fontSize: 12 }}>{formatINR(item.payoutAmtPaise)}</Text>
                        </View>
                      );
                    })}
                </>
              ) : (
                <Text style={{ color: COLORS.text.muted, fontSize: 12, textAlign: "center", paddingVertical: 12 }}>No payout cycles resolved yet</Text>
              )}
            </Card>
          </View>
        )}

        {/* Monthly Schedule */}
        {schedule && schedule.length > 0 && (
          <View style={{ marginBottom: 24 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <View style={{ width: 4, height: 20, borderRadius: 2, backgroundColor: COLORS.info.DEFAULT }} />
              <Text style={{ color: COLORS.text.primary, fontSize: 15, fontWeight: "700" }}>Payment Schedule</Text>
            </View>
            <Card accent="info" padding={16}>
              <View style={{ flexDirection: "row", borderBottomWidth: 1, borderBottomColor: COLORS.surface.border, paddingBottom: 8, marginBottom: 8 }}>
                <Text style={{ width: 50, color: COLORS.text.muted, fontWeight: "700", fontSize: 11 }}>Cycle</Text>
                <Text style={{ flex: 1, color: COLORS.text.muted, fontWeight: "700", fontSize: 11 }}>Due Date</Text>
                <Text style={{ width: 80, textAlign: "right", color: COLORS.text.muted, fontWeight: "700", fontSize: 11 }}>Amount</Text>
                <Text style={{ width: 80, textAlign: "right", color: COLORS.text.muted, fontWeight: "700", fontSize: 11 }}>Status</Text>
              </View>
              {schedule.map((item: any) => {
                const isCurrentCycle = item.cycleNo === committee.currentCycleNo;
                const allPaid = item.paid === item.total;
                const hasOverdue = item.overdue > 0;
                const displayStatus = item.userStatus || (allPaid ? "PAID" : hasOverdue ? "OVERDUE" : "PENDING");
                const isPaid = displayStatus === "PAID" || displayStatus === "COMPLETED";
                const isOverdue = displayStatus === "OVERDUE";
                return (
                  <View key={item.cycleNo} style={{ flexDirection: "row", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.surface.border, alignItems: "center", backgroundColor: isCurrentCycle ? "rgba(99,102,241,0.04)" : "transparent" }}>
                    <Text style={{ width: 50, color: isCurrentCycle ? COLORS.brand[700] : COLORS.text.primary, fontWeight: "700", fontSize: 13 }}>#{item.cycleNo}</Text>
                    <Text style={{ flex: 1, color: COLORS.text.secondary, fontWeight: "600", fontSize: 12 }}>
                      {new Date(item.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </Text>
                    <Text style={{ width: 80, textAlign: "right", color: COLORS.gold[600], fontWeight: "700", fontSize: 12 }}>{formatINR(item.amountDuePaise)}</Text>
                    <View style={{ width: 80, alignItems: "flex-end" }}>
                      {isPaid ? <Badge label="Paid" variant="success" size="sm" dot />
                        : isOverdue ? <Badge label="Overdue" variant="danger" size="sm" dot />
                        : <Badge label={`${item.paid}/${item.total}`} variant="warning" size="sm" />}
                    </View>
                  </View>
                );
              })}
            </Card>
          </View>
        )}

        {/* Payment Status Dashboard */}
        {committee.status === "ACTIVE" && (
          <PaymentStatusDashboard committeeId={id} />
        )}

        {/* Members */}
        <View style={{ marginBottom: 24 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <View style={{ width: 4, height: 20, borderRadius: 2, backgroundColor: COLORS.brand[500] }} />
            <Text style={{ color: COLORS.text.primary, fontSize: 15, fontWeight: "700" }}>Chit Members ({committee.members?.length || 0})</Text>
          </View>
          {committee.members?.map((member: any) => (
            <View key={member.id} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: COLORS.surface.card, borderRadius: BORDER_RADIUS["2xl"], padding: 14, marginBottom: 6, borderWidth: 1, borderColor: COLORS.surface.border, ...SHADOWS.cardSm }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(99,102,241,0.08)", borderWidth: 1, borderColor: "rgba(99,102,241,0.15)", alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                  <Text style={{ color: COLORS.brand[700], fontWeight: "700", fontSize: 11 }}>{member.slotNumber}</Text>
                </View>
                <View>
                  <Text style={{ color: COLORS.text.primary, fontWeight: "700", fontSize: 13 }}>{member.user?.name}{member.userId === currentUser?.id ? " (You)" : ""}</Text>
                  <Text style={{ color: COLORS.text.muted, fontSize: 10, marginTop: 1 }}>{member.user?.phone}</Text>
                </View>
              </View>
              <Badge label={member.hasReceivedPayout ? "Payout Received" : "Eligible to Bid"} variant={member.hasReceivedPayout ? "success" : "info"} size="sm" dot />
            </View>
          ))}
        </View>

      </View>
      <AlertComponent />
    </ScrollView>
  );
}
