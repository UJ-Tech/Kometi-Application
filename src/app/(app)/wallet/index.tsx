// src/app/(app)/wallet/index.tsx
// Kometi Wallet Management, balance ledger and transactions ledger.

import React, { useState, useEffect } from "react";
import { View, Text, FlatList, TouchableOpacity, RefreshControl, Alert, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useWalletStore } from "../../../stores/wallet.store";
import { formatINR } from "../../../utils/currency";
import { COLORS } from "../../../constants/theme";
import Card from "../../../components/ui/Card";
import Button from "../../../components/ui/Button";
import EmptyState from "../../../components/ui/EmptyState";
import ScreenHeader from "../../../components/shared/ScreenHeader";
import { AmountInput } from "../../../components/ui/AmountInput";
import { openRazorpayCheckout, loadRazorpayScript } from "../../../utils/razorpay";
import { useAuthStore } from "../../../stores/auth.store";

export default function Wallet() {
  const { balancePaise, transactions, isLoading, fetchWalletData, topupWallet, verifyTopupPayment } = useWalletStore();
  const currentUser = useAuthStore((s: any) => s.user);
  const [refreshing, setRefreshing] = useState(false);
  const [topupAmount, setTopupAmount] = useState<bigint>(0n);
  const [showTopupInput, setShowTopupInput] = useState(false);
  const [topupLoading, setTopupLoading] = useState(false);
  const [scriptReady, setScriptReady] = useState<boolean | null>(null);

  // Pre-load Razorpay script on mount (web only)
  React.useEffect(() => {
    if (Platform.OS === "web") {
      loadRazorpayScript().then(setScriptReady);
    }
  }, []);

  const loadData = async () => {
    setRefreshing(true);
    await fetchWalletData();
    setRefreshing(false);
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTopup = async () => {
    if (topupAmount <= 0n) {
      Alert.alert("Invalid Amount", "Please enter a valid amount to add to your wallet.");
      return;
    }

    const amountPaise = Number(topupAmount);
    if (amountPaise < 100) {
      Alert.alert("Minimum Amount", "Minimum top-up amount is ₹1.");
      return;
    }

    try {
      setTopupLoading(true);

      // 1. Create Razorpay order from backend
      const orderData = await topupWallet(amountPaise);

      // 2. Open Razorpay Checkout on web
      if (Platform.OS === "web") {
        await openRazorpayCheckout({
          key: orderData.razorpayKeyId,
          amount: orderData.amount,
          currency: orderData.currency,
          name: "Kometi",
          description: `Add ${formatINR(topupAmount)} to Wallet`,
          order_id: orderData.orderId,
          prefill: {
            name: currentUser?.name || "",
            email: currentUser?.email || "",
            contact: currentUser?.phone || "",
          },
          theme: { color: "#6f5eff" },
          handler: async (response) => {
            // 3. Verify payment on backend
            try {
              await verifyTopupPayment(
                response.razorpay_order_id,
                response.razorpay_payment_id,
                response.razorpay_signature
              );
              Alert.alert("Success", `Added ${formatINR(topupAmount)} to your wallet successfully.`);
              setTopupAmount(0n);
              setShowTopupInput(false);
              loadData();
            } catch (verifyErr: any) {
              Alert.alert(
                "Payment Received",
                "Your payment was successful but verification failed. Please contact support if the issue persists."
              );
            }
          },
          modal: {
            ondismiss: () => {
              Alert.alert("Payment Cancelled", "You cancelled the payment. No amount was charged.");
              setTopupLoading(false);
            },
          },
        });
      } else {
        // Mobile fallback — show manual UPI instruction
        Alert.alert(
          "Web Only",
          "Wallet top-up via Razorpay is currently supported on web. Please use the web app to add funds."
        );
      }
    } catch (err: any) {
      Alert.alert("Top-up Failed", err.message || "An error occurred during payment.");
    } finally {
      setTopupLoading(false);
    }
  };

  const isMobile = Platform.OS !== "web";
  const isScriptLoading = Platform.OS === "web" && scriptReady === null;

  return (
    <View className="flex-1 bg-surface-950 px-4">
      <ScreenHeader
        title="Wallet"
        subtitle="Manage your chit payments balance and history"
        transparent
      />

      <FlatList
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
            <Card gradient style={{ marginBottom: 24 }}>
              <View className="p-6">
                <Text className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-1">
                  Available Balance
                </Text>
                <Text className="text-white text-3xl font-bold mb-4">
                  {formatINR(balancePaise)}
                </Text>

                <TouchableOpacity
                  onPress={() => setShowTopupInput(!showTopupInput)}
                  className="bg-white/10 hover:bg-white/20 h-12 rounded-xl items-center justify-center flex-row border border-white/5"
                >
                  <Ionicons name={showTopupInput ? "close" : "add"} size={20} color="#fff" />
                  <Text className="text-white font-bold ml-1.5 text-sm">
                    {showTopupInput ? "Cancel" : "Add Funds"}
                  </Text>
                </TouchableOpacity>
              </View>
            </Card>

            {showTopupInput && (
              <Card style={{ marginBottom: 24, borderColor: COLORS.surface.border }}>
                <View className="p-5">
                  <Text className="text-white font-bold text-sm mb-3">Add Funds to Wallet</Text>
                  <AmountInput
                    label="Enter Amount"
                    valuePaise={topupAmount}
                    onChangePaise={setTopupAmount}
                    placeholder="e.g. 5,000.00"
                  />
                  <View className="flex-row gap-3 mt-2">
                    <TouchableOpacity
                      onPress={() => setTopupAmount(1000_00n)}
                      className="bg-brand-500/10 border border-brand-500/20 py-1.5 px-3 rounded-lg"
                    >
                      <Text className="text-brand-500 text-xs font-bold">+₹1,000</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setTopupAmount(5000_00n)}
                      className="bg-brand-500/10 border border-brand-500/20 py-1.5 px-3 rounded-lg"
                    >
                      <Text className="text-brand-500 text-xs font-bold">+₹5,000</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setTopupAmount(10000_00n)}
                      className="bg-brand-500/10 border border-brand-500/20 py-1.5 px-3 rounded-lg"
                    >
                      <Text className="text-brand-500 text-xs font-bold">+₹10,000</Text>
                    </TouchableOpacity>
                  </View>
                  <View className="mt-5">
                    {isMobile ? (
                      <TouchableOpacity
                        disabled={topupLoading}
                        className="bg-surface-card border border-brand-primary/20 rounded-xl h-14 items-center justify-center flex-row"
                        onPress={() =>
                          Alert.alert(
                            "Use Web App",
                            "Wallet top-up is available on the web app. Please visit kometi.app to add funds."
                          )
                        }
                      >
                        <Ionicons name="phone-portrait-outline" size={18} color={COLORS.brandPrimary} />
                        <Text className="text-brand-400 font-bold text-sm ml-2">View on Web to Pay</Text>
                      </TouchableOpacity>
                    ) : (
                      <Button
                        label={topupLoading ? "Processing..." : `Pay ${formatINR(topupAmount)}`}
                        variant="gold"
                        onPress={handleTopup}
                        isLoading={topupLoading}
                        disabled={topupAmount <= 0n || topupLoading || scriptReady === false}
                      />
                    )}
                  </View>
                  {Platform.OS === "web" && scriptReady === false && (
                    <Text className="text-danger-400 text-[10px] text-center mt-2">
                      Failed to load payment gateway. Check your network.
                    </Text>
                  )}
                </View>
              </Card>
            )}

            <Text className="text-white text-base font-bold mb-3">Transaction History</Text>
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
          <View className="flex-row items-center justify-between bg-surface-card border border-brand-primary/5 rounded-xl p-4 mb-3">
            <View className="flex-row items-center flex-1 pr-4">
              <View
                className={`w-10 h-10 rounded-full items-center justify-center ${
                  item.type === "CREDIT" ? "bg-success-500/10" : "bg-danger-500/10"
                }`}
              >
                <Ionicons
                  name={item.type === "CREDIT" ? "arrow-down" : "arrow-up"}
                  size={18}
                  color={item.type === "CREDIT" ? COLORS.success.DEFAULT : COLORS.danger.DEFAULT}
                />
              </View>
              <View className="ml-3 flex-1">
                <Text className="text-white font-bold text-sm" numberOfLines={1}>
                  {item.description}
                </Text>
                <Text className="text-neutral-500 text-xs mt-0.5">
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
                className={`font-bold text-base ${
                  item.type === "CREDIT" ? "text-success-500" : "text-neutral-200"
                }`}
              >
                {item.type === "CREDIT" ? "+" : "-"}
                {formatINR(item.amountPaise)}
              </Text>
              <Text className="text-[10px] text-neutral-500 mt-1 uppercase font-bold tracking-wider">
                {item.status}
              </Text>
            </View>
          </View>
        )}
      />
    </View>
  );
}
