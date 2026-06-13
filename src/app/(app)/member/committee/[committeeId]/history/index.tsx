// src/app/(app)/member/committee/[committeeId]/history/index.tsx
// Payment History Screen — month-by-month contributions, distributions, late fees
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { committeesApi } from "../../../../../../services/committees.api";
import { installmentsApi } from "../../../../../../services/installments.api";
import { useAuthStore } from "../../../../../../stores/auth.store";
import { formatINR } from "../../../../../../utils/currency";
import { COLORS } from "../../../../../../constants/theme";
import Card from "../../../../../../components/ui/Card";
import Badge from "../../../../../../components/ui/Badge";

const F = (p: number | bigint | null | undefined) => formatINR(p ?? 0);
const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export default function PaymentHistoryScreen() {
  const { committeeId: rawId } = useLocalSearchParams<{ committeeId: string }>();
  const committeeId = Array.isArray(rawId) ? rawId[0] : rawId;
  const isValidId = !!committeeId && committeeId !== "undefined" && committeeId !== "null";
  const router = useRouter();
  const currentUser = useAuthStore((s: any) => s.user);

  const [committee, setCommittee] = useState<any>(null);
  const [monthsData, setMonthsData] = useState<any>(null);
  const [monthDetails, setMonthDetails] = useState<Record<string, any>>({});
  const [installments, setInstallments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null);

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

  const onRefresh = useCallback(() => { setRefreshing(true); loadData(); }, [loadData]);

  const loadMonthDetail = async (monthId: string) => {
    if (monthDetails[monthId]) {
      setExpandedMonth(expandedMonth === monthId ? null : monthId);
      return;
    }
    try {
      setLoadingDetail(monthId);
      const res = await committeesApi.getMonth(committeeId, monthId);
      setMonthDetails((prev) => ({ ...prev, [monthId]: res.data.data }));
      setExpandedMonth(monthId);
    } catch {
      Alert.alert("Error", "Failed to load month details.");
    } finally {
      setLoadingDetail(null);
    }
  };

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
        <Text className="text-neutral-500 text-sm mt-4">Loading payment history...</Text>
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
  const myMembership = members.find((m: any) => m.userId === currentUser?.id);
  const myMemberId = myMembership?.id;

  // Group installments by cycle for this user
  const myInstallments = installments
    .filter((i: any) => i.userId === currentUser?.id)
    .sort((a: any, b: any) => a.cycleNo - b.cycleNo);

  // Build history from months (more complete with distributions)
  const history = months
    .sort((a: any, b: any) => a.monthNumber - b.monthNumber)
    .map((month: any) => {
      const detail = monthDetails[month.id];
      const contrib = detail?.monthlyContributions?.find((c: any) => c.memberId === myMemberId);
      const dist = detail?.memberDistributions?.find((d: any) => d.memberId === myMemberId);
      const inst = myInstallments.find((i: any) => i.cycleNo === month.monthNumber);

      const amountPaid = contrib?.amountPaid || inst?.amountPaidPaise || 0;
      const amountDue = contrib?.amountDue || inst?.amountDuePaise || 0;
      const lateFee = contrib?.lateFeeAmount || inst?.penaltyPaise || 0;
      const distribution = dist?.distributionAmount || 0;
      const interest = dist?.interestShare || 0;
      const totalReceived = distribution + interest;
      const isLate = lateFee > 0;
      const isUnpaid = amountDue > 0 && amountPaid === 0;
      const isPartial = amountPaid > 0 && amountPaid < amountDue;

      return {
        month,
        amountPaid,
        amountDue,
        lateFee,
        distribution,
        interest,
        totalReceived,
        isLate,
        isUnpaid,
        isPartial,
        status: inst?.status || (amountPaid > 0 ? "PAID" : "PENDING"),
      };
    });

  let totalPaid = 0;
  let totalReceived = 0;
  let totalLateFees = 0;
  history.forEach((h: any) => {
    totalPaid += h.amountPaid + h.lateFee;
    totalReceived += h.totalReceived;
    totalLateFees += h.lateFee;
  });

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
          <Text className="text-white text-xl font-bold">Payment History</Text>
          <Text className="text-neutral-400 text-xs">{committee.name}</Text>
        </View>
      </View>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* Summary Cards                                                      */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <View className="px-4 mb-5">
        <View className="flex-row gap-3">
          <Card padding={0} style={{ flex: 1 }}>
            <View className="p-3 items-center">
              <Ionicons name="wallet-outline" size={20} color={COLORS.brandPrimary} />
              <Text className="text-neutral-500 text-[9px] uppercase font-bold mt-1">Total Paid</Text>
              <Text className="text-brand-400 font-bold text-sm mt-0.5">{F(totalPaid)}</Text>
            </View>
          </Card>
          <Card padding={0} style={{ flex: 1 }}>
            <View className="p-3 items-center">
              <Ionicons name="arrow-down-circle-outline" size={20} color={COLORS.success.light} />
              <Text className="text-neutral-500 text-[9px] uppercase font-bold mt-1">Received</Text>
              <Text className="text-success-400 font-bold text-sm mt-0.5">{F(totalReceived)}</Text>
            </View>
          </Card>
          <Card padding={0} style={{ flex: 1 }}>
            <View className="p-3 items-center">
              <Ionicons name="warning-outline" size={20} color={COLORS.warning.light} />
              <Text className="text-neutral-500 text-[9px] uppercase font-bold mt-1">Late Fees</Text>
              <Text className={`font-bold text-sm mt-0.5 ${totalLateFees > 0 ? "text-warning-400" : "text-neutral-500"}`}>
                {totalLateFees > 0 ? F(totalLateFees) : "-"}
              </Text>
            </View>
          </Card>
        </View>
      </View>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* Month-by-Month History                                             */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <View className="px-4 mb-5">
        <View className="flex-row items-center mb-3">
          <View className="w-7 h-7 rounded-lg bg-brand-500/15 items-center justify-center mr-2">
            <Ionicons name="receipt-outline" size={14} color={COLORS.brandPrimary} />
          </View>
          <Text className="text-white font-bold text-sm">Month-by-Month</Text>
          <Text className="text-neutral-500 text-xs ml-auto">{history.length} months</Text>
        </View>

        {history.length === 0 ? (
          <Card>
            <View className="items-center py-6">
              <Ionicons name="document-outline" size={28} color={COLORS.text.muted} />
              <Text className="text-neutral-500 text-xs mt-2">No payment history yet</Text>
            </View>
          </Card>
        ) : (
          history.map((entry: any) => {
            const isExpanded = expandedMonth === entry.month.id;
            const isLoadingDet = loadingDetail === entry.month.id;
            const hasProblem = entry.isLate || entry.isUnpaid;

            return (
              <View key={entry.month.id} className="mb-3">
                <TouchableOpacity onPress={() => loadMonthDetail(entry.month.id)} activeOpacity={0.7}>
                  <Card padding={0} borderGlow={hasProblem}>
                    <View className={`p-3.5 ${hasProblem ? "border-l-2 border-l-danger-400" : ""}`}>
                      <View className="flex-row items-center justify-between mb-1.5">
                        <View className="flex-row items-center flex-1">
                          <Text className="text-white font-bold text-sm mr-2">Month #{entry.month.monthNumber}</Text>
                          <Badge
                            label={entry.status}
                            variant={entry.status === "PAID" ? "success" : entry.status === "OVERDUE" ? "danger" : entry.status === "PARTIAL" ? "warning" : "neutral"}
                            size="sm"
                          />
                          {entry.isLate && <Badge label="Late" variant="warning" size="sm" style={{ marginLeft: 4 }} />}
                        </View>
                        {isLoadingDet ? (
                          <ActivityIndicator size="small" color={COLORS.brandPrimary} />
                        ) : (
                          <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={18} color={COLORS.text.muted} />
                        )}
                      </View>

                      <Text className="text-neutral-500 text-[10px] mb-2">{fmtDate(entry.month.monthDate)}</Text>

                      <View className="flex-row flex-wrap gap-x-4 gap-y-1">
                        <Text className="text-neutral-400 text-[10px]">Due: <Text className="text-white font-semibold">{F(entry.amountDue)}</Text></Text>
                        <Text className="text-neutral-400 text-[10px]">Paid: <Text className={`${entry.amountPaid > 0 ? "text-success-400" : "text-danger-400"} font-semibold`}>{F(entry.amountPaid)}</Text></Text>
                        {entry.lateFee > 0 && (
                          <Text className="text-neutral-400 text-[10px]">Late Fee: <Text className="text-warning-400 font-semibold">{F(entry.lateFee)}</Text></Text>
                        )}
                        {entry.totalReceived > 0 && (
                          <Text className="text-neutral-400 text-[10px]">Received: <Text className="text-success-400 font-semibold">{F(entry.totalReceived)}</Text></Text>
                        )}
                      </View>

                      {/* Pay Now button for unpaid months */}
                      {(entry.isUnpaid || entry.isPartial) && (
                        <TouchableOpacity
                          onPress={() => {
                            Alert.alert("Pay Now", `Pay ${F(entry.amountDue - entry.amountPaid + entry.lateFee)} for Month #${entry.month.monthNumber}?`, [
                              { text: "Cancel", style: "cancel" },
                              { text: "Pay", onPress: () => Alert.alert("Payment", "Payment processing coming soon!") },
                            ]);
                          }}
                          className="mt-2.5 bg-brand-500/10 px-3 py-1.5 rounded-lg self-start flex-row items-center"
                        >
                          <Ionicons name="card-outline" size={13} color={COLORS.brandPrimary} />
                          <Text className="text-brand-400 text-[10px] font-semibold ml-1.5">Pay Now</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </Card>
                </TouchableOpacity>

                {/* Expanded: Contribution & Distribution Details */}
                {isExpanded && monthDetails[entry.month.id] && (
                  <View className="ml-4 mt-2 mb-1">
                    <Card gradient padding={0}>
                      <View className="p-3">
                        <Text className="text-neutral-400 text-[10px] font-bold uppercase tracking-wider mb-2">Details</Text>

                        {/* Contribution */}
                        <View className="bg-surface-950 rounded-xl p-3 mb-2">
                          <Text className="text-neutral-500 text-[9px] uppercase font-bold mb-1">My Contribution</Text>
                          {entry.amountPaid > 0 ? (
                            <View className="flex-row justify-between">
                              <Text className="text-neutral-400 text-xs">Amount Paid</Text>
                              <Text className="text-success-400 font-semibold text-xs">{F(entry.amountPaid)}</Text>
                            </View>
                          ) : (
                            <Text className="text-danger-400 text-xs">Not yet paid</Text>
                          )}
                          {entry.lateFee > 0 && (
                            <View className="flex-row justify-between mt-1">
                              <Text className="text-neutral-400 text-xs">Late Fee</Text>
                              <Text className="text-warning-400 font-semibold text-xs">{F(entry.lateFee)}</Text>
                            </View>
                          )}
                        </View>

                        {/* Distribution */}
                        {entry.totalReceived > 0 ? (
                          <View className="bg-surface-950 rounded-xl p-3">
                            <Text className="text-neutral-500 text-[9px] uppercase font-bold mb-1">My Distribution</Text>
                            <View className="flex-row justify-between">
                              <Text className="text-neutral-400 text-xs">Base Distribution</Text>
                              <Text className="text-success-400 font-semibold text-xs">{F(entry.distribution)}</Text>
                            </View>
                            {entry.interest > 0 && (
                              <View className="flex-row justify-between mt-1">
                                <Text className="text-neutral-400 text-xs">Interest Share</Text>
                                <Text className="text-success-400 font-semibold text-xs">{F(entry.interest)}</Text>
                              </View>
                            )}
                            <View className="flex-row justify-between mt-1.5 pt-1.5 border-t border-brand-primary/5">
                              <Text className="text-white text-xs font-bold">Total Received</Text>
                              <Text className="text-success-400 font-bold text-xs">{F(entry.totalReceived)}</Text>
                            </View>
                          </View>
                        ) : entry.month.status === "completed" ? (
                          <View className="bg-surface-950 rounded-xl p-3">
                            <Text className="text-neutral-500 text-xs italic">Distribution pending</Text>
                          </View>
                        ) : null}
                      </View>
                    </Card>
                  </View>
                )}
              </View>
            );
          })
        )}
      </View>

      {/* Footer */}
      <View className="px-4 items-center mb-6">
        <Text className="text-neutral-600 text-[10px]">Payment History &bull; {committee.name}</Text>
      </View>
    </ScrollView>
  );
}
