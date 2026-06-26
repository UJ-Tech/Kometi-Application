// src/app/(app)/committees/[id]/manage/month/[monthId].tsx
import React, { useState, useEffect, useRef } from "react";
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

import { committeesApi } from "../../../../../../services/committees.api";
import { useAuthStore } from "../../../../../../stores/auth.store";
import { useCommitteeStore } from "../../../../../../stores/committee.store";
import { canAccessAdminPanel } from "../../../../../../utils/rbac";
import { formatINR } from "../../../../../../utils/currency";
import { COLORS } from "../../../../../../constants/theme";
import Card from "../../../../../../components/ui/Card";
import Badge from "../../../../../../components/ui/Badge";
import Button from "../../../../../../components/ui/Button";
import { useAlertModal } from "../../../../../../components/ui/AlertModal";

export default function OrganiserMonthDetail() {
  const params = useLocalSearchParams<{ id: string; monthId: string }>();
  const rawId = params.id;
  const rawMonthId = params.monthId;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const monthId = Array.isArray(rawMonthId) ? rawMonthId[0] : rawMonthId;

  const isValid =
    !!id && id !== "undefined" && id !== "null" &&
    !!monthId && monthId !== "undefined" && monthId !== "null";

  const router = useRouter();
  const currentUser = useAuthStore((s) => s.user);
  const { alert, confirm, AlertComponent } = useAlertModal();

  const [month, setMonth] = useState<any | null>(null);
  const [committee, setCommittee] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [isSettling, setIsSettling] = useState(false);
  const settleAttemptedRef = useRef(false);

  const notify = async (title: string, message: string) => {
    await alert(title, message);
  };

  const loadData = async () => {
    if (!isValid) return;
    try {
      const [comRes, monthRes] = await Promise.all([
        committeesApi.getById(id),
        committeesApi.getMonth(id, monthId),
      ]);
      setCommittee(comRes.data.data);
      setMonth(monthRes.data.data);
    } catch (err) {
      console.error("[OrganiserMonthDetail] Failed to load:", err);
      await notify("Error", "Failed to load month details");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (isValid) {
      loadData();
    } else {
      setLoading(false);
      notify("Error", "Invalid committee or month ID");
      router.back();
    }
  }, [id, monthId]);

  // Socket-triggered instant refresh (bids, payments, resolution)
  const bidVersion = useCommitteeStore((s) => s.bidPlacedVersion);
  const resolvedVersion = useCommitteeStore((s) => s.monthResolvedVersion);
  const contributionVersion = useCommitteeStore((s) => s.contributionUpdatedVersion);
  const socketVersionSum = bidVersion + resolvedVersion + contributionVersion;
  const lastSocketVersion = useRef(0);
  useEffect(() => {
    if (socketVersionSum > 0 && socketVersionSum !== lastSocketVersion.current) {
      lastSocketVersion.current = socketVersionSum;
      loadData();
    }
  }, [socketVersionSum, loadData]);

  // Fallback polling every 30 seconds when month is completed (watching for settlements)
  useEffect(() => {
    if (!isValid || !month || month.status !== "completed") return;
    const interval = setInterval(() => {
      loadData();
    }, 30000);
    return () => clearInterval(interval);
  }, [isValid, month?.status, monthId]);

  useEffect(() => {
    if (!month || month.status !== "completed") return;
    const winnerObl = month.paymentObligations?.find(
      (o: any) => o.direction === "receive" && o.status === "pending"
    );
    if (winnerObl && !settleAttemptedRef.current) {
      settleAttemptedRef.current = true;
      committeesApi.settlePayout(id, monthId).then((res) => {
        const result = res.data?.data;
        if (result?.settled) {
          console.log(`[SettlePayout] Auto-settled: ${result.reason}, amount=${result.amount}`);
        }
        loadData();
      }).catch((err) => {
        console.error("[SettlePayout] Auto-settle failed:", err);
      });
    }
  }, [month?.status]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const confirmAction = async (title: string, message: string, confirmLabel = "Confirm") => {
    return confirm(title, message, { confirmLabel });
  };

  const handleResolveMonth = async () => {
    const confirmed = await confirmAction(
      "Resolve Month",
      "Are you sure you want to close bidding and resolve this month? The lowest bid will win, or if there are no bids, a random lottery will be drawn. This action cannot be undone.",
      "Confirm & Resolve"
    );
    if (!confirmed) return;

    try {
      setIsResolving(true);
      await committeesApi.resolveMonth(id, monthId);
      await confirmAction("Success", "Month resolved successfully!", "OK");
      loadData();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Failed to resolve month";
      await confirmAction("Error", msg, "OK");
    } finally {
      setIsResolving(false);
    }
  };

  if (!isValid) {
    return (
      <View className="flex-1 bg-surface-50 items-center justify-center px-6">
        <Ionicons name="alert-circle-outline" size={48} color="#71717a" />
        <Text className="text-slate-900 font-bold text-lg text-center mt-4">Invalid Link</Text>
        <Text className="text-slate-500 text-sm text-center mt-2">
          This page requires a valid committee and month ID.
        </Text>
        <TouchableOpacity
          onPress={() => router.replace("/committees")}
          className="bg-brand-500 px-6 py-3 rounded-xl mt-6"
        >
          <Text className="text-white font-bold">Back to Committees</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading && !refreshing) {
    return (
      <View className="flex-1 bg-surface-50 items-center justify-center">
        <ActivityIndicator size="large" color={COLORS.brandPrimary} />
      </View>
    );
  }

  if (!month || !committee) {
    return (
      <View className="flex-1 bg-surface-50 items-center justify-center px-6">
        <Ionicons name="document-outline" size={48} color="#71717a" />
        <Text className="text-slate-900 font-bold text-lg text-center mt-4">Month Not Found</Text>
        <Text className="text-slate-500 text-sm text-center mt-2">
          Could not load data for this month. It may not exist yet.
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="bg-surface-card border border-slate-200 px-6 py-3 rounded-xl mt-6"
        >
          <Text className="text-slate-900 font-bold">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isOrganizer = committee.organizerId === currentUser?.id;
  const isAdminOrManager = canAccessAdminPanel(currentUser?.role);
  if (!isOrganizer && !isAdminOrManager) {
    return null;
  }

  const isBiddingOpen = month.status === "bidding_open";
  const isCompleted = month.status === "completed";

  const activeMembers = committee.members.filter((m: any) => m.isActive);
  const bidderIds = new Set((month.bids || []).map((b: any) => b.memberId));
  const nonBidders = activeMembers.filter((m: any) => !bidderIds.has(m.id) && !m.hasReceivedPayout);

  const settleWinnerObl = isCompleted && month.paymentObligations?.find(
    (o: any) => o.direction === "receive" && o.status === "pending"
  );
  const settleAllPaid = isCompleted && month.paymentObligations
    ?.filter((o: any) => o.direction === "pay")
    ?.every((o: any) => o.status === "paid" || o.status === "organiser_advanced");

  return (
    <ScrollView
      className="flex-1 bg-surface-50 px-4"
      contentContainerStyle={{ paddingTop: 64, paddingBottom: 120 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.brandPrimary} />
      }
    >
      {/* Header */}
      <View className="flex-row items-center mb-6">
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-10 h-10 bg-surface-card rounded-full items-center justify-center border border-slate-200 mr-4"
        >
          <Ionicons name="arrow-back" size={20} color="#1a1a2e" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-slate-900 text-xl font-bold">Month {month.monthNumber}</Text>
          <Text className="text-slate-500 text-xs">
            {new Date(month.monthDate).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </Text>
        </View>
        <Badge
          label={isCompleted ? "Completed" : isBiddingOpen ? "Bidding Open" : "Pending"}
          variant={isCompleted ? "success" : isBiddingOpen ? "info" : "neutral"}
        />
      </View>

      {/* Financial Overview (Pending/Bidding) */}
      {!isCompleted && (
        <Card style={{ marginBottom: 20 }} padding={0}>
          <View className="p-5">
            <Text className="text-slate-900 font-bold mb-4 border-b border-slate-100 pb-2">
              Financial Overview
            </Text>
            <View className="flex-row flex-wrap">
              <View className="w-1/2 mb-4">
                <Text className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Total Pool</Text>
                <Text className="text-amber-600 font-bold text-base mt-1">{formatINR(month.totalPool)}</Text>
              </View>
              <View className="w-1/2 mb-4 items-end">
                <Text className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Projected Interest</Text>
                <Text className="text-slate-900 font-bold text-base mt-1">{formatINR(month.projected.interestAmount)}</Text>
              </View>
              <View className="w-1/2">
                <Text className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Max Allowed Bid</Text>
                <Text className="text-teal-600 font-bold text-base mt-1">{formatINR(month.projected.maxBidAllowed)}</Text>
              </View>
              <View className="w-1/2 items-end">
                <Text className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Projected Dividend</Text>
                <Text className="text-emerald-600 font-bold text-base mt-1">+{formatINR(month.projected.perMemberDistribution)}</Text>
              </View>
            </View>
          </View>
        </Card>
      )}

      {/* Settle Payout Button */}
      {isCompleted && settleWinnerObl && (
          <View className="mt-3 mb-4">
            <Button
              label={isSettling ? "Settling..." : settleAllPaid ? "Settle Winner Payout" : "Waiting for members to pay"}
              variant={settleAllPaid ? "primary" : "secondary"}
              isLoading={isSettling}
              disabled={isSettling || !settleAllPaid}
              onPress={async () => {
                try {
                  setIsSettling(true);
                  const res = await committeesApi.settlePayout(id, monthId);
                  const result = res.data?.data;
                  if (result?.settled) {
                    await notify("Success", `Winner payout of ₹${(result.amount || 0) / 100} settled!`);
                  } else {
                    await notify("Info", result?.reason || "Settlement not needed");
                  }
                  loadData();
                } catch (err: any) {
                  await notify("Error", err?.message || "Failed to settle payout");
                } finally {
                  setIsSettling(false);
                }
              }}
            />
            {!settleAllPaid && (
              <Text className="text-slate-500 text-[10px] text-center mt-2 italic">
                Winner receives payout once all members pay their net amount.
              </Text>
            )}
          </View>
      )}

      {/* Completed Summary Overview */}
      {isCompleted && (
        <View className="mb-6">
          <Card style={{ marginBottom: 16 }} padding={0}>
            <View className="p-5">
              <View className="flex-row items-center justify-between border-b border-slate-100 pb-4 mb-4">
                <View>
                  <Text className="text-slate-500 text-[10px] uppercase font-bold tracking-wider mb-1">Resolution</Text>
                  <Badge
                    label={month.resolutionType.replace("_", " ").toUpperCase()}
                    variant={month.resolutionType === "lottery" ? "neutral" : "brand"}
                  />
                </View>
                <View className="items-end">
                  <Text className="text-slate-500 text-[10px] uppercase font-bold tracking-wider mb-1">Winner</Text>
                  <Text className="text-slate-900 font-bold text-base">{month.winnerMember?.user?.name || "Unknown"}</Text>
                </View>
              </View>

              <View className="flex-row flex-wrap mb-4">
                <View className="w-1/2 mb-4">
                  <Text className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Winning Bid / Payout</Text>
                  <Text className="text-amber-600 font-bold text-base mt-1">{formatINR(month.winningBidAmount)}</Text>
                </View>
                <View className="w-1/2 mb-4 items-end">
                  <Text className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Interest Extracted</Text>
                  <Text className="text-slate-900 font-bold text-base mt-1">{formatINR(month.interestAmount)}</Text>
                </View>
                <View className="w-1/2">
                  <Text className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Remaining Bal.</Text>
                  <Text className="text-slate-900 font-bold text-base mt-1">{formatINR(month.remainingBalance)}</Text>
                </View>
                <View className="w-1/2 items-end">
                  <Text className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Distributable</Text>
                  <Text className="text-emerald-600 font-bold text-base mt-1">{formatINR(month.distributableAmount)}</Text>
                </View>
              </View>

              <View className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl flex-row justify-between items-center">
                <Text className="text-emerald-700 font-bold text-xs">Dividend per Member</Text>
                <Text className="text-emerald-700 font-bold text-lg">+{formatINR(month.perMemberDistribution)}</Text>
              </View>
            </View>
          </Card>
        </View>
      )}

      {/* Bidding Open - Resolution Actions */}
      {isBiddingOpen && (
        <View className="mb-8">
          <Button
            label={isResolving ? "Resolving..." : "Close Bidding & Resolve Month"}
            variant="primary"
            disabled={isResolving}
            onPress={handleResolveMonth}
            icon={!isResolving && <Ionicons name="flash-outline" size={20} color="#fff" />}
          />
        </View>
      )}

      {/* Bids Placed */}
      {!isCompleted && month.bids && (
        <View className="mb-6">
          <Text className="text-slate-900 text-base font-bold mb-3">
            Bids Placed ({month.bids.length})
          </Text>
          {month.bids.length === 0 ? (
            <Text className="text-slate-500 text-sm italic">No bids placed yet.</Text>
          ) : (
            month.bids.map((bid: any, idx: number) => (
              <View key={bid.id} className="bg-surface-card border border-slate-200 rounded-xl p-4 mb-2 flex-row justify-between items-center">
                <View className="flex-row items-center">
                  <View className="w-8 h-8 rounded-full bg-teal-50 items-center justify-center mr-3">
                    <Text className="text-teal-600 font-bold text-xs">#{idx + 1}</Text>
                  </View>
                  <View>
                    <Text className="text-slate-900 font-bold">{bid.committeeMember?.user?.name || "Unknown"}</Text>
                    <Text className="text-slate-500 text-[10px] mt-1">
                      {new Date(bid.placedAt).toLocaleString()}
                    </Text>
                  </View>
                </View>
                <Text className="text-amber-600 font-bold text-base">{formatINR(bid.bidAmount)}</Text>
              </View>
            ))
          )}
        </View>
      )}

      {/* Members who haven't bid */}
      {!isCompleted && nonBidders.length > 0 && (
        <View className="mb-6">
          <Text className="text-slate-900 text-sm font-bold mb-3">Waiting for Bids ({nonBidders.length})</Text>
          <View className="flex-row flex-wrap gap-2">
            {nonBidders.map((m: any) => (
              <View key={m.id} className="bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-full">
                <Text className="text-slate-600 text-xs">{m.user?.name || "Member"}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Distributions Table */}
      {isCompleted && month.memberDistributions && (
        <View className="mb-6">
          <Text className="text-slate-900 text-base font-bold mb-3">Member Distributions</Text>
          <Card style={{ marginBottom: 0 }} padding={0}>
            <View className="p-4">
              <View className="flex-row border-b border-slate-100 pb-2 mb-3">
                <Text className="w-8 text-slate-400 font-bold text-xs">#</Text>
                <Text className="flex-1 text-slate-400 font-bold text-xs">Member</Text>
                <Text className="w-24 text-right text-slate-400 font-bold text-xs">Dividend</Text>
              </View>
              {month.memberDistributions.map((dist: any, idx: number) => (
                <View key={dist.id} className="flex-row py-2 border-b border-slate-50 items-center">
                  <Text className="w-8 text-slate-500 font-bold text-xs">{idx + 1}</Text>
                  <Text className="flex-1 text-slate-900 font-semibold text-sm">
                    {dist.committeeMember?.user?.name || "Unknown"}
                  </Text>
                  <Text className="w-24 text-right text-emerald-600 font-bold text-sm">
                    +{formatINR(dist.distributionAmount)}
                  </Text>
                </View>
              ))}
            </View>
          </Card>
        </View>
      )}

      {/* Payment Obligations (Netted Flow) */}
      {isCompleted && month.paymentObligations && month.paymentObligations.length > 0 && (
        <View className="mb-6">
          <View className="flex-row items-center mb-3">
            <View className="w-7 h-7 rounded-lg bg-amber-50 items-center justify-center mr-2">
              <Ionicons name="receipt-outline" size={14} color={COLORS.goldPrimary} />
            </View>
            <Text className="text-slate-900 font-bold text-sm">Payment Obligations</Text>
          </View>

          <Card style={{ marginBottom: 12 }} padding={0}>
            <View className="p-4">
              <View className="flex-row flex-wrap">
                <View className="w-1/2 mb-2">
                  <Text className="text-slate-500 text-[10px] uppercase font-bold">Non-Winner Pays</Text>
                  <Text className="text-red-600 font-bold text-sm mt-0.5">
                    {formatINR(month.nonWinnerNetPayable || 0)} each
                  </Text>
                </View>
                <View className="w-1/2 mb-2 items-end">
                  <Text className="text-slate-500 text-[10px] uppercase font-bold">Winner Receives</Text>
                  <Text className="text-emerald-600 font-bold text-sm mt-0.5">
                    +{formatINR(month.winnerNetReceivable || 0)}
                  </Text>
                </View>
                {month.paymentDeadline && (
                  <View className="w-full mt-2 pt-2 border-t border-slate-100">
                    <View className="flex-row justify-between items-center">
                      <Text className="text-slate-500 text-[10px] uppercase font-bold">Payment Deadline</Text>
                      <Text className="text-slate-900 text-xs font-bold">
                        {new Date(month.paymentDeadline).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            </View>
          </Card>

          <Card padding={0}>
            <View className="p-4">
              <View className="flex-row border-b border-slate-100 pb-2 mb-3">
                <Text className="flex-1 text-slate-400 font-bold text-xs">Member</Text>
                <Text className="w-16 text-center text-slate-400 font-bold text-xs">Role</Text>
                <Text className="w-20 text-right text-slate-400 font-bold text-xs">Net Amount</Text>
                <Text className="w-20 text-right text-slate-400 font-bold text-xs">Status</Text>
              </View>
              {month.paymentObligations.map((obl: any, idx: number) => (
                <View key={obl.id || idx} className="flex-row py-2 border-b border-slate-50 items-center">
                  <Text className="flex-1 text-slate-900 font-semibold text-xs">
                    {month.memberDistributions?.find((d: any) => d.memberId === obl.memberId)?.committeeMember?.user?.name || "Member"}
                  </Text>
                  <View className="w-16 items-center">
                    <Badge
                      label={obl.role === "winner" ? "Winner" : "Non-Winner"}
                      variant={obl.role === "winner" ? "success" : "neutral"}
                      size="sm"
                    />
                  </View>
                  <Text className={`w-20 text-right font-bold text-xs ${
                    obl.direction === "receive" ? "text-emerald-600" : "text-red-600"
                  }`}>
                    {obl.direction === "receive" ? "+" : "-"}{formatINR(Math.abs(obl.netAmount))}
                  </Text>
                  <View className="w-20 items-end">
                    <Badge
                      label={
                        obl.status === "paid" ? "Paid" :
                        obl.status === "organiser_advanced" ? "Advanced" :
                        obl.status === "overdue" ? "Overdue" :
                        obl.direction === "receive" ? "Awaiting" : "Pending"
                      }
                      variant={
                        obl.status === "paid" ? "success" :
                        obl.status === "organiser_advanced" ? "warning" :
                        obl.status === "overdue" ? "danger" :
                        obl.direction === "receive" ? "info" : "neutral"
                      }
                      size="sm"
                    />
                  </View>
                </View>
              ))}
            </View>
          </Card>
        </View>
      )}

      <AlertComponent />
    </ScrollView>
  );
}
