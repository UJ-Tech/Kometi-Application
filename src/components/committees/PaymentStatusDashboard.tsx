import React, { useState, useEffect, useCallback } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { committeesApi } from "../../services/committees.api";
import { formatINR } from "../../utils/currency";
import { COLORS, BORDER_RADIUS, SPACING } from "../../constants/theme";
import Card from "../ui/Card";
import Badge from "../ui/Badge";
import type { PaymentDashboard } from "../../types";

interface Props {
  committeeId: string;
}

export default function PaymentStatusDashboard({ committeeId }: Props) {
  const [data, setData] = useState<PaymentDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const res = await committeesApi.getPaymentDashboard(committeeId);
      setData(res.data.data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [committeeId]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleMonth = (monthId: string) => {
    setExpandedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(monthId)) next.delete(monthId);
      else next.add(monthId);
      return next;
    });
  };

  if (loading) {
    return (
      <View style={{ paddingVertical: 24, alignItems: "center" }}>
        <ActivityIndicator size="small" color={COLORS.brand[500]} />
      </View>
    );
  }

  if (!data || data.months.length === 0) return null;

  return (
    <View style={{ marginBottom: 24 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <View style={{ width: 4, height: 20, borderRadius: 2, backgroundColor: COLORS.success.DEFAULT }} />
        <Text style={{ color: COLORS.text.primary, fontSize: 15, fontWeight: "700" }}>Payment Status</Text>
        <Text style={{ color: COLORS.text.muted, fontSize: 11, marginLeft: 4 }}>Month-wise member-wise</Text>
      </View>

      {/* Legend */}
      <View style={{ flexDirection: "row", gap: 12, marginBottom: 8, paddingHorizontal: 4 }}>
        <LegendDot color="#22c55e" label="Paid" />
        <LegendDot color="#f59e0b" label="Pending" />
        <LegendDot color="#ef4444" label="Overdue" />
        <LegendDot color="#6366f1" label="Winner" />
      </View>

      {data.months.map((month) => {
        const isExpanded = expandedMonths.has(month.id);
        const totalMembers = month.members.length;
        const paidCount = month.members.filter((m) => m.status === "paid").length;
        const pendingCount = month.members.filter((m) => m.status === "pending" || !m.status).length;
        const overdueCount = month.members.filter((m) => m.status === "overdue" || m.status === "organiser_advanced").length;

        return (
          <View key={month.id} style={{ marginBottom: 8 }}>
            <TouchableOpacity
              onPress={() => toggleMonth(month.id)}
              activeOpacity={0.7}
              style={{
                flexDirection: "row", alignItems: "center",
                backgroundColor: COLORS.surface.card, borderRadius: BORDER_RADIUS.xl,
                padding: 14, borderWidth: 1, borderColor: COLORS.surface.border,
              }}
            >
              <View style={{
                width: 36, height: 36, borderRadius: 10,
                backgroundColor: month.status === "completed" ? "rgba(34,197,94,0.1)" : "rgba(245,158,11,0.1)",
                alignItems: "center", justifyContent: "center", marginRight: 12,
              }}>
                <Text style={{
                  color: month.status === "completed" ? "#22c55e" : "#f59e0b",
                  fontWeight: "700", fontSize: 13,
                }}>
                  M{month.monthNumber}
                </Text>
              </View>

              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={{ color: COLORS.text.primary, fontWeight: "700", fontSize: 13 }}>
                    Month #{month.monthNumber}
                  </Text>
                  {month.winnerName ? (
                    <Badge label={month.winnerName} variant="success" size="sm" dot />
                  ) : null}
                  {month.status !== "completed" ? (
                    <Badge label={month.status} variant="warning" size="sm" dot />
                  ) : null}
                </View>
                <Text style={{ color: COLORS.text.muted, fontSize: 10, marginTop: 2 }}>
                  {paidCount} paid · {pendingCount} pending{overdueCount > 0 ? ` · ${overdueCount} overdue` : ""}
                  {month.winnerName ? ` · Winner: ${month.winnerName}` : ""}
                </Text>
              </View>

              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <View style={{ flexDirection: "row", gap: 2 }}>
                  {month.members.slice(0, 4).map((m) => (
                    <View key={m.memberId} style={{
                      width: 8, height: 8, borderRadius: 4,
                      backgroundColor: m.role === "winner" ? "#6366f1"
                        : m.status === "paid" ? "#22c55e"
                        : m.status === "overdue" || m.status === "organiser_advanced" ? "#ef4444"
                        : "#f59e0b",
                    }} />
                  ))}
                  {totalMembers > 4 ? (
                    <Text style={{ color: COLORS.text.muted, fontSize: 8, marginLeft: 2 }}>+{totalMembers - 4}</Text>
                  ) : null}
                </View>
                <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={16} color={COLORS.text.muted} />
              </View>
            </TouchableOpacity>

            {/* Expanded member list */}
            {isExpanded && (
              <View style={{
                marginTop: 2, borderRadius: BORDER_RADIUS.lg, overflow: "hidden",
                borderWidth: 1, borderColor: COLORS.surface.border,
              }}>
                {/* Header row */}
                <View style={{
                  flexDirection: "row", backgroundColor: COLORS.surface.warm || "#f5f0eb",
                  paddingVertical: 8, paddingHorizontal: 14,
                }}>
                  <Text style={{ width: 28, color: COLORS.text.muted, fontWeight: "700", fontSize: 10 }}>#</Text>
                  <Text style={{ flex: 1, color: COLORS.text.muted, fontWeight: "700", fontSize: 10 }}>Member</Text>
                  <Text style={{ width: 60, textAlign: "right", color: COLORS.text.muted, fontWeight: "700", fontSize: 10 }}>Amount</Text>
                  <Text style={{ width: 60, textAlign: "right", color: COLORS.text.muted, fontWeight: "700", fontSize: 10 }}>Status</Text>
                </View>

                {/* Member rows */}
                {month.members.map((m, idx) => {
                  const isWinner = m.role === "winner";
                  const isPaid = m.status === "paid";
                  const isOverdue = m.status === "overdue" || m.status === "organiser_advanced";

                  return (
                    <View key={m.memberId} style={{
                      flexDirection: "row", alignItems: "center",
                      paddingVertical: 9, paddingHorizontal: 14,
                      backgroundColor: idx % 2 === 0 ? COLORS.surface.card : (COLORS.surface.warm || "#faf8f5"),
                      borderBottomWidth: idx < month.members.length - 1 ? 1 : 0,
                      borderBottomColor: COLORS.surface.border,
                    }}>
                      <Text style={{ width: 28, color: COLORS.text.muted, fontWeight: "600", fontSize: 12 }}>
                        {m.slotNumber}
                      </Text>
                      <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Text style={{
                          color: COLORS.text.primary, fontWeight: isWinner ? "700" : "500", fontSize: 12,
                          flexShrink: 1,
                        }} numberOfLines={1}>
                          {m.name}
                        </Text>
                        {isWinner && (
                          <Badge label="WIN" variant="info" size="sm" />
                        )}
                        {m.advancedByOrganiser && (
                          <Badge label="ADV" variant="warning" size="sm" />
                        )}
                      </View>
                      <Text style={{
                        width: 60, textAlign: "right",
                        color: isWinner ? COLORS.success.DEFAULT : COLORS.gold[600],
                        fontWeight: "700", fontSize: 12,
                      }}>
                        {formatINR(m.netAmount)}
                      </Text>
                      <View style={{ width: 60, alignItems: "flex-end" }}>
                        <StatusBadge status={m.status} direction={m.direction} />
                      </View>
                    </View>
                  );
                })}

                {/* Summary row */}
                <View style={{
                  flexDirection: "row", paddingVertical: 8, paddingHorizontal: 14,
                  backgroundColor: "#f8fafc", borderTopWidth: 1, borderTopColor: COLORS.surface.border,
                }}>
                  <Text style={{ flex: 1, color: COLORS.text.muted, fontWeight: "600", fontSize: 10 }}>
                    {month.members.filter((m) => m.role === "winner").length > 0
                      ? `Winner net: ${formatINR(month.winnerNetReceivable)}`
                      : `Non-winner net: ${formatINR(month.nonWinnerNetPayable)}`}
                  </Text>
                </View>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <Text style={{ color: COLORS.text.muted, fontSize: 10 }}>{label}</Text>
    </View>
  );
}

function StatusBadge({ status, direction }: { status: string | null; direction: string | null }) {
  if (direction === "receive") {
    return <Badge label="Receive" variant="info" size="sm" />;
  }

  switch (status) {
    case "paid":
      return <Badge label="Paid" variant="success" size="sm" dot />;
    case "overdue":
      return <Badge label="Overdue" variant="danger" size="sm" dot />;
    case "organiser_advanced":
      return <Badge label="Adv." variant="warning" size="sm" dot />;
    default:
      return <Badge label="Pending" variant="neutral" size="sm" />;
  }
}
