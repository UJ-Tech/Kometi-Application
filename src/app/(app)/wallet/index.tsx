// src/app/(app)/wallet/index.tsx
// Kometi Wallet Management, balance ledger and transactions ledger.

import React, { useState, useEffect } from "react";
import { View, Text, FlatList, TouchableOpacity, RefreshControl, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useWalletStore } from "../../../stores/wallet.store";
import { formatINR } from "../../../utils/currency";
import { COLORS } from "../../../constants/theme";
import Card from "../../../components/ui/Card";
import Button from "../../../components/ui/Button";
import EmptyState from "../../../components/ui/EmptyState";
import ScreenHeader from "../../../components/shared/ScreenHeader";
import { AmountInput } from "../../../components/ui/AmountInput";

export default function Wallet() {
  const { balancePaise, transactions, isLoading, fetchWalletData, topupWallet } = useWalletStore();
  const [refreshing, setRefreshing] = useState(false);
  const [topupAmount, setTopupAmount] = useState<bigint>(0n);
  const [showTopupInput, setShowTopupInput] = useState(false);
  const [topupLoading, setTopupLoading] = useState(false);

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

    try {
      setTopupLoading(true);
      await topupWallet(topupAmount);
      Alert.alert("Success", `Added ${formatINR(topupAmount)} to your wallet successfully.`);
      setTopupAmount(0n);
      setShowTopupInput(false);
      loadData();
    } catch (err: any) {
      Alert.alert("Top-up Failed", err.message || "An error occurred during payment.");
    } finally {
      setTopupLoading(false);
    }
  };

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
                    <Button
                      label="Proceed to Pay"
                      onPress={handleTopup}
                      variant="gold"
                      isLoading={topupLoading}
                      disabled={topupAmount <= 0n || topupLoading}
                    />
                  </View>
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
