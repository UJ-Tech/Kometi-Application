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
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { committeesApi } from "../../../../../../services/committees.api";
import BrandedLoader from "../../../../../../components/brand/BrandedLoader";
import { installmentsApi } from "../../../../../../services/installments.api";
import { useAuthStore } from "../../../../../../stores/auth.store";
import { formatINR } from "../../../../../../utils/currency";
import { COLORS, SHADOWS, BORDER_RADIUS, SPACING } from "../../../../../../constants/theme";
import Card from "../../../../../../components/ui/Card";
import Badge from "../../../../../../components/ui/Badge";
import ScreenHeader from "../../../../../../components/shared/ScreenHeader";
import { useAlertModal } from "../../../../../../components/ui/AlertModal";

const F = (p: number | bigint | null | undefined) => formatINR(p ?? 0);
const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export default function PaymentHistoryScreen() {
  const { committeeId: rawId } = useLocalSearchParams<{ committeeId: string }>();
  const committeeId = Array.isArray(rawId) ? rawId[0] : rawId;
  const isValidId = !!committeeId && committeeId !== "undefined" && committeeId !== "null";
  const router = useRouter();
  const currentUser = useAuthStore((s: any) => s.user);
  const { alert, confirm, AlertComponent } = useAlertModal();

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
      await alert("Error", "Failed to load month details.");
    } finally {
      setLoadingDetail(null);
    }
  };

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
    return <BrandedLoader message="Loading payment history..." />;
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
    <>
    <ScrollView
      className="flex-1"
      style={{ backgroundColor: COLORS.surface.bg }}
      contentContainerStyle={{ paddingTop: 0, paddingBottom: 120 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.brandPrimary} />}
    >
      <ScreenHeader title="Payment History" subtitle={committee.name} brand />

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* Summary Cards                                                      */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <View style={{ paddingHorizontal: SPACING[5], marginBottom: SPACING[5] }}>
        <View className="flex-row gap-3">
          <Card padding={0} style={{ flex: 1 }} accent="brand">
            <View className="p-3 items-center">
              <Ionicons name="wallet-outline" size={20} color={COLORS.brandPrimary} />
              <Text style={{ color: COLORS.text.secondary, fontSize: 9, fontWeight: "700", textTransform: "uppercase", marginTop: 4 }}>Total Paid</Text>
              <Text style={{ color: COLORS.brand[600], fontWeight: "700", fontSize: 13, marginTop: 2 }}>{F(totalPaid)}</Text>
            </View>
          </Card>
          <Card padding={0} style={{ flex: 1 }} accent="success">
            <View className="p-3 items-center">
              <Ionicons name="arrow-down-circle-outline" size={20} color={COLORS.success.light} />
              <Text style={{ color: COLORS.text.secondary, fontSize: 9, fontWeight: "700", textTransform: "uppercase", marginTop: 4 }}>Received</Text>
              <Text style={{ color: COLORS.success.dark, fontWeight: "700", fontSize: 13, marginTop: 2 }}>{F(totalReceived)}</Text>
            </View>
          </Card>
          <Card padding={0} style={{ flex: 1 }} accent="warning">
            <View className="p-3 items-center">
              <Ionicons name="warning-outline" size={20} color={COLORS.warning.light} />
              <Text style={{ color: COLORS.text.secondary, fontSize: 9, fontWeight: "700", textTransform: "uppercase", marginTop: 4 }}>Late Fees</Text>
              <Text style={{ color: totalLateFees > 0 ? COLORS.warning.dark : COLORS.text.secondary, fontWeight: "700", fontSize: 13, marginTop: 2 }}>
                {totalLateFees > 0 ? F(totalLateFees) : "-"}
              </Text>
            </View>
          </Card>
        </View>
      </View>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* Month-by-Month History                                             */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <View style={{ paddingHorizontal: SPACING[5], marginBottom: SPACING[5] }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <View style={{ width: 4, height: 20, borderRadius: 999, backgroundColor: COLORS.brand[500] }} />
          <Text style={{ color: COLORS.text.primary, fontSize: 14, fontWeight: "700" }}>Month-by-Month</Text>
          <View style={{ marginLeft: "auto" }}>
            <Text style={{ color: COLORS.text.secondary, fontSize: 11 }}>{history.length} months</Text>
          </View>
        </View>

        {history.length === 0 ? (
          <Card style={SHADOWS.cardSm}>
            <View className="items-center py-6">
              <Ionicons name="document-outline" size={28} color={COLORS.text.muted} />
              <Text style={{ color: COLORS.text.secondary, fontSize: 11, marginTop: 8 }}>No payment history yet</Text>
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
                  <Card padding={0} borderGlow={hasProblem} accent={hasProblem ? "danger" : entry.status === "PAID" ? "success" : "info"}>
                    <View style={{ padding: 14 }}>
                      <View className="flex-row items-center justify-between mb-1.5">
                        <View className="flex-row items-center flex-1" style={{ gap: 6 }}>
                          <Text style={{ color: COLORS.text.primary, fontWeight: "700", fontSize: 13, marginRight: 4 }}>Month #{entry.month.monthNumber}</Text>
                          <Badge
                            label={entry.status}
                            variant={entry.status === "PAID" ? "success" : entry.status === "OVERDUE" ? "danger" : entry.status === "PARTIAL" ? "warning" : "neutral"}
                            size="sm"
                            dot
                          />
                          {entry.isLate && <Badge label="Late" variant="warning" size="sm" dot />}
                        </View>
                        {isLoadingDet ? (
                          <ActivityIndicator size="small" color={COLORS.brandPrimary} />
                        ) : (
                          <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={18} color={COLORS.text.muted} />
                        )}
                      </View>

                      <Text style={{ color: COLORS.text.secondary, fontSize: 10, marginBottom: 8 }}>{fmtDate(entry.month.monthDate)}</Text>

                      <View className="flex-row flex-wrap" style={{ gap: 8, rowGap: 4 }}>
                        <Text style={{ color: COLORS.text.muted, fontSize: 10 }}>Due: <Text style={{ color: COLORS.text.primary, fontWeight: "600" }}>{F(entry.amountDue)}</Text></Text>
                        <Text style={{ color: COLORS.text.muted, fontSize: 10 }}>Paid: <Text style={{ color: entry.amountPaid > 0 ? COLORS.success.dark : COLORS.danger.dark, fontWeight: "600" }}>{F(entry.amountPaid)}</Text></Text>
                        {entry.lateFee > 0 && (
                          <Text style={{ color: COLORS.text.muted, fontSize: 10 }}>Late Fee: <Text style={{ color: COLORS.warning.dark, fontWeight: "600" }}>{F(entry.lateFee)}</Text></Text>
                        )}
                        {entry.totalReceived > 0 && (
                          <Text style={{ color: COLORS.text.muted, fontSize: 10 }}>Received: <Text style={{ color: COLORS.success.dark, fontWeight: "600" }}>{F(entry.totalReceived)}</Text></Text>
                        )}
                      </View>

                      {/* Pay Now button for unpaid months */}
                      {(entry.isUnpaid || entry.isPartial) && (
                        <TouchableOpacity
                          onPress={async () => {
                            const ok = await confirm("Pay Now", `Pay ${F(entry.amountDue - entry.amountPaid + entry.lateFee)} for Month #${entry.month.monthNumber}?`);
                            if (ok) {
                              await alert("Payment", "Payment processing coming soon!");
                            }
                          }}
                          style={{ marginTop: 10, backgroundColor: "rgba(79,70,229,0.08)", paddingHorizontal: 12, paddingVertical: 6, borderRadius: BORDER_RADIUS.lg, alignSelf: "flex-start", flexDirection: "row", alignItems: "center" }}
                        >
                          <Ionicons name="card-outline" size={13} color={COLORS.brandPrimary} />
                          <Text style={{ color: COLORS.brand[600], fontSize: 10, fontWeight: "600", marginLeft: 6 }}>Pay Now</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </Card>
                </TouchableOpacity>

                {/* Expanded: Contribution & Distribution Details */}
                {isExpanded && monthDetails[entry.month.id] && (
                  <View style={{ marginLeft: SPACING[4], marginTop: 8, marginBottom: 4 }}>
                    <Card gradient padding={0}>
                      <View className="p-3">
                        <Text style={{ color: COLORS.text.muted, fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Details</Text>

                        {/* Contribution */}
                        <View style={{ backgroundColor: COLORS.surface.warm, borderRadius: BORDER_RADIUS.xl, padding: 12, marginBottom: 8 }}>
                          <Text style={{ color: COLORS.text.secondary, fontSize: 9, fontWeight: "700", textTransform: "uppercase", marginBottom: 4 }}>My Contribution</Text>
                          {entry.amountPaid > 0 ? (
                            <View className="flex-row justify-between">
                              <Text style={{ color: COLORS.text.muted, fontSize: 11 }}>Amount Paid</Text>
                              <Text style={{ color: COLORS.success.dark, fontWeight: "600", fontSize: 11 }}>{F(entry.amountPaid)}</Text>
                            </View>
                          ) : (
                            <Text style={{ color: COLORS.danger.dark, fontSize: 11 }}>Not yet paid</Text>
                          )}
                          {entry.lateFee > 0 && (
                            <View className="flex-row justify-between mt-1">
                              <Text style={{ color: COLORS.text.muted, fontSize: 11 }}>Late Fee</Text>
                              <Text style={{ color: COLORS.warning.dark, fontWeight: "600", fontSize: 11 }}>{F(entry.lateFee)}</Text>
                            </View>
                          )}
                        </View>

                        {/* Distribution */}
                        {entry.totalReceived > 0 ? (
                          <View style={{ backgroundColor: COLORS.surface.warm, borderRadius: BORDER_RADIUS.xl, padding: 12 }}>
                            <Text style={{ color: COLORS.text.secondary, fontSize: 9, fontWeight: "700", textTransform: "uppercase", marginBottom: 4 }}>My Distribution</Text>
                            <View className="flex-row justify-between">
                              <Text style={{ color: COLORS.text.muted, fontSize: 11 }}>Base Distribution</Text>
                              <Text style={{ color: COLORS.success.dark, fontWeight: "600", fontSize: 11 }}>{F(entry.distribution)}</Text>
                            </View>
                            {entry.interest > 0 && (
                              <View className="flex-row justify-between mt-1">
                                <Text style={{ color: COLORS.text.muted, fontSize: 11 }}>Interest Share</Text>
                                <Text style={{ color: COLORS.success.dark, fontWeight: "600", fontSize: 11 }}>{F(entry.interest)}</Text>
                              </View>
                            )}
                            <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: COLORS.surface.border }}>
                              <Text style={{ color: COLORS.text.primary, fontSize: 11, fontWeight: "700" }}>Total Received</Text>
                              <Text style={{ color: COLORS.success.dark, fontWeight: "700", fontSize: 11 }}>{F(entry.totalReceived)}</Text>
                            </View>
                          </View>
                        ) : entry.month.status === "completed" ? (
                          <View style={{ backgroundColor: COLORS.surface.warm, borderRadius: BORDER_RADIUS.xl, padding: 12 }}>
                            <Text style={{ color: COLORS.text.secondary, fontSize: 11, fontStyle: "italic" }}>Distribution pending</Text>
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
        <Text style={{ color: COLORS.text.secondary, fontSize: 10 }}>Payment History &bull; {committee.name}</Text>
      </View>
    </ScrollView>
    <AlertComponent />
    </>
  );
}
