import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useWalletStore } from "../../../stores/wallet.store";
import { useAuthStore } from "../../../stores/auth.store";
import { paymentsApi, type SavedPaymentMethod } from "../../../services/payments.api";
import { formatINR } from "../../../utils/currency";
import { COLORS, BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from "../../../constants/theme";
import Card from "../../../components/ui/Card";
import Button from "../../../components/ui/Button";
import EmptyState from "../../../components/ui/EmptyState";
import ScreenHeader from "../../../components/shared/ScreenHeader";
import { AmountInput } from "../../../components/ui/AmountInput";
import type { Withdrawal } from "../../../types";
import { useAlertModal } from "../../../components/ui/AlertModal";

const MIN_WITHDRAWAL_PAISE = 10_000;

export default function WithdrawScreen() {
  const router = useRouter();
  const { balancePaise, withdrawals, isTransacting, fetchWalletData, fetchWithdrawals, requestWithdrawal, cancelWithdrawal } =
    useWalletStore();
  const currentUser = useAuthStore((s: any) => s.user);

  const [refreshing, setRefreshing] = useState(false);
  const [amount, setAmount] = useState<bigint>(0n);
  const [paymentMethods, setPaymentMethods] = useState<SavedPaymentMethod[]>([]);
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null);
  const [loadingMethods, setLoadingMethods] = useState(true);

  const kycVerified = currentUser?.kycStatus === "VERIFIED";
  const { alert, confirm, AlertComponent } = useAlertModal();

  const loadData = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchWalletData(), fetchWithdrawals()]);
    try {
      const res = await paymentsApi.listMethods();
      const verified = (res.data.data || []).filter((m: SavedPaymentMethod) => m.is_verified);
      setPaymentMethods(verified);
      if (verified.length > 0 && !selectedMethodId) {
        const defaultMethod = verified.find((m: SavedPaymentMethod) => m.is_default) || verified[0];
        setSelectedMethodId(defaultMethod.id);
      }
    } catch {
      // Methods may not exist yet
    } finally {
      setLoadingMethods(false);
      setRefreshing(false);
    }
  }, [selectedMethodId]);

  useEffect(() => {
    loadData();
  }, []);

  const handleRequestWithdrawal = async () => {
    const amountNum = Number(amount);

    if (amountNum < MIN_WITHDRAWAL_PAISE) {
      await alert("Minimum Amount", `Minimum withdrawal amount is ${formatINR(MIN_WITHDRAWAL_PAISE)}`);
      return;
    }

    if (amountNum > Number(balancePaise)) {
      await alert("Insufficient Balance", "Withdrawal amount exceeds your available balance.");
      return;
    }

    if (!selectedMethodId) {
      await alert("No Payment Method", "Please add and verify a payment method first.");
      return;
    }

    if (!kycVerified) {
      await alert("KYC Required", "Please complete your KYC verification before requesting a withdrawal.");
      return;
    }

    const ok = await confirm(
      "Confirm Withdrawal",
      `Request withdrawal of ${formatINR(BigInt(amountNum))}? This will be processed within 24-48 hours.`,
      { confirmLabel: "Request" }
    );
    if (!ok) return;

    try {
      await requestWithdrawal(amountNum, selectedMethodId);
      await alert("Request Submitted", "Your withdrawal request has been submitted. You'll be notified once processed.");
      setAmount(0n);
      loadData();
    } catch (err: any) {
      await alert("Request Failed", err.message || "An error occurred.");
    }
  };

  const handleCancelWithdrawal = async (withdrawalId: string) => {
    const ok = await confirm("Cancel Withdrawal", "Are you sure you want to cancel this withdrawal request?");
    if (ok) {
      try {
        await cancelWithdrawal(withdrawalId);
        await alert("Cancelled", "Withdrawal request has been cancelled.");
        loadData();
      } catch (err: any) {
        await alert("Error", err.message || "Failed to cancel");
      }
    }
  };

  const recentWithdrawals = withdrawals.filter((w: Withdrawal) => w.status !== "cancelled").slice(0, 5);

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.surface.bg }}>
      <ScreenHeader title="Withdraw" showBack />

      <FlatList
        data={recentWithdrawals}
        keyExtractor={(item: Withdrawal) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={COLORS.brandPrimary} />
        }
        contentContainerStyle={{ paddingHorizontal: SPACING[5], paddingBottom: 100 }}
        ListHeaderComponent={
          <View className="py-4 gap-6">
            {/* Balance Info */}
            <View className="bg-white rounded-2xl p-5 border border-slate-100"
              style={{ ...SHADOWS.card }}
            >
              <View className="flex-row items-center gap-2 mb-2">
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.brand[400] }} />
                <Text className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Available Balance</Text>
              </View>
              <Text className="text-slate-900 text-3xl font-bold" style={{ letterSpacing: -1 }}>
                {formatINR(balancePaise)}
              </Text>
              <View className="mt-4">
                <AmountInput
                  label="Withdrawal Amount"
                  valuePaise={amount}
                  onChangePaise={setAmount}
                  placeholder="Enter amount to withdraw"
                  maxAmountPaise={BigInt(balancePaise)}
                />
                <Text className="text-slate-400 text-xs mt-1">
                  Min: {formatINR(MIN_WITHDRAWAL_PAISE)}
                </Text>
              </View>
            </View>

            {/* KYC Warning */}
            {!kycVerified && (
              <View className="flex-row items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4">
                <Ionicons name="shield-outline" size={20} color={COLORS.warning.dark} />
                <View className="flex-1">
                  <Text className="text-amber-700 font-bold text-sm">KYC Required</Text>
                  <Text className="text-amber-600 text-xs mt-0.5">
                    Complete KYC verification to enable withdrawals.
                  </Text>
                </View>
              </View>
            )}

            {/* Payment Methods */}
            <View>
              <View className="flex-row items-center gap-2 mb-3">
                <View className="w-1 h-5 rounded-full" style={{ backgroundColor: COLORS.brand[500] }} />
                <Text className="text-slate-800 text-base font-bold">Payment Method</Text>
              </View>
              {loadingMethods ? (
                <ActivityIndicator size="small" color={COLORS.brand[500]} />
              ) : paymentMethods.length > 0 ? (
                <View className="gap-2">
                  {paymentMethods.map((method: SavedPaymentMethod) => (
                    <TouchableOpacity
                      key={method.id}
                      onPress={() => setSelectedMethodId(method.id)}
                      className="flex-row items-center bg-white rounded-2xl p-4"
                      style={{
                        borderWidth: 1.5,
                        borderColor: selectedMethodId === method.id ? COLORS.brand[500] : COLORS.surface.border,
                        ...SHADOWS.cardSm,
                      }}
                    >
                      <View className="w-10 h-10 rounded-xl items-center justify-center" style={{ backgroundColor: "rgba(99,102,241,0.08)" }}>
                        <Ionicons name={method.type === "bank_account" ? "business-outline" : "phone-portrait-outline"} size={20} color={COLORS.brand[500]} />
                      </View>
                      <View className="ml-3 flex-1">
                        <Text className="text-slate-800 font-bold text-sm">{method.name}</Text>
                        <Text className="text-slate-400 text-xs mt-0.5">
                          {method.type === "bank_account" ? "Bank Account" : "UPI"} · {method.is_default ? "Default" : ""}
                        </Text>
                      </View>
                      {selectedMethodId === method.id && (
                        <Ionicons name="checkmark-circle" size={20} color={COLORS.brand[500]} />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <View className="bg-white rounded-2xl p-4 border border-dashed border-slate-200 items-center">
                  <Text className="text-slate-400 text-sm">No payment methods added yet.</Text>
                </View>
              )}
            </View>

            <Button
              label="Request Withdrawal"
              variant="primary"
              size="lg"
              gradient
              isLoading={isTransacting}
              onPress={handleRequestWithdrawal}
              disabled={amount <= 0n || isTransacting || !selectedMethodId || !kycVerified}
            />

            {/* Recent Withdrawals */}
            {recentWithdrawals.length > 0 && (
              <View>
                <View className="flex-row items-center gap-2 mb-3">
                  <View className="w-1 h-5 rounded-full" style={{ backgroundColor: COLORS.brand[500] }} />
                  <Text className="text-slate-800 text-base font-bold">Recent Requests</Text>
                </View>
              </View>
            )}
          </View>
        }
        renderItem={({ item }: { item: Withdrawal }) => {
          const statusColor = item.status === "completed" ? COLORS.success.DEFAULT :
            item.status === "failed" ? COLORS.danger.DEFAULT :
            item.status === "cancelled" ? COLORS.text.muted : COLORS.warning.DEFAULT;
          return (
            <View className="flex-row items-center bg-white rounded-2xl p-4 mb-3"
              style={{ borderWidth: 1, borderColor: COLORS.surface.border, ...SHADOWS.cardSm }}
            >
              <View className="w-10 h-10 rounded-xl items-center justify-center"
                style={{ backgroundColor: `${statusColor}15` }}
              >
                <Ionicons
                  name={item.status === "completed" ? "checkmark" : item.status === "failed" ? "close" : "time"}
                  size={18}
                  color={statusColor}
                />
              </View>
              <View className="ml-3 flex-1">
                <Text className="text-slate-800 font-bold text-sm">{formatINR(item.amount)}</Text>
                <Text className="text-slate-400 text-xs mt-0.5">
                  {new Date(item.requested_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  {" · "}
                  <Text style={{ color: statusColor, fontWeight: "600" }}>{item.status}</Text>
                </Text>
              </View>
              {(item.status === "requested" || item.status === "processing") && (
                <TouchableOpacity onPress={() => handleCancelWithdrawal(item.id)}>
                  <Text className="text-red-500 text-xs font-semibold">Cancel</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        }}
        ListEmptyComponent={null}
      />
      <AlertComponent />
    </View>
  );
}
