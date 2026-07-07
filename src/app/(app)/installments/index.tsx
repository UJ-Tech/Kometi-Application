import React, { useState, useEffect } from "react";
import { View, Text, FlatList, TouchableOpacity, RefreshControl } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useInstallmentStore } from "../../../stores/installment.store";
import { useWalletStore } from "../../../stores/wallet.store";
import { formatINR } from "../../../utils/currency";
import { COLORS, BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from "../../../constants/theme";
import Card from "../../../components/ui/Card";
import Badge, { installmentVariant } from "../../../components/ui/Badge";
import Button from "../../../components/ui/Button";
import EmptyState from "../../../components/ui/EmptyState";
import ScreenHeader from "../../../components/shared/ScreenHeader";
import KKMark from "../../../components/brand/KKMark";
import { useAlertModal } from "../../../components/ui/AlertModal";

export default function Installments() {
  const { upcomingDues, isLoading, fetchUpcomingDues, payInstallment } = useInstallmentStore();
  const { balancePaise, fetchWalletData } = useWalletStore();
  const [refreshing, setRefreshing] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);
  const { alert, confirm, AlertComponent } = useAlertModal();

  const loadData = async () => {
    setRefreshing(true);
    await Promise.all([fetchUpcomingDues(), fetchWalletData()]);
    setRefreshing(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handlePay = async (id: string, amountPaise: bigint) => {
    if (BigInt(balancePaise) < amountPaise) {
      await alert(
        "Insufficient Balance",
        `Your wallet balance (${formatINR(balancePaise)}) is less than the due amount (${formatINR(amountPaise)}). Please top up your wallet first.`
      );
      return;
    }

    const ok = await confirm(
      "Confirm Payment",
      `Are you sure you want to pay ${formatINR(amountPaise)} for this installment?`,
      { confirmLabel: "Pay Now" }
    );
    if (ok) {
      try {
        setPayingId(id);
        await payInstallment(id, "WALLET");
        await alert("Success", "Installment payment completed successfully.");
        loadData();
      } catch (err: any) {
        await alert("Payment Failed", err.message || "An error occurred.");
      } finally {
        setPayingId(null);
      }
    }
  };

  const totalDue = upcomingDues.reduce((sum: bigint, item: any) => sum + BigInt(item.amountDuePaise), 0n);

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.surface.bg, paddingHorizontal: SPACING[5] }}>
      <ScreenHeader title="Dues" subtitle="Track and pay your upcoming chit installments" transparent />

      <FlatList
        data={upcomingDues}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={loadData}
            tintColor={COLORS.brandPrimary}
          />
        }
        contentContainerStyle={{ paddingBottom: 100 }}
        ListHeaderComponent={
          upcomingDues.length > 0 ? (
            <Card
              gradient
              gradientColors={["#1e1b4b", "#312e81"]}
              style={{ marginBottom: 24 }}
              padding={20}
            >
              <View className="mb-4">
                <View className="flex-row items-center gap-2 mb-2">
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.gold[400] }} />
                  <Text className="text-white/60 text-xs font-semibold tracking-wider uppercase">
                    Total Due
                  </Text>
                </View>
                <Text className="text-white text-3xl font-bold" style={{ letterSpacing: -1 }}>
                  {formatINR(totalDue)}
                </Text>
                <Text className="text-white/40 text-xs mt-1">
                  {upcomingDues.length} installment(s) pending
                </Text>
              </View>
              <View className="flex-row gap-3">
                <TouchableOpacity
                  className="flex-1 h-11 rounded-xl items-center justify-center"
                  style={{ backgroundColor: "rgba(255,255,255,0.1)" }}
                >
                  <Text className="text-white font-bold text-sm">Pay All</Text>
                </TouchableOpacity>
              </View>
            </Card>
          ) : null
        }
        ListEmptyComponent={
          !isLoading ? (
            <View style={{ flex: 1, paddingTop: 80 }}>
              <EmptyState
                icon="calendar-clear-outline"
                title="No dues pending"
                description="You're all caught up! All your installments are paid."
              />
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const isOverdue = item.status === "OVERDUE";
          return (
            <TouchableOpacity activeOpacity={0.85}>
              <Card
                style={{ marginBottom: 12 }}
                padding={16}
                accent={isOverdue ? "danger" : item.status === "PAID" ? "success" : "brand"}
              >
                <View className="flex-row items-start justify-between">
                  <View className="flex-row items-center flex-1">
                    <View className={`w-10 h-10 rounded-xl items-center justify-center ${
                      isOverdue ? "bg-red-500/10" : item.status === "PAID" ? "bg-green-500/10" : "bg-brand-500/10"
                    }`}>
                      <Ionicons
                        name={isOverdue ? "alert-circle" : item.status === "PAID" ? "checkmark-circle" : "calendar-outline"}
                        size={20}
                        color={isOverdue ? COLORS.danger.DEFAULT : item.status === "PAID" ? COLORS.success.DEFAULT : COLORS.brand[500]}
                      />
                    </View>
                    <View className="ml-3 flex-1">
                      <Text className="text-slate-800 font-bold text-sm">
                        {item.committee?.name || "Committee"}
                      </Text>
                      <View className="flex-row items-center gap-2 mt-0.5">
                        <Text className="text-slate-400 text-xs">
                          Cycle #{item.cycleNo}
                        </Text>
                        <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: COLORS.text.muted }} />
                        <Text className="text-slate-400 text-xs">
                          Due {new Date(item.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <View className="items-end">
                    <Text className={`font-bold text-sm ${isOverdue ? "text-red-600" : "text-slate-800"}`}>
                      {formatINR(item.amountDuePaise)}
                    </Text>
                    <Badge label={item.status} variant={installmentVariant(item.status)} size="sm" dot />
                  </View>
                </View>

                {item.status !== "PAID" && (
                  <View className="mt-4 pt-3 border-t border-slate-100">
                    <Button
                      label={payingId === item.id ? "Paying..." : `Pay ${formatINR(item.amountDuePaise)}`}
                      variant="primary"
                      size="sm"
                      gradient
                      isLoading={payingId === item.id}
                      onPress={() => handlePay(item.id, BigInt(item.amountDuePaise))}
                      disabled={payingId === item.id}
                    />
                  </View>
                )}
              </Card>
            </TouchableOpacity>
          );
        }}
      />
      <AlertComponent />
    </View>
  );
}
