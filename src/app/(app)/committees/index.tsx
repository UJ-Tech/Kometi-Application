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
          backgroundColor: "rgba(13,148,136,0.06)",
          alignItems: "center", justifyContent: "center",
          marginBottom: 24,
        }}>
          <Ionicons name="wallet-outline" size={48} color={COLORS.brandPrimary} />
        </View>

        {/* Title */}
        <Text style={{
          fontSize: 22, fontWeight: "800", color: COLORS.text.primary,
          textAlign: "center", marginBottom: 8,
        }}>
          {canOpenCommitteeCreation ? "No Chits Yet" : "No Chits Found"}
        </Text>

        {/* Description */}
        <Text style={{
          fontSize: 14, color: COLORS.text.secondary,
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
            color: COLORS.text.inverse, fontSize: 16, fontWeight: "700", marginLeft: 8,
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
              Or Join Someone Else{"'"}s Chit
            </Text>
          </TouchableOpacity>
        )}

        {/* Feature highlights */}
        <View style={{
          backgroundColor: "rgba(13,148,136,0.04)",
          borderRadius: 16, padding: 20, borderWidth: 1, borderColor: "rgba(13,148,136,0.08)",
        }}>
          <Text style={{ color: COLORS.text.secondary, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, marginBottom: 16 }}>
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
                backgroundColor: "rgba(13,148,136,0.08)",
                alignItems: "center", justifyContent: "center", marginRight: 12,
              }}>
                <Ionicons name={step.icon} size={18} color={COLORS.brandPrimary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: COLORS.text.primary, fontSize: 13, fontWeight: "600", marginBottom: 2 }}>{step.title}</Text>
                <Text style={{ color: COLORS.text.secondary, fontSize: 12, lineHeight: 18 }}>{step.desc}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  };

  return (
    <View className="flex-1 bg-surface-bg px-4">
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
          ) : (
            <TouchableOpacity
              onPress={() => router.push("/(auth)/join-committee" as any)}
              className="w-10 h-10 bg-gold-500/10 border border-gold-500/20 rounded-full items-center justify-center"
            >
              <Ionicons name="enter-outline" size={22} color={COLORS.goldPrimary} />
            </TouchableOpacity>
          )
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
        ListHeaderComponent={
          committees.length > 0 && !canOpenCommitteeCreation ? (
            <TouchableOpacity
              onPress={() => router.push("/(auth)/join-committee" as any)}
              activeOpacity={0.8}
              style={{
                marginBottom: 16, borderRadius: 14, overflow: "hidden",
                borderWidth: 1.5, borderColor: "rgba(245,158,11,0.25)",
                backgroundColor: "rgba(245,158,11,0.06)",
              }}
            >
              <View style={{
                flexDirection: "row", alignItems: "center",
                paddingHorizontal: 16, paddingVertical: 14,
              }}>
                <View style={{
                  width: 40, height: 40, borderRadius: 12,
                  backgroundColor: "rgba(245,158,11,0.15)",
                  alignItems: "center", justifyContent: "center", marginRight: 12,
                }}>
                  <Ionicons name="enter-outline" size={20} color={COLORS.goldPrimary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: "#fbbf24", fontSize: 14, fontWeight: "700" }}>
                    Join Another Committee
                  </Text>
                  <Text style={{ color: "#a3a3a3", fontSize: 11, marginTop: 2 }}>
                    Enter an invite code to join a new chit fund
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="rgba(245,158,11,0.4)" />
              </View>
            </TouchableOpacity>
          ) : null
        }
        ListEmptyComponent={renderEmptyState()}
        renderItem={({ item }) => {
          const totalPot = BigInt(item.installmentAmountPaise) * BigInt(item.totalSlots);
          return (
            <TouchableOpacity onPress={() => router.push(`/committees/${item.id}`)} activeOpacity={0.85}>
              <Card style={{ marginBottom: 16 }}>
                <View className="p-5">
                  <View className="flex-row justify-between items-center mb-3">
                    <Text className="text-slate-900 font-bold text-base">{item.name}</Text>
                    <Badge label={item.status} variant={committeeVariant(item.status)} />
                  </View>

                  <View className="flex-row justify-between mb-4 border-b border-brand-primary/5 pb-3">
                    <View>
                      <Text className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                        Total Pot
                      </Text>
                      <Text className="text-gold-500 font-bold text-base mt-0.5">
                        {formatINR(totalPot)}
                      </Text>
                    </View>

                    <View className="items-end">
                      <Text className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                        Installment / slot
                      </Text>
                      <Text className="text-slate-800 font-bold text-base mt-0.5">
                        {formatINR(item.installmentAmountPaise)}
                      </Text>
                    </View>
                  </View>

                  <View className="flex-row justify-between items-center">
                    <View className="flex-row items-center">
                      <Ionicons name="people-outline" size={16} color="#a3a3a3" />
                      <Text className="text-slate-400 text-xs font-semibold ml-1.5">
                        {item.filledSlots} / {item.totalSlots} Slots
                      </Text>
                    </View>

                    <View className="flex-row items-center">
                      <Ionicons name="sync-outline" size={14} color="#a3a3a3" />
                      <Text className="text-slate-600 text-xs font-semibold ml-1.5">
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
