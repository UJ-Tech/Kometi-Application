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
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";

import { committeesApi } from "../../../../services/committees.api";
import { useAuthStore } from "../../../../stores/auth.store";
import { useCommitteeStore } from "../../../../stores/committee.store";
import { canAccessAdminPanel } from "../../../../utils/rbac";
import { formatINR } from "../../../../utils/currency";
import { COLORS } from "../../../../constants/theme";
import Card from "../../../../components/ui/Card";
import Badge from "../../../../components/ui/Badge";
import Button from "../../../../components/ui/Button";
import { useAlertModal } from "../../../../components/ui/AlertModal";

export default function CommitteeDetail() {
  const rawId = useLocalSearchParams<{ id: string }>().id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const isValidId = id && id !== "undefined" && id !== "null";
  const router = useRouter();
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
  const socketVersionSum = biddingVersion + resolvedVersion + bidVersion + contributionVersion;
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
      <View className="flex-1 bg-surface-bg items-center justify-center px-6">
        <View className="w-20 h-20 rounded-full bg-surface-card items-center justify-center mb-5 border border-slate-100">
          <Ionicons name="alert-circle-outline" size={36} color="#64748b" />
        </View>
        <Text className="text-slate-900 font-bold text-lg text-center mb-2">
          Committee Not Found
        </Text>
        <Text className="text-slate-500 text-sm text-center mb-6 leading-5">
          {"The committee you're looking for doesn't exist or the link is invalid."}
        </Text>
        <TouchableOpacity
          onPress={() => router.replace("/committees")}
          className="bg-brand-500 px-6 py-3 rounded-xl"
          activeOpacity={0.8}
        >
          <Text className="text-white font-bold text-sm">Back to Chits</Text>
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
    loadCommittee();
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
        message: `Join my chit committee "${committee.name}" using this invite code:\n\n${committee.inviteCode}\n\nOpen Kometi app → Enter this code to request membership.`,
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
    return (
      <View className="flex-1 bg-surface-bg items-center justify-center">
        <ActivityIndicator size="large" color={COLORS.brandPrimary} />
      </View>
    );
  }

  if (!committee) return null;

  const totalPot = Number(committee.installmentAmountPaise) * committee.totalSlots;
  const isOrganizer = committee.organizerId === currentUser?.id;
  const isAdminOrManager = canAccessAdminPanel(currentUser?.role);

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
  const maxPayoutAllowed = totalPot; // No organiser fee — full pool available
  const pendingJoinRequests = joinRequests.filter((request) => request.status === "PENDING");

  return (
    <ScrollView
      className="flex-1 bg-surface-bg px-4"
      contentContainerStyle={{ paddingTop: 64, paddingBottom: 120 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={COLORS.brandPrimary}
        />
      }
    >
      {/* Header */}
      <View className="flex-row items-center justify-between mb-6">
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-10 h-10 bg-surface-card rounded-full items-center justify-center border border-slate-100"
        >
          <Ionicons name="arrow-back" size={20} color="#64748b" />
        </TouchableOpacity>

        <Badge label={committee.status} variant="info" />
      </View>

      {/* Hero Card */}
      <Card style={{ marginBottom: 20 }} padding={0}>
        <View className="p-6">
          <Text className="text-slate-500 text-xs font-semibold uppercase tracking-wider">
            Auction Chit
          </Text>
          <Text className="text-slate-900 text-2xl font-bold mt-1">{committee.name}</Text>
          {committee.description ? (
            <Text className="text-slate-500 text-sm mt-1">{committee.description}</Text>
          ) : null}

          <View className="flex-row justify-between mt-5 pt-4 border-t border-slate-100">
            <View>
              <Text className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Total Value</Text>
              <Text className="text-gold-600 text-lg font-bold mt-0.5">{formatINR(totalPot)}</Text>
            </View>
            <View className="items-end">
              <Text className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Installment / Member</Text>
              <Text className="text-slate-900 text-lg font-bold mt-0.5">{formatINR(committee.installmentAmountPaise)}</Text>
            </View>
          </View>

          <View className="flex-row justify-between mt-4">
            <View>
              <Text className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Cycle duration</Text>
              <Text className="text-slate-900 font-semibold text-sm mt-0.5">{committee.cycleDurationDays} days</Text>
            </View>
            <View className="items-end">
              <Text className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Current Cycle</Text>
              <Text className="text-slate-900 font-semibold text-sm mt-0.5">#{committee.currentCycleNo} / {committee.totalSlots}</Text>
            </View>
          </View>
        </View>
      </Card>

      {/* Organiser Management Dashboard Button */}
      {isOrganizer && (
        <View className="mb-6">
          <Button
            label="Organiser Dashboard"
            variant="secondary"
            onPress={() => router.push(`/committees/${id}/manage`)}
            icon={<Ionicons name="settings-outline" size={20} color={COLORS.brandPrimary} />}
          />
          <Text className="text-slate-500 text-[10px] text-center mt-2 italic">
            Manage fund disbursements, bids, and month resolutions.
          </Text>
        </View>
      )}

      {/* Audit Log — Visible to ALL members */}
      <View className="mb-6">
        <Button
          label="View Audit Log"
          variant="secondary"
          onPress={() => router.push(`/committees/${id}/audit`)}
          icon={<Ionicons name="document-text-outline" size={20} color={COLORS.success.DEFAULT} />}
        />
        <Text className="text-slate-500 text-[10px] text-center mt-2 italic">
          Transparency panel — view full monthly summary and personal ledger.
        </Text>
      </View>

      {/* Place Bid — Member CTA (when month bidding is open) */}
      {!isOrganizer && (() => {
        const latestMonth = monthsData && monthsData.length > 0 ? monthsData[monthsData.length - 1] : null;
        const isBiddingOpen = latestMonth?.status === "bidding_open";
        const alreadyWon = myMembership?.hasReceivedPayout === true;
        const canMemberBid = isBiddingOpen && !alreadyWon;
        return canMemberBid ? (
          <View className="mb-6">
            <Button
              label="Place Your Bid"
              variant="gold"
              onPress={() => router.push(`/member/committee/${id}/bid` as any)}
              icon={<Ionicons name="hammer-outline" size={20} color="#fff" />}
            />
            <Text className="text-slate-500 text-[10px] text-center mt-2 italic">
              Enter the reverse auction — lowest bidder wins the pool.
            </Text>
          </View>
        ) : null;
      })()}

      {/* Member Dashboard — Visible to ALL members */}
      <View className="mb-6">
        <Button
          label="Member Dashboard"
          variant="secondary"
          onPress={() => router.push(`/member/committee/${id}` as any)}
          icon={<Ionicons name="person-circle-outline" size={20} color={COLORS.brandPrimary} />}
        />
        <Text className="text-slate-500 text-[10px] text-center mt-2 italic">
          View your contributions, place bids, and track payments.
        </Text>
      </View>

      {/* Committee Not Ready — Member-facing when DRAFT and not full */}
      {!isOrganizer && committee.status === "DRAFT" && committee.filledSlots < committee.totalSlots && (
        <View className="mb-6">
          <Card style={{ marginBottom: 0 }} padding={0}>
            <View className="p-5">
              <View className="flex-row items-center mb-3">
                <View className="w-10 h-10 rounded-full bg-amber-50 border border-amber-200/50 items-center justify-center mr-3">
                  <Ionicons name="time-outline" size={20} color="#d97706" />
                </View>
                <View className="flex-1">
                  <Text className="text-slate-900 font-bold text-sm">Committee Not Ready Yet</Text>
                  <Text className="text-slate-500 text-xs mt-0.5">
                    Waiting for {committee.totalSlots - committee.filledSlots} more member(s) to join.
                  </Text>
                </View>
              </View>
              <Text className="text-slate-600 text-xs">
                The organizer will start the committee once all slots are filled or adjusted.
                You&apos;ll be notified when it&apos;s active.
              </Text>
            </View>
          </Card>
        </View>
      )}

      {/* Committee Months — Organizer Only */}
      {isOrganizer && committee.status === "ACTIVE" && (
        <View className="mb-6">
          <Text className="text-slate-900 text-base font-bold mb-3">Committee Months</Text>

          {monthsData && monthsData.length > 0 && (
            <Card style={{ marginBottom: 0 }} padding={0}>
              <View className="p-5">
                <View className="flex-row border-b border-slate-100 pb-2 mb-3">
                  <Text className="w-14 text-slate-500 font-bold text-xs">Month</Text>
                  <Text className="flex-1 text-slate-500 font-bold text-xs">Date</Text>
                  <Text className="w-20 text-right text-slate-500 font-bold text-xs">Pool</Text>
                  <Text className="w-20 text-right text-slate-500 font-bold text-xs">Status</Text>
                </View>
                {monthsData.map((m: any) => (
                  <TouchableOpacity
                    key={m.id}
                    onPress={() => router.push(`/committees/${id}/manage/month/${m.id}`)}
                    className="flex-row py-2.5 border-b border-slate-100 items-center"
                  >
                    <Text className="w-14 text-slate-900 font-bold text-sm">#{m.monthNumber}</Text>
                    <Text className="flex-1 text-slate-700 font-semibold text-sm">
                      {new Date(m.monthDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </Text>
                    <Text className="w-20 text-right text-gold-600 font-bold text-sm">
                      {formatINR(Number(m.totalPool))}
                    </Text>
                    <View className="w-20 items-end">
                      <View
                        className={`px-2 py-0.5 rounded ${
                          m.status === "completed"
                            ? "bg-green-50"
                            : m.status === "bidding_open"
                            ? "bg-brand-50"
                            : "bg-slate-100"
                        }`}
                      >
                        <Text
                          className={`text-[10px] font-bold ${
                            m.status === "completed"
                              ? "text-green-700"
                              : m.status === "bidding_open"
                              ? "text-brand-700"
                              : "text-slate-600"
                          }`}
                        >
                          {m.status === "bidding_open" ? "BIDDING" : m.status.toUpperCase()}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </Card>
          )}

          {(!monthsData || monthsData.length === 0) && (
            <View className="items-center py-6 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
              <Ionicons name="calendar-outline" size={28} color="#94a3b8" />
              <Text className="text-slate-500 text-xs mt-2">No months created yet</Text>
              <Text className="text-slate-600 text-[10px] mt-1">
                Create the first month to start bidding.
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Invite Code — Organizer Only */}
      {isOrganizer && committee.status === "DRAFT" && committee.inviteCode && (
        <View className="mb-6">
          <Text className="text-slate-900 text-base font-bold mb-3">Invite Members</Text>
          <Card style={{ marginBottom: 0 }} padding={0}>
            <View className="p-5">
              <Text className="text-slate-500 text-xs font-semibold mb-3">
                Share this code with people you want to add to this chit.
              </Text>
              <View className="flex-row items-center justify-between bg-slate-50 border border-slate-100 rounded-xl px-4 py-3.5 mb-4">
                <Text className="text-gold-600 text-xl font-bold tracking-widest">
                  {committee.inviteCode}
                </Text>
                <Text className="text-slate-500 text-xs">
                  {committee.filledSlots}/{committee.totalSlots} filled
                </Text>
              </View>
              <View className="flex-row gap-3">
                <TouchableOpacity
                  onPress={handleCopyInviteCode}
                  className="flex-1 bg-brand-50 border border-brand-200/50 h-11 rounded-xl items-center justify-center flex-row"
                >
                  <Ionicons name="copy-outline" size={16} color={COLORS.brandPrimary} />
                  <Text className="text-brand-700 font-bold text-sm ml-1.5">Copy Code</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleShareInviteCode}
                  className="flex-1 bg-amber-50 border border-amber-200/50 h-11 rounded-xl items-center justify-center flex-row"
                >
                  <Ionicons name="share-outline" size={16} color={COLORS.goldPrimary} />
                  <Text className="text-amber-700 font-bold text-sm ml-1.5">Share Code</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Card>
        </View>
      )}

      {/* Waiting for Members — Organizer + DRAFT + Not Full */}
      {isOrganizer && committee.status === "DRAFT" && committee.filledSlots < committee.totalSlots && (
        <View className="mb-6">
          <Card style={{ marginBottom: 0 }} padding={0}>
            <View className="p-5">
              <View className="flex-row items-center mb-3">
                <View className="w-10 h-10 rounded-full bg-amber-50 border border-amber-200/50 items-center justify-center mr-3">
                  <Ionicons name="time-outline" size={20} color="#d97706" />
                </View>
                <View className="flex-1">
                  <Text className="text-slate-900 font-bold text-sm">Waiting for Members</Text>
                  <Text className="text-slate-500 text-xs mt-0.5">
                    {committee.totalSlots - committee.filledSlots} more slot(s) to fill
                  </Text>
                </View>
              </View>

              {/* Progress bar */}
              <View className="bg-slate-200 rounded-full h-2.5 mb-4">
                <View
                  className="bg-amber-500 h-2.5 rounded-full"
                  style={{ width: `${(committee.filledSlots / committee.totalSlots) * 100}%` }}
                />
              </View>

              <Text className="text-slate-600 text-xs mb-4">
                No actions (starting, bidding, payouts) can be performed until all slots are filled.
                Ask members to join using the invite code, or adjust the committee size below.
              </Text>

              {/* Adjust Size Section */}
              {!showAdjustSize ? (
                <TouchableOpacity
                  onPress={() => {
                    setAdjustSizeValue(String(committee.filledSlots));
                    setShowAdjustSize(true);
                  }}
                  className="bg-brand-50 border border-brand-200/50 h-11 rounded-xl items-center justify-center flex-row"
                >
                  <Ionicons name="resize-outline" size={16} color={COLORS.brandPrimary} />
                  <Text className="text-brand-700 font-bold text-sm ml-1.5">Adjust Committee Size</Text>
                </TouchableOpacity>
              ) : (
                <View className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                  <Text className="text-slate-500 text-xs font-semibold mb-2">
                    New Total Slots (min: {committee.filledSlots})
                  </Text>
                  <View className="flex-row gap-3 mb-3">
                    <View className="flex-1 bg-white border border-slate-200 rounded-xl px-4 h-12 justify-center">
                      <TextInput
                        value={adjustSizeValue}
                        onChangeText={setAdjustSizeValue}
                        keyboardType="numeric"
                        returnKeyType="done"
                        blurOnSubmit={true}
                        onSubmitEditing={() => Keyboard.dismiss()}
                        placeholder={`${committee.filledSlots}`}
                        placeholderTextColor="#94a3b8"
                        className="text-slate-900 font-semibold text-sm"
                      />
                    </View>
                    <View className="flex-row gap-2">
                      <TouchableOpacity
                        onPress={() => { Keyboard.dismiss(); setAdjustSizeValue(String(committee.filledSlots)); }}
                        className="bg-white border border-slate-200 h-12 px-3 rounded-xl items-center justify-center"
                      >
                        <Text className="text-slate-600 font-bold text-xs">Min</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => { Keyboard.dismiss(); setAdjustSizeValue(String(committee.totalSlots)); }}
                        className="bg-white border border-slate-200 h-12 px-3 rounded-xl items-center justify-center"
                      >
                        <Text className="text-slate-600 font-bold text-xs">Max</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  <Text className="text-slate-500 text-[10px] mb-3">
                    Set to {committee.filledSlots} to immediately unlock the committee.
                  </Text>
                  <View className="flex-row gap-3">
                    <TouchableOpacity
                      onPress={() => { Keyboard.dismiss(); setShowAdjustSize(false); }}
                      className="flex-1 h-10 rounded-xl items-center justify-center border border-slate-200"
                    >
                      <Text className="text-slate-500 font-bold text-sm">Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        Keyboard.dismiss();
                        setTimeout(() => handleAdjustSize(), 100);
                      }}
                      disabled={isAdjusting}
                      activeOpacity={0.7}
                      className="flex-1 bg-brand-500 h-10 rounded-xl items-center justify-center"
                      style={{ opacity: isAdjusting ? 0.6 : 1 }}
                    >
                      {isAdjusting ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text className="text-white font-bold text-sm">Confirm</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          </Card>
        </View>
      )}

      {/* Start Committee Button — Organizer Only (only when ALL slots filled) */}
      {isOrganizer && committee.status === "DRAFT" && committee.filledSlots === committee.totalSlots && (
        <View className="mb-6">
          <Button
            label="Start Chit Committee"
            variant="primary"
            onPress={handleStartCommittee}
            icon={<Ionicons name="play-circle-outline" size={20} color="#fff" />}
          />
          <Text className="text-slate-500 text-[10px] text-center mt-2 italic">
            All slots are filled. You can now activate this chit.
          </Text>
        </View>
      )}

      {/* Pending Join Requests — Organizer Only */}
      {isOrganizer && committee.status === "DRAFT" && pendingJoinRequests.length > 0 && (
        <View className="mb-6">
          <Text className="text-slate-900 text-base font-bold mb-3">
            Join Requests ({pendingJoinRequests.length} pending)
          </Text>
          {pendingJoinRequests.map((request: any) => (
              <View
                key={request.id}
                className="bg-surface-card border border-slate-100 rounded-xl p-4 mb-2.5"
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center flex-1">
                    <View className="w-10 h-10 rounded-full bg-amber-55 border border-amber-200/50 items-center justify-center mr-3">
                      <Ionicons name="person-outline" size={18} color={COLORS.goldPrimary} />
                    </View>
                    <View className="flex-1">
                      <Text className="text-slate-900 font-bold text-sm">{request.user?.name || "Unknown"}</Text>
                      <Text className="text-slate-500 text-[10px] mt-0.5">{request.user?.phone}</Text>
                      <Text className="text-slate-600 text-[10px] mt-0.5">
                        Requested {new Date(request.createdAt).toLocaleDateString()}
                      </Text>
                    </View>
                  </View>

                  <View className="flex-row gap-2">
                    <TouchableOpacity
                      onPress={() => handleApproveRequest(request.id, request.user?.name || "Member")}
                      disabled={processingId === request.id}
                      className="w-10 h-10 rounded-full bg-green-500/15 border border-green-500/20 items-center justify-center"
                    >
                      {processingId === request.id ? (
                        <ActivityIndicator size="small" color="#4ade80" />
                      ) : (
                        <Ionicons name="checkmark-outline" size={18} color="#4ade80" />
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleRejectRequest(request.id, request.user?.name || "Member")}
                      disabled={processingId === request.id}
                      className="w-10 h-10 rounded-full bg-red-500/15 border border-red-500/20 items-center justify-center"
                    >
                      <Ionicons name="close-outline" size={18} color="#f87171" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))}
        </View>
      )}

      {/* Auction Bidding Panel */}
      {committee.status === "ACTIVE" && (() => {
        const latestMonth = monthsData && monthsData.length > 0 ? monthsData[monthsData.length - 1] : null;
        const isMonthBiddingOpen = latestMonth?.status === "bidding_open";
        return (
        <View className="mb-6">
          <Text className="text-slate-900 text-base font-bold mb-3">Live Auction</Text>
          <Card style={{ marginBottom: 16 }} padding={0}>
            <View className="p-5">
              <View className="flex-row justify-between mb-4">
                <Text className="text-slate-500 font-semibold text-sm">Leading Lowest Payout</Text>
                <Text className="text-slate-900 font-bold text-sm">
                  {leadingBid ? formatINR(leadingBid.bidAmountPaise) : "No bids yet"}
                </Text>
              </View>

              <View className="bg-slate-50 border border-slate-100 p-3.5 rounded-xl mb-4">
                <Text className="text-slate-600 text-xs font-semibold">Bidding Rules (Reverse Auction):</Text>
                <Text className="text-slate-600 text-xs mt-1">
                  • Min Allowed Payout: {formatINR(minPayoutAllowed)} (max {maxDiscRate}% discount)
                </Text>
                <Text className="text-slate-600 text-xs mt-0.5">
                  • Max Allowed Payout: {formatINR(maxPayoutAllowed)} (full pool)
                </Text>
              </View>

              {!isOrganizer && isMonthBiddingOpen && myMembership && !userHasWon ? (
                <View>
                  <View className="bg-amber-50 border border-amber-200/50 rounded-xl p-4 mb-3">
                    <View className="flex-row items-center mb-2">
                      <Ionicons name="hammer-outline" size={16} color={COLORS.goldPrimary} />
                      <Text className="text-amber-700 font-bold text-sm ml-2">Bidding is Open!</Text>
                    </View>
                    <Text className="text-slate-700 text-xs">
                      Place your bid in the reverse auction. Lowest bidder wins the full pool.
                    </Text>
                  </View>
                  <Button
                    label="Place Your Bid Now"
                    variant="gold"
                    onPress={() => router.push(`/member/committee/${id}/bid` as any)}
                    icon={<Ionicons name="hammer-outline" size={18} color="#fff" />}
                  />
                </View>
              ) : myMembership && !userHasWon ? (
                <View>
                  <Text className="text-slate-500 text-xs font-semibold mb-2">PLACE YOUR BID (Payout Request)</Text>
                  <View className="flex-row gap-3">
                    <View className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 justify-center h-12">
                      <TextInput
                        value={bidAmount}
                        onChangeText={setBidAmount}
                        keyboardType="numeric"
                        placeholder={`e.g. ${maxPayoutAllowed / 100 - 500}`}
                        placeholderTextColor="#94a3b8"
                        className="text-slate-900 font-semibold text-sm"
                      />
                    </View>
                    <TouchableOpacity
                      onPress={handlePlaceBid}
                      disabled={isSubmitting}
                      className="bg-brand-500 hover:bg-brand-600 px-5 rounded-xl items-center justify-center"
                    >
                      {isSubmitting ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text className="text-white font-bold text-sm">Bid</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View className="bg-red-50 border border-red-150 p-3.5 rounded-xl">
                  <Text className="text-red-700 text-xs font-semibold text-center">
                    {userHasWon
                      ? "You have already received a payout, so you are ineligible to bid."
                      : "Only chit members can place bids."}
                  </Text>
                </View>
              )}

              {(isOrganizer || isAdminOrManager) && monthsData && monthsData.some((m: any) => m.status !== "completed") && (
                <TouchableOpacity
                  onPress={handleResolveMonth}
                  disabled={loading}
                  className={`h-11 rounded-xl items-center justify-center flex-row mt-4 ${loading ? "bg-gold-500/50" : "bg-gold-500/80 hover:bg-gold-500"}`}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons name="flash-outline" size={16} color="#fff" />
                  )}
                  <Text className="text-white font-bold ml-1.5 text-sm">
                    {loading ? "Resolving..." : "Resolve Cycle & Distribute Payout"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </Card>

          <Text className="text-slate-900 text-sm font-bold mb-2">Active Bids (Cycle #{committee.currentCycleNo})</Text>
          {activeBids.map((bid: any, idx: number) => (
            <View
              key={bid.id}
              className="flex-row items-center justify-between bg-surface-card border border-slate-100 rounded-xl p-3.5 mb-2.5"
            >
              <View className="flex-row items-center">
                <View className="w-8 h-8 rounded-full bg-brand-50 items-center justify-center border border-brand-200/60 mr-3">
                  <Text className="text-brand-700 font-bold text-xs">#{idx + 1}</Text>
                </View>
                <View>
                  <Text className="text-slate-900 font-bold text-sm">{bid.user?.name || "Anonymous"}</Text>
                  <Text className="text-slate-500 text-[10px] mt-0.5">Requested payout</Text>
                </View>
              </View>

              <View className="items-end">
                <Text className="text-slate-900 font-bold text-sm">{formatINR(bid.bidAmountPaise)}</Text>
                <Text className="text-slate-500 text-[10px] mt-0.5">
                  Discount: {formatINR(totalPot - Number(bid.bidAmountPaise))}
                </Text>
              </View>
            </View>
          ))}

          {activeBids.length === 0 && (
            <View className="items-center py-6 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
              <Text className="text-slate-500 text-xs">No bids placed yet for this cycle</Text>
            </View>
          )}
        </View>
        );
      })()}

      {/* Payout Cycle History */}
      <Text className="text-slate-900 text-base font-bold mb-3">Payout & Dividend History</Text>
      <Card style={{ marginBottom: 20 }} padding={0}>
        <View className="p-5">
          <View className="flex-row border-b border-slate-100 pb-2 mb-3">
            <Text className="w-14 text-slate-500 font-bold text-xs">Cycle</Text>
            <Text className="flex-1 text-slate-500 font-bold text-xs">Winner</Text>
            <Text className="w-24 text-right text-slate-500 font-bold text-xs">Payout</Text>
          </View>

          {(committee.payoutCycles || [])
            .sort((a: any, b: any) => a.cycleNo - b.cycleNo)
            .map((item: any) => {
              const winnerName = committee.members?.find((m: any) => m.userId === item.winnerId)?.user?.name || "Winner";
              return (
                <View key={item.id} className="flex-row py-2.5 border-b border-slate-100 items-center">
                  <Text className="w-14 text-slate-900 font-bold text-sm">#{item.cycleNo}</Text>
                  <Text className="flex-1 text-slate-700 font-semibold text-sm">{winnerName}</Text>
                  <Text className="w-24 text-right text-gold-600 font-bold text-sm">
                    {formatINR(item.payoutAmtPaise)}
                  </Text>
                </View>
              );
            })}

          {(!committee.payoutCycles || committee.payoutCycles.length === 0) && (
            <Text className="text-center text-slate-500 py-3 text-xs">No payout cycles resolved yet</Text>
          )}
        </View>
      </Card>

      {/* Monthly Schedule */}
      {schedule && schedule.length > 0 && (
        <>
          <Text className="text-slate-900 text-base font-bold mb-3">Monthly Schedule</Text>
          <Card style={{ marginBottom: 20 }} padding={0}>
            <View className="p-5">
              <View className="flex-row border-b border-slate-100 pb-2 mb-3">
                <Text className="w-14 text-slate-500 font-bold text-xs">Cycle</Text>
                <Text className="flex-1 text-slate-500 font-bold text-xs">Due Date</Text>
                <Text className="w-16 text-right text-slate-500 font-bold text-xs">Amount</Text>
                <Text className="w-24 text-right text-slate-500 font-bold text-xs">Status</Text>
              </View>

              {schedule.map((item: any) => {
                const isCurrentCycle = item.cycleNo === committee.currentCycleNo;
                const allPaid = item.paid === item.total;
                const hasOverdue = item.overdue > 0;
                const displayStatus = item.userStatus || (allPaid ? "PAID" : hasOverdue ? "OVERDUE" : "PENDING");
                const isPaid = displayStatus === "PAID" || displayStatus === "COMPLETED";
                const isOverdue = displayStatus === "OVERDUE";
                return (
                  <View
                    key={item.cycleNo}
                    className={`flex-row py-2.5 border-b border-slate-100 items-center ${
                      isCurrentCycle ? "bg-brand-50/50" : ""
                    }`}
                  >
                    <Text className={`w-14 font-bold text-sm ${isCurrentCycle ? "text-brand-700" : "text-slate-900"}`}>
                      #{item.cycleNo}
                    </Text>
                    <Text className="flex-1 text-slate-700 font-semibold text-sm">
                      {new Date(item.dueDate).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </Text>
                    <Text className="w-16 text-right text-gold-600 font-bold text-sm">
                      {formatINR(item.amountDuePaise)}
                    </Text>
                    <View className="w-24 items-end">
                      <View
                        className={`px-2 py-0.5 rounded ${
                          isPaid
                            ? "bg-green-50"
                            : isOverdue
                            ? "bg-red-50"
                            : "bg-slate-100"
                        }`}
                      >
                        <Text
                          className={`text-[10px] font-bold ${
                            isPaid
                              ? "text-green-700"
                              : isOverdue
                              ? "text-red-700"
                              : "text-slate-600"
                          }`}
                        >
                          {isPaid ? "Paid" : isOverdue ? "Overdue" : `${item.paid}/${item.total} paid`}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          </Card>
        </>
      )}

      {/* Members List */}
      <Text className="text-slate-900 text-base font-bold mb-3">Chit Members</Text>
      {committee.members?.map((member: any) => (
        <View
          key={member.id}
          className="flex-row items-center justify-between bg-surface-card border border-slate-100 rounded-xl p-3.5 mb-2.5"
        >
          <View className="flex-row items-center">
            <View className="w-7 h-7 rounded-full bg-brand-50 border border-brand-200/50 items-center justify-center mr-3">
              <Text className="text-brand-700 font-bold text-xs">{member.slotNumber}</Text>
            </View>
            <View>
              <Text className="text-slate-900 font-bold text-sm">
                {member.user?.name} {member.userId === currentUser?.id && "(You)"}
              </Text>
              <Text className="text-slate-500 text-[10px] mt-0.5">{member.user?.phone}</Text>
            </View>
          </View>

          <Badge
            label={member.hasReceivedPayout ? "Payout Received" : "Eligible to Bid"}
            variant={member.hasReceivedPayout ? "success" : "info"}
          />
        </View>
      ))}
      <AlertComponent />
    </ScrollView>
  );
}
