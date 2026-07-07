// src/app/(app)/member/committee/[committeeId]/bid/index.tsx
// Place Bid Screen — real-time validation, live preview, confirmation
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { committeesApi } from "../../../../../../services/committees.api";
import { useAuthStore } from "../../../../../../stores/auth.store";
import BrandedLoader from "../../../../../../components/brand/BrandedLoader";
import { useCommitteeStore } from "../../../../../../stores/committee.store";
import { formatINR } from "../../../../../../utils/currency";
import { COLORS, SHADOWS, BORDER_RADIUS, SPACING } from "../../../../../../constants/theme";
import Card from "../../../../../../components/ui/Card";
import Badge from "../../../../../../components/ui/Badge";
import Button from "../../../../../../components/ui/Button";
import ScreenHeader from "../../../../../../components/shared/ScreenHeader";
import { useAlertModal } from "../../../../../../components/ui/AlertModal";

const F = (p: number | bigint | null | undefined) => formatINR(p ?? 0);

export default function PlaceBidScreen() {
  const { committeeId: rawId } = useLocalSearchParams<{ committeeId: string }>();
  const committeeId = Array.isArray(rawId) ? rawId[0] : rawId;
  const isValidId = !!committeeId && committeeId !== "undefined" && committeeId !== "null";
  const router = useRouter();
  const currentUser = useAuthStore((s: any) => s.user);
  const { alert, confirm, AlertComponent } = useAlertModal();

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

  // Instant refresh when socket events fire (other bids placed, bidding opened/resolved)
  const bidVersion = useCommitteeStore((s) => s.bidPlacedVersion);
  const biddingVersion = useCommitteeStore((s) => s.biddingOpenedVersion);
  const resolvedVersion = useCommitteeStore((s) => s.monthResolvedVersion);
  const socketVersionSum = bidVersion + biddingVersion + resolvedVersion;
  const lastSocketVersion = useRef(0);
  const pendingBidRefresh = useRef(false);
  useEffect(() => {
    if (socketVersionSum > 0 && socketVersionSum !== lastSocketVersion.current) {
      lastSocketVersion.current = socketVersionSum;
      if (bidInput.length > 0) {
        pendingBidRefresh.current = true;
      } else {
        loadData();
      }
    }
  }, [socketVersionSum, loadData, bidInput.length]);

  // Flush pending refresh when user clears bid input
  useEffect(() => {
    if (bidInput.length === 0 && pendingBidRefresh.current) {
      pendingBidRefresh.current = false;
      loadData();
    }
  }, [bidInput.length, loadData]);

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

  if (loading) {
    return <BrandedLoader message="Loading bid screen..." />;
  }

  if (error || !committee) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.surface.bg, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 }}>
        <Ionicons name="cloud-offline-outline" size={40} color={COLORS.warning.light} />
        <Text style={{ color: COLORS.text.primary, fontWeight: "700", fontSize: 18, marginTop: 16 }}>{error || "Committee not found"}</Text>
        <TouchableOpacity onPress={loadData} style={{ backgroundColor: COLORS.brand[500], paddingHorizontal: 20, paddingVertical: 10, borderRadius: BORDER_RADIUS.xl, marginTop: 16 }}>
          <Text style={{ color: COLORS.white, fontWeight: "700", fontSize: 13 }}>Retry</Text>
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
      await alert("Bid Placed!", `Your bid of ${F(bidPaise)} has been recorded.`);
      loadData();
      setBidInput("");
    } catch (err: any) {
      await alert("Error", err?.response?.data?.message || "Failed to place bid. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelBid = async () => {
    if (!committeeId || !currentMonth?.id || !myBid) return;
    const ok = await confirm("Cancel Bid?", "Are you sure you want to cancel your bid?");
    if (ok) {
      try {
        setSubmitting(true);
        await committeesApi.placeBid(committeeId, currentMonth.id, myMemberId, 0);
        await alert("Bid Cancelled", "Your bid has been removed.");
        setBidInput("");
        loadData();
      } catch {
        await alert("Error", "Failed to cancel bid.");
      } finally {
        setSubmitting(false);
      }
    }
  };

  return (
    <>
    <KeyboardAvoidingView
      className="flex-1 bg-surface-50"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{ paddingTop: 0, paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
      >
        <ScreenHeader
          title="Place Your Bid"
          subtitle={committee.name}
          brand
          rightElement={myBid ? <Badge label="Bid Active" variant="success" size="sm" dot /> : undefined}
        />

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* Pool & Max Bid Info                                                */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <View style={{ paddingHorizontal: SPACING[5], marginBottom: SPACING[5] }}>
          <Card gradient>
            <View className="flex-row items-center justify-between mb-3">
              <View>
                <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 }}>Total Pool</Text>
                <Text style={{ color: COLORS.white, fontWeight: "800", fontSize: 24, marginTop: 2 }}>{F(totalPool)}</Text>
              </View>
              <View className="items-end">
                <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 }}>Your Max Bid</Text>
                <Text style={{ color: COLORS.gold[300], fontWeight: "800", fontSize: 24, marginTop: 2 }}>{F(maxBidAllowed)}</Text>
              </View>
            </View>

            <View style={{ backgroundColor: "rgba(255,255,255,0.10)", borderRadius: BORDER_RADIUS.xl, padding: 12 }}>
              <View className="flex-row items-center">
                <Ionicons name="bulb-outline" size={16} color="#fbbf24" />
                <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 11, marginLeft: 8, flex: 1 }}>
                  If you bid LOW, everyone gets MORE in distribution. Strategise wisely!
                </Text>
              </View>
            </View>
          </Card>
        </View>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* Lowest Bid Strategy Card                                           */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <View style={{ paddingHorizontal: SPACING[5], marginBottom: SPACING[5] }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <View style={{ width: 4, height: 20, borderRadius: 999, backgroundColor: COLORS.gold[500] }} />
            <Text style={{ color: COLORS.text.primary, fontSize: 14, fontWeight: "700" }}>Lowest Bid Strategy</Text>
          </View>

          <Card gradient>
            {lowestBid ? (
              <View>
                <View className="flex-row items-center justify-between mb-3">
                  <View>
                    <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 }}>Current Lowest Bid</Text>
                    <Text style={{ color: COLORS.gold[300], fontWeight: "800", fontSize: 20, marginTop: 2 }}>
                      {F(lowestBid.bidAmount)}
                    </Text>
                  </View>
                  <View style={{ width: 48, height: 48, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.10)", alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="trophy-outline" size={22} color="#fbbf24" />
                  </View>
                </View>

                <View style={{ backgroundColor: "rgba(255,255,255,0.10)", borderRadius: BORDER_RADIUS.xl, padding: 12, marginBottom: 8 }}>
                  <View className="flex-row items-center mb-2">
                    <Ionicons name="information-circle-outline" size={14} color="#67e8f9" />
                    <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 11, marginLeft: 8, fontWeight: "600" }}>How the auction works</Text>
                  </View>
                  <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 11, lineHeight: 18 }}>
                    The LOWEST bidder wins the full pool. If you bid {F(lowestBid.bidAmount)}, the winner takes {F(lowestBid.bidAmount)} and each member gets a share of the remaining {F(totalPool - lowestBid.bidAmount)}.
                  </Text>
                </View>

                {/* Bid comparison when user is typing */}
                {bidPaise > 0 && !bidError && (
                  <View style={{
                    borderRadius: BORDER_RADIUS.xl, padding: 12,
                    backgroundColor: isLowerThanLowest ? "rgba(22,163,74,0.10)" : "rgba(217,119,6,0.10)",
                  }}>
                    <View className="flex-row items-center mb-1.5">
                      {isLowerThanLowest ? (
                        <Ionicons name="checkmark-circle-outline" size={14} color={COLORS.success.light} />
                      ) : (
                        <Ionicons name="alert-circle-outline" size={14} color={COLORS.warning.light} />
                      )}
                      <Text style={{ color: isLowerThanLowest ? COLORS.success.dark : COLORS.warning.dark, fontSize: 11, marginLeft: 6, fontWeight: "700" }}>
                        {isLowerThanLowest ? "You will be the new lowest!" : "You need to go lower to win"}
                      </Text>
                    </View>
                    <View className="flex-row justify-between">
                      <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 10 }}>Difference from lowest</Text>
                      <Text style={{ color: isLowerThanLowest ? COLORS.success.dark : COLORS.danger.dark, fontSize: 11, fontWeight: "700" }}>
                        {savingsVsLowest > 0 ? `-${F(savingsVsLowest)}` : `+${F(Math.abs(savingsVsLowest))}`}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            ) : (
              <View className="items-center py-4">
                <Ionicons name="eye-outline" size={24} color="rgba(255,255,255,0.5)" />
                <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, marginTop: 8, textAlign: "center" }}>No bids yet. You could be the first!</Text>
              </View>
            )}
          </Card>
        </View>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* All Bids                                                           */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {otherBids.length > 0 && (
          <View style={{ paddingHorizontal: SPACING[5], marginBottom: SPACING[5] }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <View style={{ width: 4, height: 20, borderRadius: 999, backgroundColor: COLORS.brand[500] }} />
              <Text style={{ color: COLORS.text.primary, fontSize: 14, fontWeight: "700" }}>All Bids</Text>
              <View style={{ marginLeft: 8 }}>
                <Text style={{ color: COLORS.text.secondary, fontSize: 11 }}>{bids.length} bid{bids.length !== 1 ? "s" : ""}</Text>
              </View>
            </View>

            <Card padding={0} style={SHADOWS.cardSm}>
              <View style={{ padding: 14 }}>
                {sortedBids.map((bid: any, i: number) => {
                  const bidder = members.find((m: any) => m.id === bid.committeeMemberId);
                  const isMe = bid.committeeMemberId === myMemberId;
                  const isLowest = i === 0;
                  return (
                    <View key={bid.id} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: i < sortedBids.length - 1 ? 1 : 0, borderBottomColor: COLORS.surface.border }}>
                      <View style={{
                        width: 32, height: 32, borderRadius: 999, alignItems: "center", justifyContent: "center", marginRight: 12,
                        backgroundColor: isLowest ? "rgba(245,158,11,0.12)" : COLORS.surface.warm,
                      }}>
                        {isLowest ? (
                          <Ionicons name="trophy-outline" size={14} color={COLORS.goldPrimary} />
                        ) : (
                          <Text style={{ color: COLORS.text.secondary, fontSize: 10, fontWeight: "700" }}>{i + 1}</Text>
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: isMe ? COLORS.brand[600] : COLORS.text.primary, fontSize: 11, fontWeight: isMe ? "700" : "400" }}>
                          {bidder?.user?.name || "Member"}{isMe ? " (You)" : ""}
                        </Text>
                        <Text style={{ color: COLORS.text.secondary, fontSize: 10 }}>
                          {isLowest ? "Currently winning" : `#${i + 1} bid`}
                        </Text>
                      </View>
                      <View className="items-end">
                        <Text style={{ color: isLowest ? COLORS.gold[600] : COLORS.text.secondary, fontSize: 11, fontWeight: "700" }}>
                          {F(bid.bidAmount)}
                        </Text>
                        <Text style={{ color: COLORS.text.secondary, fontSize: 9 }}>
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
          <View style={{ paddingHorizontal: SPACING[5], marginBottom: SPACING[5] }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <View style={{ width: 4, height: 20, borderRadius: 999, backgroundColor: COLORS.brand[500] }} />
              <Text style={{ color: COLORS.text.primary, fontSize: 14, fontWeight: "700" }}>Your Bid Amount</Text>
            </View>

            <Card style={SHADOWS.cardSm} accent="brand">
              <View className="mb-4">
                <Text style={{ color: COLORS.text.muted, fontSize: 11, marginBottom: 8 }}>Enter your bid (in ₹)</Text>
                <View style={{
                  flexDirection: "row", alignItems: "center",
                  backgroundColor: COLORS.surface.warm,
                  borderRadius: BORDER_RADIUS.xl,
                  paddingHorizontal: 16, height: 56,
                  borderWidth: 1,
                  borderColor: bidError ? COLORS.danger.DEFAULT : bidPaise > 0 ? COLORS.brand[300] : COLORS.surface.border,
                }}>
                  <Text style={{ color: COLORS.brand[600], fontWeight: "700", fontSize: 18, marginRight: 8 }}>₹</Text>
                  <TextInput
                    value={bidInput}
                    onChangeText={(t) => {
                      // Allow only numbers and one decimal
                      const cleaned = t.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");
                      setBidInput(cleaned);
                    }}
                    placeholder="0"
                    placeholderTextColor={COLORS.text.muted}
                    keyboardType="decimal-pad"
                    style={{ flex: 1, color: COLORS.text.primary, fontWeight: "700", fontSize: 18 }}
                  />
                  {bidInput.length > 0 && (
                    <TouchableOpacity onPress={() => setBidInput("")}>
                      <Ionicons name="close-circle" size={18} color={COLORS.text.muted} />
                    </TouchableOpacity>
                  )}
                </View>
                {bidError && (
                  <Text style={{ color: COLORS.danger.dark, fontSize: 11, marginTop: 6 }}>{bidError}</Text>
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
                      style={{ flex: 1, backgroundColor: "rgba(79,70,229,0.08)", borderRadius: BORDER_RADIUS.lg, paddingVertical: 8, alignItems: "center" }}
                    >
                      <Text style={{ color: COLORS.brand[600], fontSize: 10, fontWeight: "700" }}>{Math.round(pct * 100)}%</Text>
                      <Text style={{ color: COLORS.text.secondary, fontSize: 9 }}>{F(amtPaise)}</Text>
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
                    style={{ width: 56, height: 56, backgroundColor: "rgba(220,38,38,0.12)", borderRadius: BORDER_RADIUS.xl, alignItems: "center", justifyContent: "center" }}
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
          <View style={{ paddingHorizontal: SPACING[5], marginBottom: SPACING[5] }}>
            <Card accent="success" style={SHADOWS.cardSm}>
              <View className="items-center py-4">
                <Ionicons name="checkmark-done-circle-outline" size={32} color={COLORS.success.light} />
                <Text style={{ color: COLORS.text.primary, fontWeight: "700", fontSize: 13, marginTop: 8 }}>You have already received a payout</Text>
                <Text style={{ color: COLORS.text.secondary, fontSize: 11, marginTop: 4, textAlign: "center" }}>
                  You are not eligible to bid in future months. Thank you for participating!
                </Text>
              </View>
            </Card>
          </View>
        )}

        {/* Bidding closed notice */}
        {currentMonth?.status !== "bidding_open" && !hasWon && (
          <View style={{ paddingHorizontal: SPACING[5], marginBottom: SPACING[5] }}>
            <Card accent="info" style={SHADOWS.cardSm}>
              <View className="items-center py-4">
                <Ionicons name="pause-circle-outline" size={32} color={COLORS.warning.light} />
                <Text style={{ color: COLORS.text.primary, fontWeight: "700", fontSize: 13, marginTop: 8 }}>Bidding is not open</Text>
                <Text style={{ color: COLORS.text.secondary, fontSize: 11, marginTop: 4, textAlign: "center" }}>
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
          <View style={{ paddingHorizontal: SPACING[5], marginBottom: SPACING[5] }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <View style={{ width: 4, height: 20, borderRadius: 999, backgroundColor: COLORS.success.dark }} />
              <Text style={{ color: COLORS.text.primary, fontSize: 14, fontWeight: "700" }}>Live Preview</Text>
              {isLowerThanLowest && (
                <View style={{ marginLeft: 4, backgroundColor: "rgba(22,163,74,0.12)", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 }}>
                  <Text style={{ color: COLORS.success.dark, fontSize: 9, fontWeight: "700" }}>LOWEST</Text>
                </View>
              )}
            </View>

            <Card gradient>
              <View className="mb-4">
                <View className="flex-row justify-between items-center mb-2">
                  <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 11 }}>Your payout if you win</Text>
                  <Text style={{ color: COLORS.white, fontWeight: "800", fontSize: 18 }}>{F(bidPaise)}</Text>
                </View>
                <View className="flex-row justify-between items-center">
                  <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 11 }}>Interest you will owe if you win</Text>
                  <Text style={{ color: "#fcd34d", fontWeight: "700", fontSize: 13 }}>{F(interestAmount)}</Text>
                </View>
              </View>

              {/* Savings visualization */}
              <View style={{ backgroundColor: "rgba(255,255,255,0.10)", borderRadius: BORDER_RADIUS.xl, padding: 12, marginBottom: 12 }}>
                <View className="flex-row justify-between items-center mb-2">
                  <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: "600" }}>You save for others</Text>
                  <Text style={{ color: "#6ee7b7", fontWeight: "800", fontSize: 18 }}>{F(savingsForOthers)}</Text>
                </View>
                {/* Savings bar */}
                <View style={{ height: 10, backgroundColor: "rgba(255,255,255,0.10)", borderRadius: 999, overflow: "hidden", marginBottom: 6 }}>
                  <LinearGradient
                    colors={["#34d399", "#6ee7b7"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={{ width: `${savingsPercentage}%`, height: "100%", borderRadius: 9999 }}
                  />
                </View>
                <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 10, textAlign: "right" }}>
                  {savingsPercentage.toFixed(1)}% of pool saved for distribution
                </Text>
              </View>

              {/* Distribution preview */}
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.10)" }}>
                <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 11 }}>Estimated distribution each</Text>
                <Text style={{ color: "#6ee7b7", fontWeight: "700", fontSize: 13 }}>{F(perMemberDistribution)}</Text>
              </View>
            </Card>
          </View>
        )}
      </ScrollView>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* Confirmation Modal                                                 */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {showConfirm && (
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", paddingHorizontal: 24, zIndex: 50 }}>
          <Card style={{ width: "100%", maxWidth: 360 }}>
            <View className="items-center mb-4">
              <View style={{ width: 56, height: 56, borderRadius: 999, backgroundColor: "rgba(79,70,229,0.12)", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                <Ionicons name="hammer" size={28} color={COLORS.brandPrimary} />
              </View>
              <Text style={{ color: COLORS.text.primary, fontWeight: "700", fontSize: 18, textAlign: "center" }}>Confirm Your Bid</Text>
              {isLowerThanLowest && (
                <Badge label="New Lowest Bid" variant="success" size="sm" style={{ marginTop: 8 }} dot />
              )}
            </View>

            <View style={{ backgroundColor: COLORS.surface.warm, borderRadius: BORDER_RADIUS.xl, padding: 16, marginBottom: 16 }}>
              <View className="flex-row justify-between mb-2">
                <Text style={{ color: COLORS.text.muted, fontSize: 13 }}>Your Bid</Text>
                <Text style={{ color: COLORS.brand[600], fontWeight: "700", fontSize: 18 }}>{F(bidPaise)}</Text>
              </View>
              <View className="flex-row justify-between mb-2">
                <Text style={{ color: COLORS.text.muted, fontSize: 13 }}>Total Pool</Text>
                <Text style={{ color: COLORS.text.primary, fontWeight: "600", fontSize: 13 }}>{F(totalPool)}</Text>
              </View>
              <View className="flex-row justify-between mb-2">
                <Text style={{ color: COLORS.text.muted, fontSize: 13 }}>Savings for others</Text>
                <Text style={{ color: COLORS.success.dark, fontWeight: "600", fontSize: 13 }}>{F(totalPool - bidPaise)}</Text>
              </View>
              {lowestBid && (
                <View className="flex-row justify-between">
                  <Text style={{ color: COLORS.text.muted, fontSize: 13 }}>Current lowest</Text>
                  <Text style={{ color: COLORS.gold[600], fontWeight: "600", fontSize: 13 }}>{F(lowestBid.bidAmount)}</Text>
                </View>
              )}
            </View>

            <Text style={{ color: COLORS.text.secondary, fontSize: 11, textAlign: "center", marginBottom: 16 }}>
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
    <AlertComponent />
    </>
  );
}
