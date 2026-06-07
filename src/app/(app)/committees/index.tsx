// src/app/(app)/committees/index.tsx
// Kometi Chit Committees (Chits) Directory - list and quick stats.

import React, { useState, useEffect } from "react";
import { View, Text, FlatList, TouchableOpacity, RefreshControl } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCommitteeStore } from "../../../stores/committee.store";
import { formatINR } from "../../../utils/currency";
import { COLORS } from "../../../constants/theme";
import Card from "../../../components/ui/Card";
import Badge, { committeeVariant } from "../../../components/ui/Badge";
import EmptyState from "../../../components/ui/EmptyState";
import ScreenHeader from "../../../components/shared/ScreenHeader";

import { useAuthStore } from "../../../stores/auth.store";
import { canCreateCommittee } from "../../../utils/rbac";

export default function Committees() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { committees, isLoading, fetchCommittees } = useCommitteeStore();
  const [refreshing, setRefreshing] = useState(false);

  const canOpenCommitteeCreation = canCreateCommittee(user?.role);

  const loadData = async () => {
    setRefreshing(true);
    await fetchCommittees();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchCommittees();
  }, []);

  return (
    <View className="flex-1 bg-surface-950 px-4">
      <ScreenHeader
        title="Chits"
        subtitle="Your active and upcoming chit pools"
        rightElement={
          canOpenCommitteeCreation ? (
            <TouchableOpacity
              onPress={() => router.push("/committees/create")}
              className="w-10 h-10 bg-brand-500/10 border border-brand-500/20 rounded-full items-center justify-center"
            >
              <Ionicons name="add" size={24} color={COLORS.brandPrimary} />
            </TouchableOpacity>
          ) : undefined
        }
        transparent
      />

      <FlatList
        data={committees}
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
              icon="pie-chart-outline"
              title="No chits found"
              description="Start a new chit fund or join an existing one using an invite code."
              actionLabel={canOpenCommitteeCreation ? "Create Chit" : "Join Chit"}
              onAction={() => canOpenCommitteeCreation ? router.push("/committees/create") : router.push("/(auth)/join-committee" as any)}
            />
          ) : null
        }
        renderItem={({ item }) => {
          const totalPot = BigInt(item.installmentAmountPaise) * BigInt(item.totalSlots);
          return (
            <TouchableOpacity onPress={() => router.push(`/committees/${item.id}`)} activeOpacity={0.85}>
              <Card style={{ marginBottom: 16 }}>
                <View className="p-5">
                  <View className="flex-row justify-between items-center mb-3">
                    <Text className="text-white font-bold text-base">{item.name}</Text>
                    <Badge label={item.status} variant={committeeVariant(item.status)} />
                  </View>

                  <View className="flex-row justify-between mb-4 border-b border-brand-primary/5 pb-3">
                    <View>
                      <Text className="text-neutral-500 text-[10px] uppercase font-bold tracking-wider">
                        Total Pot
                      </Text>
                      <Text className="text-gold-500 font-bold text-base mt-0.5">
                        {formatINR(totalPot)}
                      </Text>
                    </View>

                    <View className="items-end">
                      <Text className="text-neutral-500 text-[10px] uppercase font-bold tracking-wider">
                        Installment / slot
                      </Text>
                      <Text className="text-white font-bold text-base mt-0.5">
                        {formatINR(item.installmentAmountPaise)}
                      </Text>
                    </View>
                  </View>

                  <View className="flex-row justify-between items-center">
                    <View className="flex-row items-center">
                      <Ionicons name="people-outline" size={16} color="#a3a3a3" />
                      <Text className="text-neutral-300 text-xs font-semibold ml-1.5">
                        {item.filledSlots} / {item.totalSlots} Slots
                      </Text>
                    </View>

                    <View className="flex-row items-center">
                      <Ionicons name="sync-outline" size={14} color="#a3a3a3" />
                      <Text className="text-neutral-300 text-xs font-semibold ml-1.5">
                        {item.cycleDurationDays} days cycle
                      </Text>
                    </View>
                  </View>
                </View>
              </Card>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}
