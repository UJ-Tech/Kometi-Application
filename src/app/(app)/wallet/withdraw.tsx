// src/app/(app)/wallet/withdraw.tsx
// Wallet withdrawal — request withdrawal to bank/UPI via Razorpay payouts.

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
import { COLORS } from "../../../constants/theme";
import Card from "../../../components/ui/Card";
import Button from "../../../components/ui/Button";
import EmptyState from "../../../components/ui/EmptyState";
import ScreenHeader from "../../../components/shared/ScreenHeader";
import { AmountInput } from "../../../components/ui/AmountInput";
import type { Withdrawal } from "../../../types";
import { useAlertModal } from "../../../components/ui/AlertModal";

const MIN_WITHDRAWAL_PAISE = 10_000; // ₹100

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
      // Methods may not exist yet — user needs to add a payment method
    } finally {
      setLoadingMethods(false);
      setRefreshing(false);
    }
  }, [fetchWalletData, fetchWithdrawals, selectedMethodId]);

  useEffect(() => {
    loadData();
  }, []);

  const availablePaise = BigInt(balancePaise);

  const handleSubmit = async () => {
    if (!kycVerified) {
      await alert("KYC Required", "Please complete KYC verification in Settings before withdrawing.");
      return;
    }

    const amountNum = Number(amount);
    if (amountNum < MIN_WITHDRAWAL_PAISE) {
      await alert("Minimum Amount", "Minimum withdrawal is ₹100.");
      return;
    }

    if (amountNum > balancePaise) {
      await alert("Insufficient Balance", "You don't have enough balance for this withdrawal.");
      return;
    }

    if (!selectedMethodId) {
      await alert("Payment Method", "Please select a verified bank account or UPI ID.");
      return;
    }

    try {
      await requestWithdrawal(
        withdrawals[0]?.committee_id || "",
        amountNum,
        selectedMethodId
      );
      await alert("Withdrawal Requested", "Your withdrawal request has been submitted and is being processed.");
      router.back();
    } catch (err: any) {
      await alert("Withdrawal Failed", err.message || "Something went wrong. Please try again.");
    }
  };

  const handleCancel = async (withdrawalId: string) => {
    const ok = await confirm("Cancel Withdrawal", "Are you sure you want to cancel this withdrawal request?", { confirmLabel: "Yes, Cancel" });
    if (ok) {
      try {
        await cancelWithdrawal(withdrawalId);
      } catch (err: any) {
        await alert("Error", err.message || "Failed to cancel withdrawal.");
      }
    }
  };

  const activeWithdrawals = withdrawals.filter(
    (w: Withdrawal) => w.status === "requested" || w.status === "processing"
  );

  const pastWithdrawals = withdrawals.filter(
    (w: Withdrawal) => w.status === "completed" || w.status === "failed" || w.status === "cancelled"
  );

  const statusConfig: Record<string, { color: string; bg: string; icon: string; label: string }> = {
    requested:  { color: "#f59e0b", bg: "rgba(245,158,11,0.10)", icon: "time-outline", label: "Pending" },
    processing: { color: "#3b82f6", bg: "rgba(59,130,246,0.10)", icon: "sync-outline", label: "Processing" },
    completed:  { color: "#22c55e", bg: "rgba(34,197,94,0.10)",  icon: "checkmark-circle-outline", label: "Completed" },
    failed:     { color: "#ef4444", bg: "rgba(239,68,68,0.10)",  icon: "close-circle-outline", label: "Failed" },
    cancelled:  { color: "#a3a3a3", bg: "rgba(163,163,163,0.10)", icon: "ban-outline", label: "Cancelled" },
  };

  const renderWithdrawal = ({ item }: { item: Withdrawal }) => {
    const sc = statusConfig[item.status] || statusConfig.requested;

    return (
      <View className="bg-surface-card border border-slate-100 rounded-xl p-4 mb-3">
        <View className="flex-row items-center justify-between mb-2">
          <View className="flex-row items-center">
            <View
              className="w-10 h-10 rounded-full items-center justify-center"
              style={{ backgroundColor: sc.bg }}
            >
              <Ionicons name={sc.icon as any} size={18} color={sc.color} />
            </View>
            <View className="ml-3">
              <Text className="text-slate-900 font-bold text-sm">
                {formatINR(item.amount)}
              </Text>
              <Text className="text-slate-500 text-xs mt-0.5">
                {new Date(item.requested_at).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}{" "}
                at{" "}
                {new Date(item.requested_at).toLocaleTimeString("en-IN", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
            </View>
          </View>

          <View
            className="px-2.5 py-1 rounded-full"
            style={{ backgroundColor: sc.bg }}
          >
            <Text className="text-xs font-bold" style={{ color: sc.color }}>
              {sc.label}
            </Text>
          </View>
        </View>

        {item.status === "failed" && item.failure_reason && (
          <Text className="text-red-600 text-xs mt-1">{item.failure_reason}</Text>
        )}

        {item.status === "requested" && (
          <View className="flex-row justify-end mt-2">
            <Button
              label="Cancel"
              variant="ghost"
              size="sm"
              fullWidth={false}
              onPress={() => handleCancel(item.id)}
              disabled={isTransacting}
            />
          </View>
        )}
      </View>
    );
  };

  return (
    <View className="flex-1 bg-surface-bg">
      <ScreenHeader
        title="Withdraw Funds"
        subtitle="Transfer wallet balance to your bank account"
        showBack
      />

      <FlatList
        data={[]}
        keyExtractor={() => "empty"}
        renderItem={() => null}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={loadData}
            tintColor={COLORS.brandPrimary}
          />
        }
        contentContainerStyle={{ paddingBottom: 100 }}
        ListHeaderComponent={
          <View className="px-4">
            {/* KYC Warning */}
            {!kycVerified && (
              <Card style={{ marginBottom: 16, borderColor: "rgba(217,119,6,0.3)" }}>
                <View className="p-4 flex-row items-center">
                  <Ionicons name="warning-outline" size={20} color="#d97706" />
                  <View className="ml-3 flex-1">
                    <Text className="text-warning-600 font-bold text-sm">KYC Verification Required</Text>
                    <Text className="text-slate-500 text-xs mt-0.5">
                      Complete your KYC in Settings to enable withdrawals.
                    </Text>
                  </View>
                </View>
              </Card>
            )}

            {/* Balance Card */}
            <Card gradient style={{ marginBottom: 16 }}>
              <View className="p-5">
                <Text className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-1">
                  Available for Withdrawal
                </Text>
                <Text className="text-white text-3xl font-bold">
                  {formatINR(availablePaise)}
                </Text>
              </View>
            </Card>

            {/* Withdrawal Form */}
            {kycVerified && (
              <Card style={{ marginBottom: 16 }}>
                <View className="p-5">
                  <Text className="text-slate-900 font-bold text-sm mb-3">Withdraw Amount</Text>
                  <AmountInput
                    label="Enter Amount"
                    valuePaise={amount}
                    onChangePaise={setAmount}
                    placeholder="e.g. 5,000.00"
                    maxAmountPaise={availablePaise}
                  />

                  {/* Quick Amount Buttons */}
                  <View className="flex-row gap-2 mb-4">
                    {[1000_00, 5000_00, 10000_00].map((amt) => (
                      <TouchableOpacity
                        key={amt}
                        onPress={() => setAmount(BigInt(Math.min(amt, Number(availablePaise))))}
                        className="bg-brand-50 border border-brand-200/55 py-1.5 px-3 rounded-lg flex-1"
                      >
                        <Text className="text-brand-600 text-xs font-bold text-center">
                          +₹{(amt / 100).toLocaleString("en-IN")}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Payment Method Selection */}
                  {loadingMethods ? (
                    <View className="flex-row items-center justify-center py-4">
                      <ActivityIndicator size="small" color={COLORS.brandPrimary} />
                      <Text className="text-slate-500 text-xs ml-2">Loading payment methods...</Text>
                    </View>
                  ) : paymentMethods.length === 0 ? (
                    <View className="bg-slate-50 rounded-xl p-4 mb-4 border border-slate-100">
                      <View className="flex-row items-center">
                        <Ionicons name="card-outline" size={18} color="#64748b" />
                        <View className="ml-3 flex-1">
                          <Text className="text-slate-900 text-xs font-semibold">No verified payment methods</Text>
                          <Text className="text-slate-500 text-[10px] mt-0.5">
                            Add a bank account or UPI ID in Settings to enable withdrawals.
                          </Text>
                        </View>
                      </View>
                    </View>
                  ) : (
                    <View className="mb-4">
                      <Text className="text-slate-600 text-xs font-semibold mb-2 ml-1">
                        Send to
                      </Text>
                      {paymentMethods.map((method) => (
                        <TouchableOpacity
                          key={method.id}
                          onPress={() => setSelectedMethodId(method.id)}
                          className={`flex-row items-center p-3 rounded-xl mb-2 border ${
                            selectedMethodId === method.id
                              ? "border-brand-500 bg-brand-50"
                              : "border-slate-100 bg-slate-50"
                          }`}
                        >
                          <View className="w-8 h-8 rounded-full items-center justify-center bg-surface-card">
                            <Ionicons
                              name={method.method_type === "upi" ? "phone-portrait-outline" : "business-outline"}
                              size={14}
                              color={selectedMethodId === method.id ? COLORS.brandPrimary : "#64748b"}
                            />
                          </View>
                          <View className="ml-3 flex-1">
                            <Text className="text-slate-900 text-xs font-bold">
                              {method.method_type === "upi"
                                ? method.upi_id
                                : `${method.account_holder_name}`}
                            </Text>
                            {method.method_type === "bank_account" && method.ifsc_code && (
                              <Text className="text-slate-500 text-[10px] mt-0.5">
                                {method.bank_account_number?.slice(-4)} • {method.ifsc_code}
                              </Text>
                            )}
                          </View>
                          {selectedMethodId === method.id && (
                            <Ionicons name="checkmark-circle" size={18} color={COLORS.brandPrimary} />
                          )}
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  {/* Submit */}
                  <Button
                    label={isTransacting ? "Processing..." : `Withdraw ${formatINR(amount)}`}
                    variant="gold"
                    onPress={handleSubmit}
                    isLoading={isTransacting}
                    disabled={
                      amount < BigInt(MIN_WITHDRAWAL_PAISE) ||
                      amount > availablePaise ||
                      !selectedMethodId ||
                      isTransacting ||
                      paymentMethods.length === 0
                    }
                    icon={
                      !isTransacting ? (
                        <Ionicons name="arrow-up-outline" size={18} color="#fff" />
                      ) : undefined
                    }
                  />
                </View>
              </Card>
            )}

            {/* Active Withdrawals */}
            {activeWithdrawals.length > 0 && (
              <View className="mb-4">
                <Text className="text-slate-900 text-base font-bold mb-3">Active Withdrawals</Text>
                {activeWithdrawals.map((w: Withdrawal) => (
                  <View key={w.id}>{renderWithdrawal({ item: w })}</View>
                ))}
              </View>
            )}

            {/* Past Withdrawals */}
            {pastWithdrawals.length > 0 && (
              <View className="mb-4">
                <Text className="text-slate-900 text-base font-bold mb-3">Withdrawal History</Text>
                {pastWithdrawals.map((w: Withdrawal) => (
                  <View key={w.id}>{renderWithdrawal({ item: w })}</View>
                ))}
              </View>
            )}

            {/* Empty State */}
            {withdrawals.length === 0 && !refreshing && (
              <EmptyState
                icon={<Ionicons name="arrow-up-outline" size={36} color={COLORS.brandPrimary} />}
                title="No withdrawals yet"
                description="Your withdrawal history will appear here."
              />
            )}
          </View>
        }
      />
      <AlertComponent />
    </View>
  );
}
