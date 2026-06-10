// src/app/(app)/committees/index.tsx
// Kometi Chit Committees (Chits) Directory - list and quick stats.

import React, { useState, useEffect } from "react";
import { View, Text, FlatList, TouchableOpacity, RefreshControl } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useCommitteeStore } from "../../../stores/committee.store";
import { formatINR } from "../../../utils/currency";
import { COLORS } from "../../../constants/theme";
import Card from "../../../components/ui/Card";
import Badge, { committeeVariant } from "../../../components/ui/Badge";
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

  const renderEmptyState = () => {
    if (isLoading) return null;

    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24, paddingTop: 40 }}>
        {/* Illustration */}
        <View style={{
          width: 120, height: 120, borderRadius: 60,
          backgroundColor: "rgba(111,94,255,0.08)",
          alignItems: "center", justifyContent: "center",
          marginBottom: 24,
        }}>
          <LinearGradient
            colors={["rgba(111,94,255,0.15)", "rgba(245,158,11,0.10)"]}
            style={{ width: 120, height: 120, borderRadius: 60, alignItems: "center", justifyContent: "center" }}
          >
            <Ionicons name="wallet-outline" size={48} color={COLORS.brandPrimary} />
          </LinearGradient>
        </View>

        {/* Title */}
        <Text style={{
          fontSize: 22, fontWeight: "800", color: "#fff",
          textAlign: "center", marginBottom: 8,
        }}>
          {canOpenCommitteeCreation ? "No Chits Yet" : "No Chits Found"}
        </Text>

        {/* Description */}
        <Text style={{
          fontSize: 14, color: "#a3a3a3",
          textAlign: "center", lineHeight: 22, marginBottom: 32, paddingHorizontal: 8,
        }}>
          {canOpenCommitteeCreation
            ? "You haven't created any chit committees yet. Create your first chit to start saving with friends, family, or colleagues."
            : "You haven't joined any chit committees yet. Ask a friend for an invite code to join their chit fund."
          }
        </Text>

        {/* Primary CTA */}
        <TouchableOpacity
          onPress={() => canOpenCommitteeCreation
            ? router.push("/committees/create")
            : router.push("/(auth)/join-committee" as any)
          }
          activeOpacity={0.8}
          style={{
            width: "100%", height: 56, borderRadius: 16,
            backgroundColor: COLORS.brandPrimary,
            alignItems: "center", justifyContent: "center",
            flexDirection: "row", marginBottom: 12,
          }}
        >
          <Ionicons
            name={canOpenCommitteeCreation ? "add-circle-outline" : "enter-outline"}
            size={20} color="#fff"
          />
          <Text style={{
            color: "#fff", fontSize: 16, fontWeight: "700", marginLeft: 8,
          }}>
            {canOpenCommitteeCreation ? "Create Your First Chit" : "Join a Chit"}
          </Text>
        </TouchableOpacity>

        {/* Secondary CTA for organizers */}
        {canOpenCommitteeCreation && (
          <TouchableOpacity
            onPress={() => router.push("/(auth)/join-committee" as any)}
            activeOpacity={0.7}
            style={{
              width: "100%", height: 48, borderRadius: 12,
              backgroundColor: "rgba(245,158,11,0.10)",
              borderWidth: 1, borderColor: "rgba(245,158,11,0.20)",
              alignItems: "center", justifyContent: "center",
              flexDirection: "row", marginBottom: 24,
            }}
          >
            <Ionicons name="people-outline" size={18} color={COLORS.goldPrimary} />
            <Text style={{
              color: COLORS.goldPrimary, fontSize: 14, fontWeight: "600", marginLeft: 8,
            }}>
              Or Join Someone Else's Chit
            </Text>
          </TouchableOpacity>
        )}

        {/* Feature highlights */}
        <View style={{
          width: "100%", backgroundColor: "rgba(255,255,255,0.03)",
          borderRadius: 16, padding: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.05)",
        }}>
          <Text style={{ color: "#71717a", fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, marginBottom: 16 }}>
            How it works
          </Text>

          {[
            {
              icon: "create-outline" as const,
              title: canOpenCommitteeCreation ? "Create a Chit" : "Get an Invite",
              desc: canOpenCommitteeCreation
                ? "Set the installment amount, slots, and cycle duration"
                : "Ask your chit organizer for the 8-digit invite code",
            },
            {
              icon: "people-outline" as const,
              title: "Add Members",
              desc: canOpenCommitteeCreation
                ? "Share the invite code or approve join requests"
                : "Enter the code to request membership",
            },
            {
              icon: "wallet-outline" as const,
              title: "Save & Win",
              desc: "Pay installments each cycle and receive payouts",
            },
          ].map((step, idx) => (
            <View key={idx} style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: idx < 2 ? 16 : 0 }}>
              <View style={{
                width: 36, height: 36, borderRadius: 10,
                backgroundColor: "rgba(111,94,255,0.10)",
                alignItems: "center", justifyContent: "center", marginRight: 12,
              }}>
                <Ionicons name={step.icon} size={18} color={COLORS.brandPrimary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: "#e4e4e7", fontSize: 13, fontWeight: "600", marginBottom: 2 }}>{step.title}</Text>
                <Text style={{ color: "#71717a", fontSize: 12, lineHeight: 18 }}>{step.desc}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  };

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
        contentContainerStyle={{ paddingBottom: 100, flexGrow: 1 }}
        ListEmptyComponent={renderEmptyState()}
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
