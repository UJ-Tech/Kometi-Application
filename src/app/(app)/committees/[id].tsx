// src/app/(app)/committees/[id].tsx
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
  Share,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { committeesApi } from "../../../services/committees.api";
import { useAuthStore } from "../../../stores/auth.store";
import { canAccessAdminPanel } from "../../../utils/rbac";
import { formatINR } from "../../../utils/currency";
import { COLORS } from "../../../constants/theme";
import Card from "../../../components/ui/Card";
import Badge from "../../../components/ui/Badge";
import Button from "../../../components/ui/Button";

export default function CommitteeDetail() {
  const rawId = useLocalSearchParams<{ id: string }>().id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const isValidId = id && id !== "undefined" && id !== "null";
  const router = useRouter();
  const currentUser = useAuthStore((s) => s.user);

  const [committee, setCommittee] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [bidAmount, setBidAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [joinRequests, setJoinRequests] = useState<any[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<any[] | null>(null);

  // Lottery (FIXED_WINNER) state
  const [lotteryStatus, setLotteryStatus] = useState<any | null>(null);
  const [lotteryLoading, setLotteryLoading] = useState(false);
  const [lotteryDrawResult, setLotteryDrawResult] = useState<any | null>(null);
  const [lotteryReceipt, setLotteryReceipt] = useState<any | null>(null);

  const confirmAction = async (title: string, message: string, confirmLabel = "Confirm") => {
    if (Platform.OS === "web") {
      const confirmed = window.confirm(`${title}\n\n${message}`);
      return confirmed;
    }

    return new Promise<boolean>((resolve) => {
      Alert.alert(title, message, [
        { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
        { text: confirmLabel, onPress: () => resolve(true) },
      ]);
    });
  };

  const syncCommitteeData = async () => {
    await Promise.all([loadCommittee(), loadJoinRequests()]);
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

  const loadCommittee = async () => {
    try {
      const res = await committeesApi.getById(id);
      setCommittee(res.data.data);
    } catch (err) {
      console.error("[CommitteeDetail] Failed to load:", err);
      Alert.alert("Error", "Failed to load chit committee details");
      router.back();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (isValidId) {
      loadCommittee();
    }
  }, [id]);

  const loadJoinRequests = async () => {
    try {
      const res = await committeesApi.getJoinRequests(id);
      setJoinRequests(res.data.data);
    } catch (err) {
      console.error("[CommitteeDetail] Failed to load join requests:", err);
    }
  };

  useEffect(() => {
    if (id && committee?.organizerId === currentUser?.id && committee?.status === "DRAFT") {
      loadJoinRequests();
    }
  }, [id, committee?.organizerId, committee?.status]);

  const loadSchedule = async () => {
    if (!id || !committee) return;
    if (committee.status === "DRAFT") return;
    try {
      const res = await committeesApi.getSchedule(id);
      setSchedule(res.data.data.cycles);
    } catch (err) {
      console.error("[CommitteeDetail] Failed to load schedule:", err);
    }
  };

  useEffect(() => {
    if (committee && committee.status !== "DRAFT") {
      loadSchedule();
    }
  }, [committee?.id, committee?.status]);

  if (!isValidId) {
    return (
      <View className="flex-1 bg-surface-950 items-center justify-center px-6">
        <View className="w-20 h-20 rounded-full bg-surface-card items-center justify-center mb-5 border border-brand-primary/10">
          <Ionicons name="alert-circle-outline" size={36} color="#71717a" />
        </View>
        <Text className="text-white font-bold text-lg text-center mb-2">
          Committee Not Found
        </Text>
        <Text className="text-neutral-500 text-sm text-center mb-6 leading-5">
          The committee you're looking for doesn't exist or the link is invalid.
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
        Alert.alert("Approved", `${userName} has been added to the committee.`);
        await syncCommitteeData();
      }
    } catch (err) {
      console.error("[CommitteeDetail] Approve failed:", err);
      const message = err instanceof Error ? err.message : "Failed to approve member";
      await syncCommitteeData();
      Alert.alert("Error", message);
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
        Alert.alert("Rejected", `${userName}'s request has been rejected.`);
        await syncCommitteeData();
      }
    } catch (err) {
      console.error("[CommitteeDetail] Reject failed:", err);
      const message = err instanceof Error ? err.message : "Failed to reject member";
      await syncCommitteeData();
      Alert.alert("Error", message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleStartCommittee = async () => {
    Alert.alert(
      "Start Chit Committee",
      "Are you sure you want to start this chit? This will generate the installment schedule and activate the first cycle. You cannot add more members after starting.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Start Now",
          onPress: async () => {
            try {
              setLoading(true);
              await committeesApi.start(id);
              Alert.alert("Success", "Committee has been started successfully!");
              await loadCommittee();
            } catch (err) {
              Alert.alert("Error", err instanceof Error ? err.message : "Failed to start committee");
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadCommittee();
  };

  const handlePlaceBid = async () => {
    if (!bidAmount || isNaN(Number(bidAmount))) {
      Alert.alert("Invalid Input", "Please enter a valid numeric payout amount.");
      return;
    }

    const payoutRupees = Number(bidAmount);
    const amountPaise = Math.round(payoutRupees * 100);

    try {
      setIsSubmitting(true);
      await committeesApi.submitBid(id, amountPaise);
      Alert.alert("Success", `Your bid of ${formatINR(amountPaise)} has been submitted!`);
      setBidAmount("");
      loadCommittee();
    } catch (err) {
      Alert.alert("Bid Failed", err instanceof Error ? err.message : "Failed to place bid");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResolveAuction = async () => {
    Alert.alert(
      "Confirm Resolution",
      `Are you sure you want to resolve the auction for Cycle #${committee.currentCycleNo}? If no bids are submitted, a random winner will be selected.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Resolve",
          style: "default",
          onPress: async () => {
            try {
              setLoading(true);
              const res = await committeesApi.resolveAuction(id, committee.currentCycleNo);
              const result = res.data.data;
              const winner = committee.members.find((m: any) => m.userId === result.winnerId)?.user?.name || "Member";
              
              Alert.alert(
                "Auction Resolved",
                `Winner: ${winner}\nPayout: ${formatINR(result.payoutAmtPaise)}\nDistributed Dividend: ${formatINR(result.dividendPerMemberPaise)} per member.`,
                [{ text: "OK", onPress: loadCommittee }]
              );
            } catch (err) {
              Alert.alert("Resolution Failed", err instanceof Error ? err.message : "Failed to resolve auction");
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleShareInviteCode = async () => {
    try {
      await Share.share({
        message: `Join my chit committee "${committee.name}" using this invite code:\n\n${committee.inviteCode}\n\nOpen Kometi app → Enter this code to request membership.`,
      });
    } catch {}
  };

  const handleCopyInviteCode = () => {
    if (committee.inviteCode) {
      Alert.alert("Invite Code", `Share this code with members:\n\n${committee.inviteCode}`);
    }
  };

  // ─── LOTTERY HANDLERS ───────────────────────────────────────────────

  const loadLotteryStatus = async () => {
    if (!id || !committee || committee.type !== "FIXED_WINNER" || committee.status !== "ACTIVE") return;
    try {
      const res = await committeesApi.getLotteryStatus(id);
      setLotteryStatus(res.data.data);
    } catch (err) {
      console.error("[Lottery] Failed to load status:", err);
    }
  };

  useEffect(() => {
    if (committee && committee.type === "FIXED_WINNER" && committee.status === "ACTIVE") {
      loadLotteryStatus();
    }
  }, [committee?.id, committee?.status]);

  const handleLockMembers = async () => {
    const confirmed = await confirmAction(
      "Lock Eligible Members",
      "This will lock the list of eligible members based on who has paid. Only locked members can be drawn as winners. Continue?",
      "Lock"
    );
    if (!confirmed) return;

    try {
      setLotteryLoading(true);
      const res = await committeesApi.lockLotteryMembers(id);
      if (res.data.success) {
        Alert.alert("Locked", `${res.data.data.lockedCount} eligible members locked for lottery.`);
        await loadLotteryStatus();
      }
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to lock members");
    } finally {
      setLotteryLoading(false);
    }
  };

  const handleDrawWinner = async () => {
    const confirmed = await confirmAction(
      "Draw Lottery Winner",
      "A winner will be randomly selected from the locked eligible members. This cannot be undone. Continue?",
      "Draw"
    );
    if (!confirmed) return;

    try {
      setLotteryLoading(true);
      const res = await committeesApi.drawLotteryWinner(id);
      if (res.data.success) {
        setLotteryDrawResult(res.data.data);
        Alert.alert(
          "Winner Drawn!",
          `${res.data.data.winnerName} (Slot #${res.data.data.winnerSlot}) has been selected!\nPayout: ${formatINR(res.data.data.payoutAmtPaise)}`
        );
        await loadLotteryStatus();
      }
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to draw winner");
    } finally {
      setLotteryLoading(false);
    }
  };

  const handleConfirmPayout = async () => {
    const confirmed = await confirmAction(
      "Confirm & Process Payout",
      `This will credit ${formatINR(lotteryDrawResult?.payoutAmtPaise || 0)} to the winner's wallet and generate a receipt. Continue?`,
      "Confirm Payout"
    );
    if (!confirmed) return;

    try {
      setLotteryLoading(true);
      const res = await committeesApi.confirmLotteryPayout(id);
      if (res.data.success) {
        const result = res.data.data;
        Alert.alert(
          "Payout Complete!",
          `Winner: ${result.winnerName}\nPayout: ${formatINR(result.payoutAmtPaise)}\nReceipt: ${result.receiptNumber}\n${result.isCompleted ? "Committee completed!" : `Next cycle: #${result.nextCycleNo}`}`
        );
        setLotteryDrawResult(null);
        setLotteryReceipt(null);
        await Promise.all([loadCommittee(), loadLotteryStatus()]);
      }
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to confirm payout");
    } finally {
      setLotteryLoading(false);
    }
  };

  const handleViewReceipt = async (cycleNo: number) => {
    try {
      const res = await committeesApi.getLotteryReceipt(id, cycleNo);
      setLotteryReceipt(res.data.data);
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to load receipt");
    }
  };

  if (loading && !refreshing) {
    return (
      <View className="flex-1 bg-surface-950 items-center justify-center">
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
  const commRate = Number(committee.commissionRatePct || 5);
  const maxDiscRate = Number(committee.maxDiscountPct || 30);
  const commissionPaise = (totalPot * commRate) / 100;
  const maxDiscountPaise = (totalPot * maxDiscRate) / 100;
  const minPayoutAllowed = totalPot - maxDiscountPaise;
  const maxPayoutAllowed = totalPot - commissionPaise;
  const pendingJoinRequests = joinRequests.filter((request) => request.status === "PENDING");

  return (
    <ScrollView
      className="flex-1 bg-surface-950 px-4"
      contentContainerStyle={{ paddingTop: 64, paddingBottom: 120 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={COLORS.brandPrimary}
        />
      }
    >
      <LinearGradient
        colors={[COLORS.brandPrimary + "10", "transparent"]}
        className="absolute inset-0 h-96"
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      {/* Header */}
      <View className="flex-row items-center justify-between mb-6">
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-10 h-10 bg-surface-card rounded-full items-center justify-center border border-brand-primary/10"
        >
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>

        <Badge label={committee.status} variant="info" />
      </View>

      {/* Hero Card */}
      <Card style={{ marginBottom: 20 }} padding={0}>
        <View className="p-6">
          <Text className="text-neutral-400 text-xs font-semibold uppercase tracking-wider">
            {committee.type === "AUCTION" ? "Auction Chit" : committee.type === "FIXED_WINNER" ? "Lottery Chit" : "Fixed Rotation Chit"}
          </Text>
          <Text className="text-white text-2xl font-bold mt-1">{committee.name}</Text>
          {committee.description ? (
            <Text className="text-neutral-400 text-sm mt-1">{committee.description}</Text>
          ) : null}

          <View className="flex-row justify-between mt-5 pt-4 border-t border-brand-primary/10">
            <View>
              <Text className="text-neutral-500 text-[10px] uppercase font-bold tracking-wider">Total Value</Text>
              <Text className="text-gold-500 text-lg font-bold mt-0.5">{formatINR(totalPot)}</Text>
            </View>
            <View className="items-end">
              <Text className="text-neutral-500 text-[10px] uppercase font-bold tracking-wider">Installment / Member</Text>
              <Text className="text-white text-lg font-bold mt-0.5">{formatINR(committee.installmentAmountPaise)}</Text>
            </View>
          </View>

          <View className="flex-row justify-between mt-4">
            <View>
              <Text className="text-neutral-500 text-[10px] uppercase font-bold tracking-wider">Cycle duration</Text>
              <Text className="text-white font-semibold text-sm mt-0.5">{committee.cycleDurationDays} days</Text>
            </View>
            <View className="items-end">
              <Text className="text-neutral-500 text-[10px] uppercase font-bold tracking-wider">Current Cycle</Text>
              <Text className="text-white font-semibold text-sm mt-0.5">#{committee.currentCycleNo} / {committee.totalSlots}</Text>
            </View>
          </View>
        </View>
      </Card>

      {/* Invite Code — Organizer Only */}
      {isOrganizer && committee.status === "DRAFT" && committee.inviteCode && (
        <View className="mb-6">
          <Text className="text-white text-base font-bold mb-3">Invite Members</Text>
          <Card style={{ marginBottom: 0 }} padding={0}>
            <View className="p-5">
              <Text className="text-neutral-400 text-xs font-semibold mb-3">
                Share this code with people you want to add to this chit.
              </Text>
              <View className="flex-row items-center justify-between bg-surface-bg border border-brand-primary/10 rounded-xl px-4 py-3.5 mb-4">
                <Text className="text-gold-400 text-xl font-bold tracking-widest">
                  {committee.inviteCode}
                </Text>
                <Text className="text-neutral-500 text-xs">
                  {committee.filledSlots}/{committee.totalSlots} filled
                </Text>
              </View>
              <View className="flex-row gap-3">
                <TouchableOpacity
                  onPress={handleCopyInviteCode}
                  className="flex-1 bg-brand-500/15 border border-brand-500/20 h-11 rounded-xl items-center justify-center flex-row"
                >
                  <Ionicons name="copy-outline" size={16} color={COLORS.brandPrimary} />
                  <Text className="text-brand-400 font-bold text-sm ml-1.5">View Code</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleShareInviteCode}
                  className="flex-1 bg-gold-500/15 border border-gold-500/20 h-11 rounded-xl items-center justify-center flex-row"
                >
                  <Ionicons name="share-outline" size={16} color={COLORS.goldPrimary} />
                  <Text className="text-gold-400 font-bold text-sm ml-1.5">Share Code</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Card>
        </View>
      )}

      {/* Start Committee Button — Organizer Only */}
      {isOrganizer && committee.status === "DRAFT" && committee.filledSlots === committee.totalSlots && (
        <View className="mb-6">
          <Button
            label="Start Chit Committee"
            variant="primary"
            onPress={handleStartCommittee}
            icon={<Ionicons name="play-circle-outline" size={20} color="#fff" />}
          />
          <Text className="text-neutral-500 text-[10px] text-center mt-2 italic">
            All slots are filled. You can now activate this chit.
          </Text>
        </View>
      )}

      {/* Pending Join Requests — Organizer Only */}
      {isOrganizer && committee.status === "DRAFT" && pendingJoinRequests.length > 0 && (
        <View className="mb-6">
          <Text className="text-white text-base font-bold mb-3">
            Join Requests ({pendingJoinRequests.length} pending)
          </Text>
          {pendingJoinRequests.map((request: any) => (
              <View
                key={request.id}
                className="bg-surface-card border border-brand-primary/5 rounded-xl p-4 mb-2.5"
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center flex-1">
                    <View className="w-10 h-10 rounded-full bg-gold-500/15 border border-gold-500/20 items-center justify-center mr-3">
                      <Ionicons name="person-outline" size={18} color={COLORS.goldPrimary} />
                    </View>
                    <View className="flex-1">
                      <Text className="text-white font-bold text-sm">{request.user?.name || "Unknown"}</Text>
                      <Text className="text-neutral-500 text-[10px] mt-0.5">{request.user?.phone}</Text>
                      <Text className="text-neutral-600 text-[10px] mt-0.5">
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
      {committee.status === "ACTIVE" && committee.type === "AUCTION" && (
        <View className="mb-6">
          <Text className="text-white text-base font-bold mb-3">Live Auction</Text>
          <Card style={{ marginBottom: 16 }} padding={0}>
            <View className="p-5">
              <View className="flex-row justify-between mb-4">
                <Text className="text-neutral-400 font-semibold text-sm">Leading Lowest Payout</Text>
                <Text className="text-white font-bold text-sm">
                  {leadingBid ? formatINR(leadingBid.bidAmountPaise) : "No bids yet"}
                </Text>
              </View>

              {/* Bidding Limits Info */}
              <View className="bg-surface-elevated/40 border border-brand-primary/5 p-3.5 rounded-xl mb-4">
                <Text className="text-neutral-400 text-xs font-semibold">Bidding Rules (Reverse Auction):</Text>
                <Text className="text-neutral-300 text-xs mt-1">
                  • Commission: {commRate}% ({formatINR(commissionPaise)})
                </Text>
                <Text className="text-neutral-300 text-xs mt-0.5">
                  • Min Allowed Payout: {formatINR(minPayoutAllowed)} (max {maxDiscRate}% discount)
                </Text>
                <Text className="text-neutral-300 text-xs mt-0.5">
                  • Max Allowed Payout: {formatINR(maxPayoutAllowed)} (minus commission)
                </Text>
              </View>

              {/* Form for non-winners */}
              {myMembership && !userHasWon ? (
                <View>
                  <Text className="text-neutral-400 text-xs font-semibold mb-2">PLACE YOUR BID (Payout Request)</Text>
                  <View className="flex-row gap-3">
                    <View className="flex-1 bg-surface-bg border border-brand-primary/10 rounded-xl px-4 justify-center h-12">
                      <TextInput
                        value={bidAmount}
                        onChangeText={setBidAmount}
                        keyboardType="numeric"
                        placeholder={`e.g. ${maxPayoutAllowed / 100 - 500}`}
                        placeholderTextColor="#a3a3a3"
                        className="text-white font-semibold text-sm"
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
                <View className="bg-danger-500/5 border border-danger-500/10 p-3.5 rounded-xl">
                  <Text className="text-danger-500 text-xs font-semibold text-center">
                    {userHasWon
                      ? "You have already received a payout, so you are ineligible to bid."
                      : "Only chit members can place bids."}
                  </Text>
                </View>
              )}

              {/* Resolve Button for Admin/Organizer */}
              {(isOrganizer || isAdminOrManager) && (
                <TouchableOpacity
                  onPress={handleResolveAuction}
                  className="bg-gold-500/80 hover:bg-gold-500 h-11 rounded-xl items-center justify-center flex-row mt-4"
                >
                  <Ionicons name="flash-outline" size={16} color="#fff" />
                  <Text className="text-white font-bold ml-1.5 text-sm">Resolve Cycle & Distribute Payout</Text>
                </TouchableOpacity>
              )}
            </View>
          </Card>

          {/* Active Bids list */}
          <Text className="text-white text-sm font-bold mb-2">Active Bids (Cycle #{committee.currentCycleNo})</Text>
          {activeBids.map((bid: any, idx: number) => (
            <View
              key={bid.id}
              className="flex-row items-center justify-between bg-surface-card border border-brand-primary/5 rounded-xl p-3.5 mb-2.5"
            >
              <View className="flex-row items-center">
                <View className="w-8 h-8 rounded-full bg-brand-500/10 items-center justify-center border border-brand-500/20 mr-3">
                  <Text className="text-brand-500 font-bold text-xs">#{idx + 1}</Text>
                </View>
                <View>
                  <Text className="text-white font-bold text-sm">{bid.user?.name || "Anonymous"}</Text>
                  <Text className="text-neutral-500 text-[10px] mt-0.5">Requested payout</Text>
                </View>
              </View>

              <View className="items-end">
                <Text className="text-white font-bold text-sm">{formatINR(bid.bidAmountPaise)}</Text>
                <Text className="text-neutral-400 text-[10px] mt-0.5">
                  Discount: {formatINR(totalPot - Number(bid.bidAmountPaise))}
                </Text>
              </View>
            </View>
          ))}

          {activeBids.length === 0 && (
            <View className="items-center py-6 bg-surface-card/30 rounded-xl border border-dashed border-neutral-800">
              <Text className="text-neutral-500 text-xs">No bids placed yet for this cycle</Text>
            </View>
          )}
        </View>
      )}

      {/* Lottery (FIXED_WINNER) Panel */}
      {committee.status === "ACTIVE" && committee.type === "FIXED_WINNER" && isOrganizer && (
        <View className="mb-6">
          <Text className="text-white text-base font-bold mb-3">Lottery - Cycle #{committee.currentCycleNo}</Text>

          {/* Stage 1: Verify Collections */}
          {lotteryStatus && !lotteryStatus.existingPayout?.isCompleted && !lotteryDrawResult && (
            <Card style={{ marginBottom: 12 }} padding={0}>
              <View className="p-5">
                <View className="flex-row items-center mb-3">
                  <View className="w-6 h-6 rounded-full bg-brand-500 items-center justify-center mr-2">
                    <Text className="text-white font-bold text-[10px]">1</Text>
                  </View>
                  <Text className="text-white font-bold text-sm">Verify Collections</Text>
                </View>

                <View className="flex-row gap-3 mb-4">
                  <View className="flex-1 bg-success-500/10 p-3 rounded-xl items-center">
                    <Text className="text-success-500 font-bold text-lg">{lotteryStatus.paidCount}</Text>
                    <Text className="text-neutral-400 text-[10px]">Paid</Text>
                  </View>
                  <View className="flex-1 bg-danger-500/10 p-3 rounded-xl items-center">
                    <Text className="text-danger-500 font-bold text-lg">{lotteryStatus.unpaidCount}</Text>
                    <Text className="text-neutral-400 text-[10px]">Unpaid</Text>
                  </View>
                  <View className="flex-1 bg-neutral-500/10 p-3 rounded-xl items-center">
                    <Text className="text-neutral-400 font-bold text-lg">{lotteryStatus.alreadyWonCount}</Text>
                    <Text className="text-neutral-400 text-[10px]">Already Won</Text>
                  </View>
                </View>

                {/* Paid Members */}
                <Text className="text-success-500 font-bold text-xs mb-2">PAID MEMBERS</Text>
                {lotteryStatus.paidMembers.map((m: any) => (
                  <View key={m.memberId} className="flex-row items-center justify-between py-1.5">
                    <View className="flex-row items-center">
                      <View className="w-5 h-5 rounded-full bg-success-500/20 items-center justify-center mr-2">
                        <Ionicons name="checkmark" size={10} color="#4ade80" />
                      </View>
                      <Text className="text-neutral-300 text-xs">Slot #{m.slotNumber} - {m.name}</Text>
                    </View>
                    <Text className="text-success-500 text-[10px] font-semibold">{formatINR(m.amountPaidPaise)}</Text>
                  </View>
                ))}

                {/* Unpaid Members */}
                {lotteryStatus.unpaidMembers.length > 0 && (
                  <>
                    <Text className="text-danger-500 font-bold text-xs mt-3 mb-2">UNPAID MEMBERS</Text>
                    {lotteryStatus.unpaidMembers.map((m: any) => (
                      <View key={m.memberId} className="flex-row items-center justify-between py-1.5">
                        <View className="flex-row items-center">
                          <View className="w-5 h-5 rounded-full bg-danger-500/20 items-center justify-center mr-2">
                            <Ionicons name="close" size={10} color="#f87171" />
                          </View>
                          <Text className="text-neutral-300 text-xs">Slot #{m.slotNumber} - {m.name}</Text>
                        </View>
                        <Text className="text-danger-500 text-[10px] font-semibold">{formatINR(m.amountDuePaise)}</Text>
                      </View>
                    ))}
                  </>
                )}

                <TouchableOpacity
                  onPress={handleLockMembers}
                  disabled={lotteryLoading || lotteryStatus.paidCount === 0}
                  className={`h-11 rounded-xl items-center justify-center flex-row mt-4 ${
                    lotteryStatus.paidCount === 0 ? "bg-neutral-600" : "bg-brand-500"
                  }`}
                >
                  {lotteryLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="lock-closed-outline" size={16} color="#fff" />
                      <Text className="text-white font-bold ml-1.5 text-sm">
                        Lock {lotteryStatus.paidCount} Eligible Members
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </Card>
          )}

          {/* Stage 2: Locked - Ready to Draw */}
          {lotteryStatus?.existingPayout && !lotteryStatus.existingPayout.isCompleted && !lotteryDrawResult && !lotteryStatus.existingPayout.receiptNumber && (
            <Card style={{ marginBottom: 12 }} padding={0}>
              <View className="p-5">
                <View className="flex-row items-center mb-3">
                  <View className="w-6 h-6 rounded-full bg-gold-500 items-center justify-center mr-2">
                    <Text className="text-white font-bold text-[10px]">2</Text>
                  </View>
                  <Text className="text-white font-bold text-sm">Ready to Draw</Text>
                </View>

                <View className="bg-gold-500/5 p-3 rounded-xl border border-gold-500/10 mb-4">
                  <Text className="text-neutral-300 text-xs">
                    {(lotteryStatus.existingPayout.lockedMembers as any[])?.length || 0} members locked for lottery draw.
                    A winner will be randomly selected.
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={handleDrawWinner}
                  disabled={lotteryLoading}
                  className="bg-gold-500/80 h-11 rounded-xl items-center justify-center flex-row"
                >
                  {lotteryLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="flash-outline" size={16} color="#fff" />
                      <Text className="text-white font-bold ml-1.5 text-sm">Draw Winner</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </Card>
          )}

          {/* Stage 3: Winner Selected - Confirm Payout */}
          {lotteryDrawResult && (
            <Card style={{ marginBottom: 12 }} padding={0}>
              <View className="p-5">
                <View className="flex-row items-center mb-3">
                  <View className="w-6 h-6 rounded-full bg-success-500 items-center justify-center mr-2">
                    <Text className="text-white font-bold text-[10px]">3</Text>
                  </View>
                  <Text className="text-white font-bold text-sm">Winner Selected!</Text>
                </View>

                <View className="bg-success-500/5 p-4 rounded-xl border border-success-500/10 mb-4">
                  <View className="items-center">
                    <Text className="text-gold-500 text-3xl mb-1">🏆</Text>
                    <Text className="text-white font-bold text-lg">{lotteryDrawResult.winnerName}</Text>
                    <Text className="text-neutral-400 text-xs mt-0.5">Slot #{lotteryDrawResult.winnerSlot}</Text>
                  </View>
                  <View className="flex-row justify-between mt-4 pt-3 border-t border-success-500/10">
                    <View>
                      <Text className="text-neutral-400 text-[10px]">Payout</Text>
                      <Text className="text-gold-500 font-bold text-sm">{formatINR(lotteryDrawResult.payoutAmtPaise)}</Text>
                    </View>
                    <View className="items-center">
                      <Text className="text-neutral-400 text-[10px]">Commission</Text>
                      <Text className="text-white font-semibold text-sm">{formatINR(lotteryDrawResult.commissionPaise)}</Text>
                    </View>
                    <View className="items-end">
                      <Text className="text-neutral-400 text-[10px]">Total Pot</Text>
                      <Text className="text-white font-semibold text-sm">{formatINR(lotteryDrawResult.totalPot)}</Text>
                    </View>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={handleConfirmPayout}
                  disabled={lotteryLoading}
                  className="bg-success-500 h-11 rounded-xl items-center justify-center flex-row"
                >
                  {lotteryLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle-outline" size={16} color="#fff" />
                      <Text className="text-white font-bold ml-1.5 text-sm">Confirm & Process Payout</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </Card>
          )}

          {/* Receipt Modal */}
          {lotteryReceipt && (
            <Card style={{ marginBottom: 12 }} padding={0}>
              <View className="p-5">
                <View className="flex-row items-center justify-between mb-3">
                  <View className="flex-row items-center">
                    <Ionicons name="document-text-outline" size={18} color={COLORS.goldPrimary} />
                    <Text className="text-white font-bold text-sm ml-2">Receipt</Text>
                  </View>
                  <TouchableOpacity onPress={() => setLotteryReceipt(null)}>
                    <Ionicons name="close-outline" size={20} color="#a3a3a3" />
                  </TouchableOpacity>
                </View>

                <View className="bg-surface-bg border border-brand-primary/10 rounded-xl p-4">
                  <Text className="text-gold-500 font-bold text-center text-sm mb-3">{lotteryReceipt.receiptNumber}</Text>
                  <View className="border-t border-brand-primary/10 pt-3">
                    <View className="flex-row justify-between mb-2">
                      <Text className="text-neutral-400 text-xs">Committee</Text>
                      <Text className="text-white text-xs font-semibold">{lotteryReceipt.committeeName}</Text>
                    </View>
                    <View className="flex-row justify-between mb-2">
                      <Text className="text-neutral-400 text-xs">Cycle</Text>
                      <Text className="text-white text-xs font-semibold">#{lotteryReceipt.cycleNo}</Text>
                    </View>
                    <View className="flex-row justify-between mb-2">
                      <Text className="text-neutral-400 text-xs">Winner</Text>
                      <Text className="text-white text-xs font-semibold">{lotteryReceipt.winner.name} (Slot #{lotteryReceipt.winner.slot})</Text>
                    </View>
                    <View className="flex-row justify-between mb-2">
                      <Text className="text-neutral-400 text-xs">Total Pot</Text>
                      <Text className="text-white text-xs font-semibold">{formatINR(lotteryReceipt.totalPotPaise)}</Text>
                    </View>
                    <View className="flex-row justify-between mb-2">
                      <Text className="text-neutral-400 text-xs">Commission</Text>
                      <Text className="text-white text-xs font-semibold">{formatINR(lotteryReceipt.commissionPaise)}</Text>
                    </View>
                    <View className="flex-row justify-between mb-2">
                      <Text className="text-neutral-400 text-xs">Payout</Text>
                      <Text className="text-gold-500 text-xs font-bold">{formatINR(lotteryReceipt.payoutAmtPaise)}</Text>
                    </View>
                    <View className="flex-row justify-between">
                      <Text className="text-neutral-400 text-xs">Date</Text>
                      <Text className="text-white text-xs font-semibold">
                        {new Date(lotteryReceipt.payoutDate).toLocaleDateString("en-IN")}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </Card>
          )}

          {/* View Receipt buttons for past cycles */}
          {(committee.payoutCycles || [])
            .filter((pc: any) => pc.isCompleted && pc.receiptNumber)
            .sort((a: any, b: any) => b.cycleNo - a.cycleNo)
            .slice(0, 1)
            .map((pc: any) => (
              <TouchableOpacity
                key={pc.id}
                onPress={() => handleViewReceipt(pc.cycleNo)}
                className="bg-surface-card border border-brand-primary/10 h-11 rounded-xl items-center justify-center flex-row mb-2"
              >
                <Ionicons name="document-text-outline" size={16} color={COLORS.brandPrimary} />
                <Text className="text-brand-400 font-bold ml-1.5 text-sm">View Receipt - Cycle #{pc.cycleNo}</Text>
              </TouchableOpacity>
            ))}
        </View>
      )}

      {/* Lottery Status for Non-Organizer Members */}
      {committee.status === "ACTIVE" && committee.type === "FIXED_WINNER" && !isOrganizer && (
        <View className="mb-6">
          <Card style={{ marginBottom: 0 }} padding={0}>
            <View className="p-5 items-center">
              <Ionicons name="gift-outline" size={28} color={COLORS.goldPrimary} />
              <Text className="text-white font-bold text-sm mt-2">Lottery Committee</Text>
              <Text className="text-neutral-400 text-xs text-center mt-1">
                Winner is selected randomly by the organizer each cycle. Check back after the draw!
              </Text>
            </View>
          </Card>
        </View>
      )}

      {/* Payout Cycle History */}
      <Text className="text-white text-base font-bold mb-3">Payout & Dividend History</Text>
      <Card style={{ marginBottom: 20 }} padding={0}>
        <View className="p-5">
          <View className="flex-row border-b border-brand-primary/10 pb-2 mb-3">
            <Text className="w-14 text-neutral-400 font-bold text-xs">Cycle</Text>
            <Text className="flex-1 text-neutral-400 font-bold text-xs">Winner</Text>
            <Text className="w-24 text-right text-neutral-400 font-bold text-xs">Payout</Text>
          </View>

          {(committee.payoutCycles || [])
            .sort((a: any, b: any) => a.cycleNo - b.cycleNo)
            .map((item: any) => {
              const winnerName = committee.members?.find((m: any) => m.userId === item.winnerId)?.user?.name || "Winner";
              return (
                <View key={item.id} className="flex-row py-2.5 border-b border-brand-primary/5 items-center">
                  <Text className="w-14 text-white font-bold text-sm">#{item.cycleNo}</Text>
                  <Text className="flex-1 text-neutral-300 font-semibold text-sm">{winnerName}</Text>
                  <Text className="w-24 text-right text-gold-500 font-bold text-sm">
                    {formatINR(item.payoutAmtPaise)}
                  </Text>
                </View>
              );
            })}

          {(!committee.payoutCycles || committee.payoutCycles.length === 0) && (
            <Text className="text-center text-neutral-500 py-3 text-xs">No payout cycles resolved yet</Text>
          )}
        </View>
      </Card>

      {/* Monthly Schedule */}
      {schedule && schedule.length > 0 && (
        <>
          <Text className="text-white text-base font-bold mb-3">Monthly Schedule</Text>
          <Card style={{ marginBottom: 20 }} padding={0}>
            <View className="p-5">
              <View className="flex-row border-b border-brand-primary/10 pb-2 mb-3">
                <Text className="w-14 text-neutral-400 font-bold text-xs">Cycle</Text>
                <Text className="flex-1 text-neutral-400 font-bold text-xs">Due Date</Text>
                <Text className="w-20 text-right text-neutral-400 font-bold text-xs">Amount</Text>
                <Text className="w-20 text-right text-neutral-400 font-bold text-xs">Status</Text>
              </View>

              {schedule.map((item: any) => {
                const isCurrentCycle = item.cycleNo === committee.currentCycleNo;
                const isPaid = item.status === "PAID";
                const isOverdue = item.status === "OVERDUE";
                return (
                  <View
                    key={item.cycleNo}
                    className={`flex-row py-2.5 border-b border-brand-primary/5 items-center ${
                      isCurrentCycle ? "bg-brand-500/5" : ""
                    }`}
                  >
                    <Text className={`w-14 font-bold text-sm ${isCurrentCycle ? "text-brand-500" : "text-white"}`}>
                      #{item.cycleNo}
                    </Text>
                    <Text className="flex-1 text-neutral-300 font-semibold text-sm">
                      {new Date(item.dueDate).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </Text>
                    <Text className="w-20 text-right text-gold-500 font-bold text-sm">
                      {formatINR(item.amountDuePaise)}
                    </Text>
                    <View className="w-20 items-end">
                      <View
                        className={`px-2 py-0.5 rounded ${
                          isPaid
                            ? "bg-success-500/15"
                            : isOverdue
                            ? "bg-danger-500/15"
                            : "bg-neutral-500/15"
                        }`}
                      >
                        <Text
                          className={`text-[10px] font-bold ${
                            isPaid
                              ? "text-success-500"
                              : isOverdue
                              ? "text-danger-500"
                              : "text-neutral-400"
                          }`}
                        >
                          {item.status}
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
      <Text className="text-white text-base font-bold mb-3">Chit Members</Text>
      {committee.members?.map((member: any) => (
        <View
          key={member.id}
          className="flex-row items-center justify-between bg-surface-card border border-brand-primary/5 rounded-xl p-3.5 mb-2.5"
        >
          <View className="flex-row items-center">
            <View className="w-7 h-7 rounded-full bg-brand-primary/10 border border-brand-primary/20 items-center justify-center mr-3">
              <Text className="text-brand-500 font-bold text-xs">{member.slotNumber}</Text>
            </View>
            <View>
              <Text className="text-white font-bold text-sm">
                {member.user?.name} {member.userId === currentUser?.id && "(You)"}
              </Text>
              <Text className="text-neutral-500 text-[10px] mt-0.5">{member.user?.phone}</Text>
            </View>
          </View>

          <Badge
            label={member.hasReceivedPayout ? "Payout Received" : committee.type === "FIXED_WINNER" ? "Eligible for Draw" : "Eligible to Bid"}
            variant={member.hasReceivedPayout ? "success" : "info"}
          />
        </View>
      ))}
    </ScrollView>
  );
}
