// src/app/(app)/member/committee/[committeeId]/bid/index.tsx
// Place Bid Screen — real-time validation, live preview, confirmation
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { committeesApi } from "../../../../../../services/committees.api";
import { useAuthStore } from "../../../../../../stores/auth.store";
import { formatINR } from "../../../../../../utils/currency";
import { COLORS } from "../../../../../../constants/theme";
import Card from "../../../../../../components/ui/Card";
import Badge from "../../../../../../components/ui/Badge";
import Button from "../../../../../../components/ui/Button";

const F = (p: number | bigint | null | undefined) => formatINR(p ?? 0);

export default function PlaceBidScreen() {
  const { committeeId: rawId } = useLocalSearchParams<{ committeeId: string }>();
  const committeeId = Array.isArray(rawId) ? rawId[0] : rawId;
  const isValidId = !!committeeId && committeeId !== "undefined" && committeeId !== "null";
  const router = useRouter();
  const currentUser = useAuthStore((s: any) => s.user);

  const [committee, setCommittee] = useState<any>(null);
  const [monthsData, setMonthsData] = useState<any>(null);
  const [monthDetail, setMonthDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bidInput, setBidInput] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);

  const loadData = useCallback(async () => {
    if (!isValidId) return;
    setError(null);
    try {
      const [cRes, mRes] = await Promise.allSettled([
        committeesApi.getById(committeeId),
        committeesApi.getMonths(committeeId),
      ]);

      if (cRes.status === "fulfilled") setCommittee(cRes.value.data.data);
      else { setError("Failed to load committee."); setLoading(false); return; }

      if (mRes.status === "fulfilled") {
        setMonthsData(mRes.value.data.data);
        const months = mRes.value.data.data?.months || [];
        if (months.length > 0) {
          const latest = months[months.length - 1];
          if (latest?.id && latest.status === "bidding_open") {
            try {
              const dRes = await committeesApi.getMonth(committeeId, latest.id);
              setMonthDetail(dRes.data.data);
            } catch {}
          }
        }
      }
    } catch {
      setError("Failed to load data.");
    } finally {
      setLoading(false);
    }
  }, [committeeId, isValidId]);

  useEffect(() => {
    if (isValidId) loadData();
    else { setLoading(false); setError("Invalid committee ID"); }
  }, [isValidId, loadData]);

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

  if (loading) {
    return (
      <View className="flex-1 bg-surface-950 items-center justify-center">
        <ActivityIndicator size="large" color={COLORS.brandPrimary} />
        <Text className="text-neutral-500 text-sm mt-4">Loading bid screen...</Text>
      </View>
    );
  }

  if (error || !committee) {
    return (
      <View className="flex-1 bg-surface-950 items-center justify-center px-6">
        <Ionicons name="cloud-offline-outline" size={40} color={COLORS.warning.light} />
        <Text className="text-white font-bold text-lg mt-4">{error || "Committee not found"}</Text>
        <TouchableOpacity onPress={loadData} className="mt-4 bg-brand-500 px-5 py-2.5 rounded-xl">
          <Text className="text-white font-bold text-sm">Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const members: any[] = committee.members || [];
  const months: any[] = monthsData?.months || [];
  const totalSlots = committee.totalSlots || 0;
  const installment = Number(committee.installmentAmountPaise || 0); // paise
  const totalPool = installment * totalSlots; // paise
  const totalMembers = monthsData?.totalMembers || totalSlots;
  const remainingNonWinners = totalMembers - (months.filter((m: any) => m.status === "completed").length);

  // Backend formulas (all in paise):
  // interestAmount     = 0.02 * contributionPerPerson * remainingNonWinners
  // maxBidAllowed      = totalPool - interestAmount
  // remainingBalance   = totalPool - winningBidAmount
  // distributableAmount = remainingBalance + interestAmount
  // perMemberDistribution = distributableAmount / totalMembers
  const interestAmount = installment * 0.02 * remainingNonWinners; // paise
  const maxBidAllowed = totalPool - interestAmount; // paise

  const myMembership = members.find((m: any) => m.userId === currentUser?.id);
  const myMemberId = myMembership?.id;
  const hasWon = myMembership?.hasReceivedPayout === true;

  // Current month
  const currentMonth = monthDetail;
  const bids: any[] = currentMonth?.bids || [];
  const sortedBids = [...bids].sort((a: any, b: any) => (a.bidAmount || 0) - (b.bidAmount || 0));
  const lowestBid = sortedBids.length > 0 ? sortedBids[0] : null;
  const myBid = bids.find((b: any) => b.committeeMemberId === myMemberId);
  const otherBids = bids.filter((b: any) => b.committeeMemberId !== myMemberId);

  // Parse bid input (user types in rupees, we store in paise)
  const bidRupees = parseFloat(bidInput) || 0;
  const bidPaise = Math.round(bidRupees * 100);

  // Real-time validation (all in paise for comparison, matches backend rules)
  const bidError = bidPaise > 0 && bidPaise > maxBidAllowed
    ? `Maximum bid is ${F(maxBidAllowed)}`
    : null;

  // Live preview calculations (all in paise)
  // If user wins with this bid:
  const remainingBalance = totalPool - bidPaise; // paise
  const distributableAmount = remainingBalance + interestAmount; // paise
  const perMemberDistribution = totalMembers > 0 ? distributableAmount / totalMembers : 0; // paise

  // Savings comparison
  const savingsForOthers = totalPool - bidPaise;
  const savingsVsLowest = lowestBid ? lowestBid.bidAmount - bidPaise : 0;
  const isLowerThanLowest = lowestBid ? bidPaise > 0 && bidPaise < lowestBid.bidAmount : false;
  const savingsPercentage = totalPool > 0 ? ((savingsForOthers / totalPool) * 100) : 0;

  const canSubmit = bidPaise > 0 && !bidError && !hasWon && currentMonth?.status === "bidding_open";

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setShowConfirm(true);
  };

  const confirmSubmit = async () => {
    if (!committeeId || !currentMonth?.id) return;
    try {
      setSubmitting(true);
      setShowConfirm(false);
      await committeesApi.placeBid(committeeId, currentMonth.id, myMemberId, bidPaise);
      Alert.alert("Bid Placed!", `Your bid of ${F(bidPaise)} has been recorded.`, [
        { text: "OK", onPress: () => loadData() },
      ]);
      setBidInput("");
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.message || "Failed to place bid. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelBid = async () => {
    if (!committeeId || !currentMonth?.id || !myBid) return;
    Alert.alert("Cancel Bid?", "Are you sure you want to cancel your bid?", [
      { text: "No", style: "cancel" },
      {
        text: "Yes, Cancel",
        style: "destructive",
        onPress: async () => {
          try {
            setSubmitting(true);
            await committeesApi.placeBid(committeeId, currentMonth.id, myMemberId, 0);
            Alert.alert("Bid Cancelled", "Your bid has been removed.");
            setBidInput("");
            loadData();
          } catch {
            Alert.alert("Error", "Failed to cancel bid.");
          } finally {
            setSubmitting(false);
          }
        },
      },
    ]);
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-surface-950"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{ paddingTop: 64, paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
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
            <Text className="text-white text-xl font-bold">Place Your Bid</Text>
            <Text className="text-neutral-400 text-xs">{committee.name}</Text>
          </View>
          {myBid && (
            <Badge label="Bid Active" variant="success" size="sm" />
          )}
        </View>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* Pool & Max Bid Info                                                */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <View className="px-4 mb-5">
          <Card gradient>
            <View className="flex-row items-center justify-between mb-3">
              <View>
                <Text className="text-neutral-400 text-[10px] uppercase font-bold tracking-wider">Total Pool</Text>
                <Text className="text-brand-400 font-extrabold text-2xl mt-0.5">{F(totalPool)}</Text>
              </View>
              <View className="items-end">
                <Text className="text-neutral-400 text-[10px] uppercase font-bold tracking-wider">Your Max Bid</Text>
                <Text className="text-gold-400 font-extrabold text-2xl mt-0.5">{F(maxBidAllowed)}</Text>
              </View>
            </View>

            <View className="bg-surface-950 rounded-xl p-3">
              <View className="flex-row items-center">
                <Ionicons name="bulb-outline" size={16} color={COLORS.goldPrimary} />
                <Text className="text-neutral-300 text-xs ml-2 flex-1">
                  If you bid LOW, everyone gets MORE in distribution. Strategise wisely!
                </Text>
              </View>
            </View>
          </Card>
        </View>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* Lowest Bid Strategy Card                                           */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <View className="px-4 mb-5">
          <View className="flex-row items-center mb-3">
            <View className="w-7 h-7 rounded-lg bg-gold-500/15 items-center justify-center mr-2">
              <Ionicons name="trending-down-outline" size={14} color={COLORS.goldPrimary} />
            </View>
            <Text className="text-white font-bold text-sm">Lowest Bid Strategy</Text>
          </View>

          <Card gradient>
            {lowestBid ? (
              <View>
                <View className="flex-row items-center justify-between mb-3">
                  <View>
                    <Text className="text-neutral-400 text-[10px] uppercase font-bold tracking-wider">Current Lowest Bid</Text>
                    <Text className="text-gold-400 font-extrabold text-xl mt-0.5">
                      {F(lowestBid.bidAmount)}
                    </Text>
                  </View>
                  <View className="w-12 h-12 rounded-full bg-gold-500/15 items-center justify-center">
                    <Ionicons name="trophy-outline" size={22} color={COLORS.goldPrimary} />
                  </View>
                </View>

                <View className="bg-surface-950 rounded-xl p-3 mb-2">
                  <View className="flex-row items-center mb-2">
                    <Ionicons name="information-circle-outline" size={14} color={COLORS.info.light} />
                    <Text className="text-neutral-300 text-xs ml-2 font-semibold">How the auction works</Text>
                  </View>
                  <Text className="text-neutral-400 text-[11px] leading-5">
                    The LOWEST bidder wins the full pool. If you bid {F(lowestBid.bidAmount)}, the winner takes {F(lowestBid.bidAmount)} and each member gets a share of the remaining {F(totalPool - lowestBid.bidAmount)}.
                  </Text>
                </View>

                {/* Bid comparison when user is typing */}
                {bidPaise > 0 && !bidError && (
                  <View className={`rounded-xl p-3 ${isLowerThanLowest ? "bg-success-500/10" : "bg-warning-500/10"}`}>
                    <View className="flex-row items-center mb-1.5">
                      {isLowerThanLowest ? (
                        <Ionicons name="checkmark-circle-outline" size={14} color={COLORS.success.light} />
                      ) : (
                        <Ionicons name="alert-circle-outline" size={14} color={COLORS.warning.light} />
                      )}
                      <Text className={`text-xs ml-1.5 font-bold ${isLowerThanLowest ? "text-success-400" : "text-warning-400"}`}>
                        {isLowerThanLowest ? "You will be the new lowest!" : "You need to go lower to win"}
                      </Text>
                    </View>
                    <View className="flex-row justify-between">
                      <Text className="text-neutral-400 text-[10px]">Difference from lowest</Text>
                      <Text className={`text-xs font-bold ${isLowerThanLowest ? "text-success-400" : "text-danger-400"}`}>
                        {savingsVsLowest > 0 ? `-${F(savingsVsLowest)}` : `+${F(Math.abs(savingsVsLowest))}`}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            ) : (
              <View className="items-center py-4">
                <Ionicons name="eye-outline" size={24} color={COLORS.text.muted} />
                <Text className="text-neutral-500 text-xs mt-2 text-center">No bids yet. You could be the first!</Text>
              </View>
            )}
          </Card>
        </View>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* All Bids                                                           */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {otherBids.length > 0 && (
          <View className="px-4 mb-5">
            <View className="flex-row items-center mb-3">
              <View className="w-7 h-7 rounded-lg bg-brand-500/15 items-center justify-center mr-2">
                <Ionicons name="list-outline" size={14} color={COLORS.brandPrimary} />
              </View>
              <Text className="text-white font-bold text-sm">All Bids</Text>
              <Text className="text-neutral-500 text-xs ml-2">{bids.length} bid{bids.length !== 1 ? "s" : ""}</Text>
            </View>

            <Card padding={0}>
              <View className="p-3.5">
                {sortedBids.map((bid: any, i: number) => {
                  const bidder = members.find((m: any) => m.id === bid.committeeMemberId);
                  const isMe = bid.committeeMemberId === myMemberId;
                  const isLowest = i === 0;
                  return (
                    <View key={bid.id} className={`flex-row items-center py-2.5 ${i < sortedBids.length - 1 ? "border-b border-brand-primary/5" : ""}`}>
                      <View className={`w-8 h-8 rounded-full items-center justify-center mr-3 ${isLowest ? "bg-gold-500/15" : "bg-surface-elevated"}`}>
                        {isLowest ? (
                          <Ionicons name="trophy-outline" size={14} color={COLORS.goldPrimary} />
                        ) : (
                          <Text className="text-neutral-500 text-[10px] font-bold">{i + 1}</Text>
                        )}
                      </View>
                      <View className="flex-1">
                        <Text className={`text-xs ${isMe ? "text-brand-400 font-bold" : "text-white"}`}>
                          {bidder?.user?.name || "Member"}{isMe ? " (You)" : ""}
                        </Text>
                        <Text className="text-neutral-500 text-[10px]">
                          {isLowest ? "Currently winning" : `#${i + 1} bid`}
                        </Text>
                      </View>
                      <View className="items-end">
                        <Text className={`text-xs font-bold ${isLowest ? "text-gold-400" : "text-neutral-300"}`}>
                          {F(bid.bidAmount)}
                        </Text>
                        <Text className="text-neutral-500 text-[9px]">
                          {((bid.bidAmount / totalPool) * 100).toFixed(1)}% of pool
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </Card>
          </View>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* Bid Input                                                          */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {!hasWon && currentMonth?.status === "bidding_open" && (
          <View className="px-4 mb-5">
            <View className="flex-row items-center mb-3">
              <View className="w-7 h-7 rounded-lg bg-brand-500/15 items-center justify-center mr-2">
                <Ionicons name="create-outline" size={14} color={COLORS.brandPrimary} />
              </View>
              <Text className="text-white font-bold text-sm">Your Bid Amount</Text>
            </View>

            <Card>
              <View className="mb-4">
                <Text className="text-neutral-400 text-xs mb-2">Enter your bid (in ₹)</Text>
                <View className={`flex-row items-center bg-surface-950 rounded-xl px-4 h-14 border ${bidError ? "border-danger-400" : bidPaise > 0 ? "border-brand-primary/40" : "border-brand-primary/20"}`}>
                  <Text className="text-brand-400 font-bold text-lg mr-2">₹</Text>
                  <TextInput
                    value={bidInput}
                    onChangeText={(t) => {
                      // Allow only numbers and one decimal
                      const cleaned = t.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");
                      setBidInput(cleaned);
                    }}
                    placeholder="0"
                    placeholderTextColor="#525252"
                    keyboardType="decimal-pad"
                    className="flex-1 text-white font-bold text-lg"
                  />
                  {bidInput.length > 0 && (
                    <TouchableOpacity onPress={() => setBidInput("")}>
                      <Ionicons name="close-circle" size={18} color={COLORS.text.muted} />
                    </TouchableOpacity>
                  )}
                </View>
                {bidError && (
                  <Text className="text-danger-400 text-xs mt-1.5">{bidError}</Text>
                )}
              </View>

              {/* Quick bid buttons (set input in RUPEES) */}
              <View className="flex-row gap-2 mb-4">
                {[0.6, 0.7, 0.8, 0.9].map((pct) => {
                  const amtPaise = Math.round(totalPool * pct);
                  const amtRupees = Math.round(amtPaise / 100);
                  return (
                    <TouchableOpacity
                      key={pct}
                      onPress={() => setBidInput(String(amtRupees))}
                      className="flex-1 bg-brand-500/10 rounded-lg py-2 items-center"
                    >
                      <Text className="text-brand-400 text-[10px] font-bold">{Math.round(pct * 100)}%</Text>
                      <Text className="text-neutral-400 text-[9px]">{F(amtPaise)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Submit */}
              {myBid ? (
                <View className="flex-row gap-3">
                  <View style={{ flex: 1 }}>
                    <Button
                      label={submitting ? "Updating..." : "Update Bid"}
                      variant="primary"
                      onPress={handleSubmit}
                      isLoading={submitting}
                      disabled={!canSubmit}
                    />
                  </View>
                  <TouchableOpacity
                    onPress={handleCancelBid}
                    disabled={submitting}
                    className="w-14 h-14 bg-danger-500/15 rounded-xl items-center justify-center"
                  >
                    <Ionicons name="trash-outline" size={20} color={COLORS.danger.light} />
                  </TouchableOpacity>
                </View>
              ) : (
                <Button
                  label={submitting ? "Placing Bid..." : "Submit Bid"}
                  variant="primary"
                  onPress={handleSubmit}
                  isLoading={submitting}
                  disabled={!canSubmit}
                  icon={!submitting ? <Ionicons name="checkmark-circle-outline" size={18} color="#fff" /> : undefined}
                />
              )}
            </Card>
          </View>
        )}

        {/* Already won notice */}
        {hasWon && (
          <View className="px-4 mb-5">
            <Card>
              <View className="items-center py-4">
                <Ionicons name="checkmark-done-circle-outline" size={32} color={COLORS.success.light} />
                <Text className="text-white font-bold text-sm mt-2">You have already received a payout</Text>
                <Text className="text-neutral-500 text-xs mt-1 text-center">
                  You are not eligible to bid in future months. Thank you for participating!
                </Text>
              </View>
            </Card>
          </View>
        )}

        {/* Bidding closed notice */}
        {currentMonth?.status !== "bidding_open" && !hasWon && (
          <View className="px-4 mb-5">
            <Card>
              <View className="items-center py-4">
                <Ionicons name="pause-circle-outline" size={32} color={COLORS.warning.light} />
                <Text className="text-white font-bold text-sm mt-2">Bidding is not open</Text>
                <Text className="text-neutral-500 text-xs mt-1 text-center">
                  Wait for the organiser to open bidding for the next month.
                </Text>
              </View>
            </Card>
          </View>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* Live Preview (shown when typing valid bid)                         */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {bidRupees > 0 && !bidError && (
          <View className="px-4 mb-5">
            <View className="flex-row items-center mb-3">
              <View className="w-7 h-7 rounded-lg bg-success-500/15 items-center justify-center mr-2">
                <Ionicons name="calculator-outline" size={14} color={COLORS.success.light} />
              </View>
              <Text className="text-white font-bold text-sm">Live Preview</Text>
              {isLowerThanLowest && (
                <View className="ml-2 bg-success-500/15 px-2 py-0.5 rounded-full">
                  <Text className="text-success-400 text-[9px] font-bold">LOWEST</Text>
                </View>
              )}
            </View>

            <Card gradient>
              <View className="mb-4">
                <View className="flex-row justify-between items-center mb-2">
                  <Text className="text-neutral-400 text-xs">Your payout if you win</Text>
                  <Text className="text-brand-400 font-extrabold text-lg">{F(bidPaise)}</Text>
                </View>
                <View className="flex-row justify-between items-center">
                  <Text className="text-neutral-400 text-xs">Interest you will owe if you win</Text>
                  <Text className="text-warning-400 font-bold text-sm">{F(interestAmount)}</Text>
                </View>
              </View>

              {/* Savings visualization */}
              <View className="bg-surface-950 rounded-xl p-3 mb-3">
                <View className="flex-row justify-between items-center mb-2">
                  <Text className="text-neutral-400 text-xs font-semibold">You save for others</Text>
                  <Text className="text-success-400 font-extrabold text-lg">{F(savingsForOthers)}</Text>
                </View>
                {/* Savings bar */}
                <View className="h-2.5 bg-surface-elevated rounded-full overflow-hidden mb-1.5">
                  <LinearGradient
                    colors={["#22c55e", "#4ade80"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={{ width: `${savingsPercentage}%`, height: "100%", borderRadius: 9999 }}
                  />
                </View>
                <Text className="text-neutral-500 text-[10px] text-right">
                  {savingsPercentage.toFixed(1)}% of pool saved for distribution
                </Text>
              </View>

              {/* Distribution preview */}
              <View className="flex-row justify-between items-center py-2 border-t border-brand-primary/5">
                <Text className="text-neutral-400 text-xs">Estimated distribution each</Text>
                <Text className="text-success-400 font-bold text-sm">{F(perMemberDistribution)}</Text>
              </View>
            </Card>
          </View>
        )}
      </ScrollView>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* Confirmation Modal                                                 */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {showConfirm && (
        <View className="absolute inset-0 bg-black/60 items-center justify-center px-6" style={{ zIndex: 50 }}>
          <Card style={{ width: "100%", maxWidth: 360 }}>
            <View className="items-center mb-4">
              <View className="w-14 h-14 rounded-full bg-brand-500/15 items-center justify-center mb-3">
                <Ionicons name="hammer" size={28} color={COLORS.brandPrimary} />
              </View>
              <Text className="text-white font-bold text-lg text-center">Confirm Your Bid</Text>
              {isLowerThanLowest && (
                <Badge label="New Lowest Bid" variant="success" size="sm" style={{ marginTop: 8 }} />
              )}
            </View>

            <View className="bg-surface-950 rounded-xl p-4 mb-4">
              <View className="flex-row justify-between mb-2">
                <Text className="text-neutral-400 text-sm">Your Bid</Text>
                <Text className="text-brand-400 font-bold text-lg">{F(bidPaise)}</Text>
              </View>
              <View className="flex-row justify-between mb-2">
                <Text className="text-neutral-400 text-sm">Total Pool</Text>
                <Text className="text-white font-semibold text-sm">{F(totalPool)}</Text>
              </View>
              <View className="flex-row justify-between mb-2">
                <Text className="text-neutral-400 text-sm">Savings for others</Text>
                <Text className="text-success-400 font-semibold text-sm">{F(totalPool - bidPaise)}</Text>
              </View>
              {lowestBid && (
                <View className="flex-row justify-between">
                  <Text className="text-neutral-400 text-sm">Current lowest</Text>
                  <Text className="text-gold-400 font-semibold text-sm">{F(lowestBid.bidAmount)}</Text>
                </View>
              )}
            </View>

            <Text className="text-neutral-500 text-xs text-center mb-4">
              This bid cannot be changed once bidding closes. You can edit or cancel before then.
            </Text>

            <View className="flex-row gap-3">
              <View style={{ flex: 1 }}>
                <Button
                  label="Cancel"
                  variant="ghost"
                  onPress={() => setShowConfirm(false)}
                  disabled={submitting}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  label={`Confirm Bid of ₹${bidRupees}`}
                  variant="primary"
                  onPress={confirmSubmit}
                  isLoading={submitting}
                />
              </View>
            </View>
          </Card>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}
