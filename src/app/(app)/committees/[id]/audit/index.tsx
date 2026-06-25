// src/app/(app)/committees/[id]/audit/index.tsx
// Read-only Audit Log / Transparency Panel — visible to ALL committee members.
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { committeesApi } from "../../../../../services/committees.api";
import { useAuthStore } from "../../../../../stores/auth.store";
import { formatINR } from "../../../../../utils/currency";
import { COLORS } from "../../../../../constants/theme";
import Card from "../../../../../components/ui/Card";
import Badge from "../../../../../components/ui/Badge";
import { useAlertModal } from "../../../../../components/ui/AlertModal";

const F = (p: number | bigint | null | undefined) => formatINR(p ?? 0);
const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export default function AuditLogScreen() {
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const isValidId = !!id && id !== "undefined" && id !== "null";
  const router = useRouter();
  const currentUser = useAuthStore((s) => s.user);

  const [committee, setCommittee] = useState<any>(null);
  const [monthsData, setMonthsData] = useState<any>(null);
  const [monthDetails, setMonthDetails] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null);
  const { alert, confirm, AlertComponent } = useAlertModal();

  const loadData = useCallback(async () => {
    if (!isValidId) return;
    setError(null);
    try {
      const cRes = await committeesApi.getById(id);
      setCommittee(cRes.data.data);
    } catch {
      setError("Failed to load committee.");
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const mRes = await committeesApi.getMonths(id);
      setMonthsData(mRes.data.data);
    } catch {
      setError("Failed to load months data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id, isValidId]);

  useEffect(() => {
    if (isValidId) loadData();
    else { setLoading(false); setError("Invalid committee ID"); }
  }, [isValidId, loadData]);

  const onRefresh = useCallback(() => { setRefreshing(true); loadData(); }, [loadData]);

  const loadMonthDetail = async (monthId: string) => {
    if (monthDetails[monthId]) { setExpandedMonth(expandedMonth === monthId ? null : monthId); return; }
    try {
      setLoadingDetail(monthId);
      const res = await committeesApi.getMonth(id, monthId);
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
      <View className="flex-1 bg-surface-50 items-center justify-center px-6">
        <Ionicons name="alert-circle-outline" size={40} color={COLORS.danger.light} />
        <Text className="text-slate-900 font-bold text-lg mt-4">Invalid Committee</Text>
        <TouchableOpacity onPress={() => router.back()} className="mt-4">
          <Text className="text-brand-600 text-sm font-medium">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading && !refreshing) {
    return (
      <View className="flex-1 bg-surface-50 items-center justify-center">
        <ActivityIndicator size="large" color={COLORS.brandPrimary} />
        <Text className="text-slate-500 text-sm mt-4">Loading audit log...</Text>
      </View>
    );
  }

  if (error && !committee) {
    return (
      <View className="flex-1 bg-surface-50 items-center justify-center px-6">
        <Ionicons name="cloud-offline-outline" size={40} color={COLORS.warning.light} />
        <Text className="text-slate-900 font-bold text-lg mt-4">{error}</Text>
        <TouchableOpacity onPress={loadData} className="mt-4 bg-brand-500 px-5 py-2.5 rounded-xl">
          <Text className="text-slate-900 font-bold text-sm">Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!committee || !monthsData) return null;

  const members: any[] = committee.members || [];
  const months: any[] = monthsData.months || [];
  const totalMembers = monthsData.totalMembers || 0;
  // Total pool and fee info available from API if needed for future display

  const myMember = members.find((m: any) => m.userId === currentUser?.id);
  const myMemberId = myMember?.id;

  const q = search.toLowerCase().trim();

  // Filtered months
  const filteredMonths = months.filter((m: any) => {
    if (!q) return true;
    if (String(m.monthNumber).includes(q)) return true;
    if (m.resolutionType?.toLowerCase().includes(q)) return true;
    return false;
  });

  // Filtered members
  const filteredMembers = members.filter((m: any) => {
    if (!q) return true;
    const name = m.user?.name?.toLowerCase() || "";
    const slot = String(m.slotNumber);
    return name.includes(q) || slot.includes(q);
  });

  // ─── Section 2: Personal Ledger ──────────────────────────────────────
  let myTotalContributed = 0;
  let myTotalReceived = 0;
  const myLedger: any[] = [];

  if (myMemberId) {
    months.forEach((month: any) => {
      const detail = monthDetails[month.id];
      const contrib = detail?.monthlyContributions?.find((c: any) => c.memberId === myMemberId);
      const dist = detail?.memberDistributions?.find((d: any) => d.memberId === myMemberId);
      const paid = contrib?.amountPaid || 0;
      const lateFee = contrib?.lateFeeAmount || 0;
      const received = dist?.distributionAmount || 0;
      const interest = dist?.interestShare || 0;
      myTotalContributed += paid + lateFee;
      myTotalReceived += received + interest;
      myLedger.push({ month, paid, lateFee, received, interest });
    });
  }
  const remainingMonths = totalMembers - months.length;
  const projectedMonthly = monthsData.contributionPerPerson || 0;
  const projectedTotal = myTotalContributed + projectedMonthly * remainingMonths;

  // ─── Section 3: Member Status Board ──────────────────────────────────
  const memberBoard = members.map((m: any) => {
    const hasWon = m.hasReceivedPayout;
    let totalContrib = 0;
    let totalRecv = 0;
    months.forEach((month: any) => {
      const detail = monthDetails[month.id];
      const contrib = detail?.monthlyContributions?.find((c: any) => c.memberId === m.id);
      const dist = detail?.memberDistributions?.find((d: any) => d.memberId === m.id);
      totalContrib += (contrib?.amountPaid || 0) + (contrib?.lateFeeAmount || 0);
      totalRecv += (dist?.distributionAmount || 0) + (dist?.interestShare || 0);
    });
    const status = !m.isActive ? "Exited" : hasWon ? "Won" : m.hasReceivedPayout === false ? "Active" : "Active";
    return { ...m, hasWon, totalContrib, totalRecv, status };
  });

  // ─── PDF Generation ──────────────────────────────────────────────────
  const generatePDF = async (monthData: any) => {
    try {
      setGeneratingPdf(monthData.id);
      const detail = monthData.id ? monthDetails[monthData.id] : null;
      const bids = detail?.bids || [];

      const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/>
<style>
  body { font-family: Arial, sans-serif; padding: 30px; color: #333; }
  h1 { font-size: 20px; margin-bottom: 4px; }
  h2 { font-size: 16px; color: #555; margin-top: 20px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
  .meta { font-size: 12px; color: #888; margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }
  th { background: #f5f5f5; text-align: left; padding: 8px; border-bottom: 2px solid #ddd; font-weight: 600; }
  td { padding: 8px; border-bottom: 1px solid #eee; }
  .amount { text-align: right; font-weight: 600; }
  .footer { margin-top: 30px; font-size: 11px; color: #aaa; text-align: center; }
</style></head>
<body>
  <h1>${committee.name} — Monthly Statement</h1>
  <div class="meta">Month #${monthData.monthNumber} &bull; ${fmtDate(monthData.monthDate)} &bull; ${monthData.resolutionType?.replace("_", " ")}</div>
  <div class="meta">Generated: ${new Date().toLocaleString("en-IN")} &bull; Committee Organiser: ${committee.organizer?.name || "N/A"}</div>

  <h2>Month Summary</h2>
  <table>
    <tr><td>Total Pool</td><td class="amount">${F(monthData.totalPool)}</td></tr>
    <tr><td>Winning Bid</td><td class="amount">${F(monthData.winningBidAmount)}</td></tr>
    <tr><td>Interest Amount</td><td class="amount">${F(monthData.interestAmount)}</td></tr>
    <tr><td>Per-Member Distribution</td><td class="amount">${F(monthData.perMemberDistribution)}</td></tr>
    <tr><td>Remaining Balance</td><td class="amount">${F(monthData.remainingBalance)}</td></tr>
  </table>

  ${bids.length > 0 ? `
  <h2>Bids Placed</h2>
  <table>
    <tr><th>#</th><th>Member</th><th>Slot</th><th class="amount">Bid Amount</th><th>Status</th></tr>
    ${bids.map((b: any, i: number) => `
    <tr>
      <td>${i + 1}</td>
      <td>${b.committeeMember?.user?.name || "Member"}</td>
      <td>${b.committeeMember?.slotNumber || "-"}</td>
      <td class="amount">${F(b.bidAmount)}</td>
      <td>${b.status}</td>
    </tr>`).join("")}
  </table>` : "<p>No bids were placed for this month (lottery resolution).</p>"}

  <div class="footer">This is a system-generated statement from Kometi App.</div>
</body></html>`;

      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: `Month ${monthData.monthNumber} Statement` });
    } catch {
      await alert("Error", "Failed to generate PDF.");
    } finally {
      setGeneratingPdf(null);
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────
  return (
    <ScrollView
      className="flex-1 bg-surface-50"
      contentContainerStyle={{ paddingTop: 64, paddingBottom: 120 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.brandPrimary} />}
    >
      {/* Header */}
      <View className="px-4 flex-row items-center mb-5">
        <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 bg-surface-card rounded-full items-center justify-center border border-brand-primary/10 mr-4">
          <Ionicons name="arrow-back" size={20} color="#1a1a2e" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-slate-900 text-xl font-bold">Audit Log</Text>
          <Text className="text-slate-400 text-xs">{committee.name}</Text>
        </View>
        <View className="w-10 h-10 bg-brand-500/10 rounded-full items-center justify-center">
          <Ionicons name="document-text-outline" size={18} color={COLORS.brandPrimary} />
        </View>
      </View>

      {/* Search */}
      <View className="px-4 mb-5">
        <View className="bg-surface-card border border-brand-primary/10 rounded-xl px-4 h-11 flex-row items-center">
          <Ionicons name="search" size={16} color={COLORS.text.muted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Filter by month, member name, or slot..."
            placeholderTextColor="#94a3b8"
            className="flex-1 text-slate-900 text-sm ml-2"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={16} color={COLORS.text.muted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* SECTION 1 — Monthly Summary Table                                */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <View className="px-4 mb-6">
        <View className="flex-row items-center mb-3">
          <View className="w-7 h-7 rounded-lg bg-brand-500/15 items-center justify-center mr-2">
            <Ionicons name="calendar-outline" size={14} color={COLORS.brandPrimary} />
          </View>
          <Text className="text-slate-900 font-bold text-sm">Monthly Summary</Text>
          <Text className="text-slate-500 text-xs ml-auto">{filteredMonths.length} months</Text>
        </View>

        {filteredMonths.length === 0 ? (
          <Card>
            <View className="items-center py-6">
              <Ionicons name="document-outline" size={28} color={COLORS.text.muted} />
              <Text className="text-slate-500 text-xs mt-2">No months found</Text>
            </View>
          </Card>
        ) : (
          filteredMonths.map((month: any) => {
            const isExpanded = expandedMonth === month.id;
            const winner = members.find((m: any) => m.id === month.winnerMemberId);
            const isLoadingDet = loadingDetail === month.id;

            return (
              <View key={month.id} className="mb-3">
                <TouchableOpacity onPress={() => loadMonthDetail(month.id)} activeOpacity={0.7}>
                  <Card padding={0}>
                    <View className="p-3.5">
                      <View className="flex-row items-center justify-between mb-1.5">
                        <View className="flex-row items-center flex-1">
                          <Text className="text-slate-900 font-bold text-sm mr-2">#{month.monthNumber}</Text>
                          <Badge
                            label={month.status === "completed" ? "Completed" : month.status === "bidding_open" ? "Active" : "Pending"}
                            variant={month.status === "completed" ? "success" : month.status === "bidding_open" ? "info" : "neutral"}
                            size="sm"
                          />
                        </View>
                        {isLoadingDet ? (
                          <ActivityIndicator size="small" color={COLORS.brandPrimary} />
                        ) : (
                          <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={18} color={COLORS.text.muted} />
                        )}
                      </View>

                      <Text className="text-slate-500 text-[10px] mb-2">{fmtDate(month.monthDate)} &bull; {month.resolutionType?.replace("_", " ")}</Text>

                      <View className="flex-row flex-wrap gap-x-4 gap-y-1">
                        <Text className="text-slate-400 text-[10px]">Winner: <Text className="text-slate-900 font-semibold">{winner?.user?.name || "N/A"}</Text></Text>
                        <Text className="text-slate-400 text-[10px]">Bid: <Text className="text-gold-600 font-semibold">{F(month.winningBidAmount)}</Text></Text>
                        <Text className="text-slate-400 text-[10px]">Interest: <Text className="text-slate-900 font-semibold">{F(month.interestAmount)}</Text></Text>
                        <Text className="text-slate-400 text-[10px]">/share: <Text className="text-success-600 font-semibold">{F(month.perMemberDistribution)}</Text></Text>
                      </View>

                      {/* Download PDF */}
                      <TouchableOpacity
                        onPress={() => generatePDF(month)}
                        disabled={generatingPdf === month.id}
                        className="mt-2.5 bg-brand-500/10 px-3 py-1.5 rounded-lg self-start flex-row items-center"
                      >
                        {generatingPdf === month.id ? (
                          <ActivityIndicator size="small" color={COLORS.brandPrimary} />
                        ) : (
                          <Ionicons name="download-outline" size={13} color={COLORS.brandPrimary} />
                        )}
                        <Text className="text-brand-600 text-[10px] font-semibold ml-1.5">
                          {generatingPdf === month.id ? "Generating..." : "Download PDF"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </Card>
                </TouchableOpacity>

                {/* Expanded: Bids List */}
                {isExpanded && monthDetails[month.id] && (
                  <View className="ml-4 mt-2 mb-1">
                    <Card gradient padding={0}>
                      <View className="p-3">
                        <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-2">Bids Placed</Text>
                        {(monthDetails[month.id].bids || []).length === 0 ? (
                          <Text className="text-slate-500 text-xs italic">No bids — resolved via lottery</Text>
                        ) : (
                          (monthDetails[month.id].bids || []).map((bid: any, i: number) => (
                            <View key={bid.id} className="flex-row items-center py-1.5 border-b border-brand-primary/5">
                              <View className="w-6 h-6 rounded-full bg-brand-500/10 items-center justify-center mr-2">
                                <Text className="text-brand-600 text-[9px] font-bold">{i + 1}</Text>
                              </View>
                              <Text className="text-slate-900 text-xs flex-1">{bid.committeeMember?.user?.name || "Member"}</Text>
                              <Text className="text-gold-600 text-xs font-bold">{F(bid.bidAmount)}</Text>
                              <Badge label={bid.status} variant={bid.status === "won" ? "success" : bid.status === "lost" ? "danger" : "neutral"} size="sm" />
                            </View>
                          ))
                        )}
                      </View>
                    </Card>
                  </View>
                )}
              </View>
            );
          })
        )}
      </View>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* SECTION 2 — My Personal Ledger                                   */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {myMemberId && (
        <View className="px-4 mb-6">
          <View className="flex-row items-center mb-3">
            <View className="w-7 h-7 rounded-lg bg-success-500/15 items-center justify-center mr-2">
              <Ionicons name="person-outline" size={14} color={COLORS.success.light} />
            </View>
            <Text className="text-slate-900 font-bold text-sm">My Personal Ledger</Text>
          </View>

          <Card padding={0}>
            <View className="p-3.5">
              {/* Totals */}
              <View className="flex-row flex-wrap mb-3 gap-3">
                <View className="flex-1 min-w-[100px] bg-surface-50 rounded-lg p-2.5">
                  <Text className="text-slate-500 text-[9px] uppercase font-bold">Total Contributed</Text>
                  <Text className="text-danger-600 font-bold text-sm mt-0.5">{F(myTotalContributed)}</Text>
                </View>
                <View className="flex-1 min-w-[100px] bg-surface-50 rounded-lg p-2.5">
                  <Text className="text-slate-500 text-[9px] uppercase font-bold">Total Received</Text>
                  <Text className="text-success-600 font-bold text-sm mt-0.5">{F(myTotalReceived)}</Text>
                </View>
              </View>
              <View className="bg-surface-50 rounded-lg p-2.5 mb-3">
                <Text className="text-slate-500 text-[9px] uppercase font-bold">Projected Total (if no bid)</Text>
                <Text className="text-brand-600 font-bold text-sm mt-0.5">{F(projectedTotal)} <Text className="text-slate-500 text-[9px] font-normal">({remainingMonths} months remaining)</Text></Text>
              </View>

              {/* Per-month table */}
              {myLedger.length > 0 && (
                <View>
                  <View className="flex-row pb-1.5 border-b border-brand-primary/10">
                    <Text className="w-10 text-slate-400 font-bold text-[9px]">Month</Text>
                    <Text className="flex-1 text-slate-400 font-bold text-[9px] text-right">Paid</Text>
                    <Text className="w-16 text-slate-400 font-bold text-[9px] text-right">Late Fee</Text>
                    <Text className="flex-1 text-slate-400 font-bold text-[9px] text-right">Received</Text>
                    <Text className="w-16 text-slate-400 font-bold text-[9px] text-right">Interest</Text>
                  </View>
                  {myLedger.map((entry: any) => (
                    <View key={entry.month.id} className="flex-row py-1.5 border-b border-brand-primary/5">
                      <Text className="w-10 text-slate-900 font-semibold text-xs">#{entry.month.monthNumber}</Text>
                      <Text className="flex-1 text-danger-600 text-xs text-right">{entry.paid > 0 ? F(entry.paid) : "-"}</Text>
                      <Text className="w-16 text-warning-600 text-xs text-right">{entry.lateFee > 0 ? F(entry.lateFee) : "-"}</Text>
                      <Text className="flex-1 text-success-600 text-xs text-right">{entry.received > 0 ? F(entry.received) : "-"}</Text>
                      <Text className="w-16 text-slate-300 text-xs text-right">{entry.interest > 0 ? F(entry.interest) : "-"}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </Card>
        </View>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* SECTION 3 — Member Status Board                                  */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <View className="px-4 mb-6">
        <View className="flex-row items-center mb-3">
          <View className="w-7 h-7 rounded-lg bg-gold-500/15 items-center justify-center mr-2">
            <Ionicons name="people-outline" size={14} color={COLORS.goldPrimary} />
          </View>
          <Text className="text-slate-900 font-bold text-sm">Member Status Board</Text>
          <Text className="text-slate-500 text-xs ml-auto">{filteredMembers.length} members</Text>
        </View>

        <Card padding={0}>
          <View className="p-3.5">
            <View className="flex-row pb-1.5 border-b border-brand-primary/10">
              <Text className="w-8 text-slate-400 font-bold text-[9px]">#</Text>
              <Text className="flex-1 text-slate-400 font-bold text-[9px]">Member</Text>
              <Text className="w-10 text-slate-400 font-bold text-[9px] text-right">Won</Text>
              <Text className="flex-1 text-slate-400 font-bold text-[9px] text-right">Contributed</Text>
              <Text className="flex-1 text-slate-400 font-bold text-[9px] text-right">Received</Text>
              <Text className="w-14 text-slate-400 font-bold text-[9px] text-right">Status</Text>
            </View>

            {filteredMembers.map((m: any) => {
              const boardEntry = memberBoard.find((b: any) => b.id === m.id) || m;
              const isMe = m.userId === currentUser?.id;
              const initials = (m.user?.name || "M").split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
              return (
                <View key={m.id} className={`flex-row items-center py-2 border-b border-brand-primary/5 ${isMe ? "bg-brand-500/5" : ""}`}>
                  <View className="w-8 h-8 rounded-full bg-surface-elevated items-center justify-center mr-2">
                    <Text className="text-brand-600 text-[9px] font-bold">{initials}</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-slate-900 text-xs font-semibold">{m.user?.name || "Member"}</Text>
                    <Text className="text-slate-500 text-[9px]">Slot {m.slotNumber}{isMe ? " (You)" : ""}</Text>
                  </View>
                  <Text className="w-10 text-center text-xs">{boardEntry.hasWon ? "✅" : "—"}</Text>
                  <Text className="flex-1 text-danger-600 text-xs text-right font-semibold">{F(boardEntry.totalContrib)}</Text>
                  <Text className="flex-1 text-success-600 text-xs text-right font-semibold">{F(boardEntry.totalRecv)}</Text>
                  <View className="w-14 items-end">
                    <Badge
                      label={boardEntry.status}
                      variant={boardEntry.status === "Won" ? "success" : boardEntry.status === "Exited" ? "danger" : "neutral"}
                      size="sm"
                    />
                  </View>
                </View>
              );
            })}

            {filteredMembers.length === 0 && (
              <Text className="text-slate-500 text-xs text-center py-4">No members match your search</Text>
            )}
          </View>
        </Card>
      </View>

      {/* Footer */}
      <View className="px-4 items-center mb-6">
        <Text className="text-slate-600 text-[10px]">Audit Log &bull; {committee.name} &bull; All data is read-only</Text>
      </View>

      <AlertComponent />
    </ScrollView>
  );
}
