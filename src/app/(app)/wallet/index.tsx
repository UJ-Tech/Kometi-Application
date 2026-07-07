import React, { useState, useEffect } from "react";
import { View, Text, FlatList, TouchableOpacity, RefreshControl } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useWalletStore } from "../../../stores/wallet.store";
import { useFlatListScrollToTop } from "../../../hooks/useScrollToTop";
import { useAuthStore } from "../../../stores/auth.store";
import { formatINR } from "../../../utils/currency";
import { COLORS, BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from "../../../constants/theme";
import Card from "../../../components/ui/Card";
import Badge from "../../../components/ui/Badge";
import Button from "../../../components/ui/Button";
import EmptyState from "../../../components/ui/EmptyState";
import ScreenHeader from "../../../components/shared/ScreenHeader";
import { AmountInput } from "../../../components/ui/AmountInput";
import GradientHero from "../../../components/brand/GradientHero";
import KKMark, { KKDot } from "../../../components/brand/KKMark";
import { openRazorpayCheckout } from "../../../utils/razorpay";
import type { Withdrawal } from "../../../types";
import { useAlertModal } from "../../../components/ui/AlertModal";

export default function Wallet() {
  const router = useRouter();
  const { balancePaise, transactions, withdrawals, isLoading, fetchWalletData, fetchWithdrawals, topupWallet, verifyTopupPayment } = useWalletStore();
  const listRef = useFlatListScrollToTop();
  const currentUser = useAuthStore((s: any) => s.user);
  const [refreshing, setRefreshing] = useState(false);
  const [topupAmount, setTopupAmount] = useState<bigint>(0n);
  const [showTopupInput, setShowTopupInput] = useState(false);
  const [topupLoading, setTopupLoading] = useState(false);
  const { alert, confirm, AlertComponent } = useAlertModal();

  const loadData = async () => {
    setRefreshing(true);
    await Promise.all([fetchWalletData(), fetchWithdrawals()]);
    setRefreshing(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const walletUpdatedVersion = useWalletStore((s) => s.walletUpdatedVersion);
  useEffect(() => {
    if (walletUpdatedVersion > 0) {
      fetchWithdrawals();
    }
  }, [walletUpdatedVersion]);

  const handleTopup = async () => {
    if (topupAmount <= 0n) {
      await alert("Invalid Amount", "Please enter a valid amount to add to your wallet.");
      return;
    }

    const amountPaise = Number(topupAmount);
    if (amountPaise < 100) {
      await alert("Minimum Amount", "Minimum top-up amount is ₹1.");
      return;
    }

    try {
      setTopupLoading(true);
      const orderData = await topupWallet(amountPaise);

      await openRazorpayCheckout({
        key: orderData.razorpayKeyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "Monio",
        description: `Add ${formatINR(topupAmount)} to Wallet`,
        order_id: orderData.orderId,
        prefill: {
          name: currentUser?.name || "",
          email: currentUser?.email || "",
          contact: currentUser?.phone || "",
        },
        theme: { color: "#4f46e5" },
        handler: async (response) => {
          try {
            await verifyTopupPayment(
              response.razorpay_order_id,
              response.razorpay_payment_id,
              response.razorpay_signature
            );
            await alert("Success", `Added ${formatINR(topupAmount)} to your wallet successfully.`);
            setTopupAmount(0n);
            setShowTopupInput(false);
            loadData();
          } catch (verifyErr: any) {
            await alert("Payment Received", "Your payment was successful but verification failed. Please contact support if the issue persists.");
          }
        },
        modal: {
          ondismiss: () => {
            alert("Payment Cancelled", "You cancelled the payment. No amount was charged.");
            setTopupLoading(false);
          },
        },
      });
    } catch (err: any) {
      await alert("Top-up Failed", err.message || "An error occurred during payment.");
    } finally {
      setTopupLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.surface.bg, paddingHorizontal: SPACING[5] }}>
      <ScreenHeader title="Wallet" subtitle="Manage your chit payments and balance" transparent />

      <FlatList
        ref={listRef}
        data={transactions}
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
          <View className="mb-6">
            {/* Balance Hero */}
            <GradientHero style={{ marginBottom: 20 }} curved>
              <View className="mb-4">
                <View className="flex-row items-center gap-2 mb-2">
                  <KKDot size={6} color={COLORS.gold[400]} />
                  <Text className="text-white/60 text-xs font-semibold uppercase tracking-wider">
                    Available Balance
                  </Text>
                </View>
                <Text className="text-white text-4xl font-bold" style={{ letterSpacing: -1 }}>
                  {formatINR(balancePaise)}
                </Text>
              </View>

              <View className="flex-row gap-3">
                <TouchableOpacity
                  onPress={() => setShowTopupInput(!showTopupInput)}
                  className="flex-1 h-12 rounded-xl items-center justify-center flex-row"
                  style={{ backgroundColor: "rgba(245,158,11,0.2)" }}
                >
                  <Ionicons name={showTopupInput ? "close" : "add"} size={20} color={COLORS.gold[300]} />
                  <Text className="text-gold-300 font-bold ml-1.5 text-sm">
                    {showTopupInput ? "Cancel" : "Add Funds"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => router.push("/wallet/withdraw" as any)}
                  className="flex-1 h-12 rounded-xl items-center justify-center flex-row"
                  style={{ backgroundColor: "rgba(255,255,255,0.1)" }}
                >
                  <Ionicons name="arrow-up-outline" size={20} color={COLORS.white} />
                  <Text className="text-white font-bold ml-1.5 text-sm">Withdraw</Text>
                </TouchableOpacity>
              </View>
            </GradientHero>

            {/* Pending Withdrawals */}
            {withdrawals.filter((w: Withdrawal) => w.status === "requested" || w.status === "processing").length > 0 && (
              <Card style={{ marginBottom: 16, borderColor: "rgba(59,130,246,0.3)" }} accent="info" padding={16}>
                <View className="flex-row items-center">
                  <View className="w-8 h-8 rounded-full items-center justify-center bg-blue-500/10">
                    <Ionicons name="sync-outline" size={16} color="#3b82f6" />
                  </View>
                  <View className="ml-3 flex-1">
                    <Text className="text-blue-700 font-bold text-sm">
                      {withdrawals.filter((w: Withdrawal) => w.status === "requested" || w.status === "processing").length} pending withdrawal(s)
                    </Text>
                    <Text className="text-slate-500 text-xs mt-0.5">
                      {formatINR(
                        withdrawals
                          .filter((w: Withdrawal) => w.status === "requested" || w.status === "processing")
                          .reduce((sum: number, w: Withdrawal) => sum + w.amount, 0)
                      )}{" "}
                      being processed
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => router.push("/wallet/withdraw" as any)}>
                    <Ionicons name="chevron-forward" size={18} color="#3b82f6" />
                  </TouchableOpacity>
                </View>
              </Card>
            )}

            {/* Top-up Input */}
            {showTopupInput && (
              <Card style={{ marginBottom: 24 }} padding={20}>
                <Text className="text-slate-800 font-bold text-sm mb-3">Add Funds to Wallet</Text>
                <AmountInput
                  label="Enter Amount"
                  valuePaise={topupAmount}
                  onChangePaise={setTopupAmount}
                  placeholder="e.g. 5,000.00"
                />
                <View className="flex-row gap-3 mt-2">
                  {[1000_00, 5000_00, 10000_00].map((amt) => (
                    <TouchableOpacity
                      key={amt}
                      onPress={() => setTopupAmount(BigInt(amt))}
                      className="py-1.5 px-3 rounded-lg"
                      style={{ backgroundColor: "rgba(99,102,241,0.1)", borderWidth: 1, borderColor: "rgba(99,102,241,0.2)" }}
                    >
                      <Text className="text-brand-500 text-xs font-bold">+{formatINR(amt)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View className="mt-5">
                  <Button
                    label={topupLoading ? "Processing..." : `Pay ${formatINR(topupAmount)}`}
                    variant="gold"
                    onPress={handleTopup}
                    isLoading={topupLoading}
                    disabled={topupAmount <= 0n || topupLoading}
                  />
                </View>
              </Card>
            )}

            <View className="flex-row items-center gap-2 mb-4">
              <View className="w-1 h-5 rounded-full" style={{ backgroundColor: COLORS.brand[500] }} />
              <Text className="text-slate-800 text-base font-bold">Transaction History</Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          !isLoading ? (
            <EmptyState
              icon="swap-vertical-outline"
              title="No transactions yet"
              description="Your deposit and chit payment history will appear here."
            />
          ) : null
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={0.7}
            className="flex-row items-center justify-between bg-white rounded-2xl p-4 mb-3"
            style={{
              borderWidth: 1,
              borderColor: COLORS.surface.border,
              ...SHADOWS.cardSm,
            }}
          >
            <View className="flex-row items-center flex-1 pr-4">
              <View
                className="w-10 h-10 rounded-xl items-center justify-center"
                style={{
                  backgroundColor: item.type === "CREDIT" ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                }}
              >
                <Ionicons
                  name={item.type === "CREDIT" ? "arrow-down" : "arrow-up"}
                  size={18}
                  color={item.type === "CREDIT" ? COLORS.success.DEFAULT : COLORS.danger.DEFAULT}
                />
              </View>
              <View className="ml-3 flex-1">
                <Text className="text-slate-800 font-bold text-sm" numberOfLines={1}>
                  {item.description}
                </Text>
                <Text className="text-slate-400 text-xs mt-0.5">
                  {new Date(item.createdAt).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}{" "}
                  at{" "}
                  {new Date(item.createdAt).toLocaleTimeString("en-IN", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              </View>
            </View>

            <View className="items-end">
              <Text
                className="font-bold text-base"
                style={{
                  color: item.type === "CREDIT" ? COLORS.success.dark : COLORS.text.primary,
                }}
              >
                {item.type === "CREDIT" ? "+" : "-"}
                {formatINR(item.amountPaise)}
              </Text>
              <Badge label={item.status} variant={item.status === "COMPLETED" ? "success" : item.status === "FAILED" ? "danger" : "warning"} size="sm" />
            </View>
          </TouchableOpacity>
        )}
      />
      <AlertComponent />
    </View>
  );
}
