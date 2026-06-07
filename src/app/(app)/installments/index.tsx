// src/app/(app)/installments/index.tsx
// Kometi Chit Installments Dues & Collection Dashboard.

import React, { useState, useEffect } from "react";
import { View, Text, FlatList, TouchableOpacity, RefreshControl, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useInstallmentStore } from "../../../stores/installment.store";
import { useWalletStore } from "../../../stores/wallet.store";
import { formatINR } from "../../../utils/currency";
import { COLORS } from "../../../constants/theme";
import Card from "../../../components/ui/Card";
import Badge, { installmentVariant } from "../../../components/ui/Badge";
import Button from "../../../components/ui/Button";
import EmptyState from "../../../components/ui/EmptyState";
import ScreenHeader from "../../../components/shared/ScreenHeader";

export default function Installments() {
  const { upcomingDues, isLoading, fetchUpcomingDues, payInstallment } = useInstallmentStore();
  const { balancePaise, fetchWalletData } = useWalletStore();
  const [refreshing, setRefreshing] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);

  const loadData = async () => {
    setRefreshing(true);
    await Promise.all([fetchUpcomingDues(), fetchWalletData()]);
    setRefreshing(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handlePay = async (id: string, amountPaise: bigint) => {
    if (balancePaise < amountPaise) {
      Alert.alert(
        "Insufficient Balance",
        `Your wallet balance (${formatINR(balancePaise)}) is less than the due amount (${formatINR(amountPaise)}). Please top up your wallet first.`
      );
      return;
    }

    Alert.alert(
      "Confirm Payment",
      `Are you sure you want to pay ${formatINR(amountPaise)} for this installment?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Pay Now",
          style: "default",
          onPress: async () => {
            try {
              setPayingId(id);
              await payInstallment(id, "WALLET");
              Alert.alert("Success", "Installment payment completed successfully.");
              loadData();
            } catch (err: any) {
              Alert.alert("Payment Failed", err.message || "An error occurred.");
            } finally {
              setPayingId(null);
            }
          },
        },
      ]
    );
  };

  return (
    <View className="flex-1 bg-surface-950 px-4">
      <ScreenHeader
        title="Dues"
        subtitle="Track and pay your upcoming chit installments"
        transparent
      />

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
        ListEmptyComponent={
          !isLoading ? (
            <EmptyState
              icon="calendar-outline"
              title="All caught up!"
              description="No pending installment dues found for your account."
            />
          ) : null
        }
        renderItem={({ item }) => {
          const totalAmount = BigInt(item.amountDuePaise) + BigInt(item.penaltyPaise);
          const isPaying = payingId === item.id;

          return (
            <Card style={{ marginBottom: 16 }}>
              <View className="p-5">
                <View className="flex-row justify-between items-start mb-3">
                  <View className="flex-1 pr-4">
                    <Text className="text-white font-bold text-base">Cycle #{item.cycleNo}</Text>
                    <Text className="text-neutral-500 text-xs mt-0.5">
                      Due: {new Date(item.dueDate).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </Text>
                  </View>
                  <Badge label={item.status} variant={installmentVariant(item.status)} />
                </View>

                <View className="flex-row justify-between items-center mt-2 border-t border-brand-primary/5 pt-4">
                  <View>
                    <Text className="text-neutral-500 text-[10px] uppercase font-bold tracking-wider">
                      Total Payable
                    </Text>
                    <Text className="text-white font-bold text-lg mt-0.5">
                      {formatINR(totalAmount)}
                    </Text>
                    {item.penaltyPaise > 0 && (
                      <Text className="text-danger-400 text-[10px] font-semibold mt-0.5">
                        Includes penalty of {formatINR(item.penaltyPaise)}
                      </Text>
                    )}
                  </View>

                  <View className="w-28">
                    <Button
                      label="Pay"
                      onPress={() => handlePay(item.id, totalAmount)}
                      variant="primary"
                      isLoading={isPaying}
                      disabled={item.status === "PAID" || isPaying}
                    />
                  </View>
                </View>
              </View>
            </Card>
          );
        }}
      />
    </View>
  );
}
