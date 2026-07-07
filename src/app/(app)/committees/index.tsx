import React, { useState, useEffect } from "react";
import { View, Text, FlatList, TouchableOpacity, RefreshControl } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useFlatListScrollToTop } from "../../../hooks/useScrollToTop";
import { useCommitteeStore } from "../../../stores/committee.store";
import { formatINR } from "../../../utils/currency";
import { COLORS, BORDER_RADIUS, SPACING, SHADOWS } from "../../../constants/theme";
import Card from "../../../components/ui/Card";
import Badge, { committeeVariant } from "../../../components/ui/Badge";
import ScreenHeader from "../../../components/shared/ScreenHeader";
import KKMark from "../../../components/brand/KKMark";

export default function Committees() {
  const router = useRouter();
  const { committees, isLoading, fetchCommittees } = useCommitteeStore();
  const [refreshing, setRefreshing] = useState(false);
  const listRef = useFlatListScrollToTop();

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
      <View style={{ flex: 1, paddingTop: 40 }}>
        <View style={{ alignItems: "center" }}>
          <View style={{
            width: 104, height: 104, borderRadius: 52,
            backgroundColor: "rgba(99,102,241,0.06)",
            alignItems: "center", justifyContent: "center", marginBottom: 28,
          }}>
            <KKMark size={56} color={COLORS.brand[200]} opacity={0.5} />
          </View>
          <Text style={{ fontSize: 24, fontWeight: "800", color: COLORS.text.primary, marginBottom: 8 }}>
            No Chits Yet
          </Text>
          <Text style={{ fontSize: 14, color: COLORS.text.secondary, textAlign: "center", lineHeight: 22, marginBottom: 32, paddingHorizontal: 16 }}>
            Create your own chit fund or join an existing one using an invite code.
          </Text>

          <TouchableOpacity
            onPress={() => router.push("/committees/create")}
            activeOpacity={0.85}
            style={{
              width: "100%", height: 56, borderRadius: BORDER_RADIUS["2xl"],
              marginBottom: 12, overflow: "hidden",
            }}
          >
            <LinearGradient
              colors={["#6366f1", "#4f46e5"]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center" }}
            >
              <Ionicons name="add-circle-outline" size={22} color="#fff" />
              <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700", marginLeft: 8 }}>Create a Chit</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push("/(auth)/join-committee" as any)}
            activeOpacity={0.7}
            style={{
              width: "100%", height: 50, borderRadius: BORDER_RADIUS.lg,
              backgroundColor: "rgba(245,158,11,0.1)", borderWidth: 1, borderColor: "rgba(245,158,11,0.2)",
              flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 32,
            }}
          >
            <Ionicons name="people-outline" size={18} color={COLORS.gold[500]} />
            <Text style={{ color: COLORS.gold[600], fontSize: 15, fontWeight: "700", marginLeft: 8 }}>Join with Invite Code</Text>
          </TouchableOpacity>
        </View>

        <View style={{
          backgroundColor: "rgba(99,102,241,0.04)", borderRadius: BORDER_RADIUS["2xl"],
          padding: 24, borderWidth: 1, borderColor: "rgba(99,102,241,0.08)",
        }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 20 }}>
            <View style={{ width: 4, height: 16, borderRadius: 2, backgroundColor: COLORS.brand[400] }} />
            <Text style={{ color: COLORS.text.primary, fontSize: 13, fontWeight: "700" }}>How it works</Text>
          </View>

          {[
            { icon: "create-outline" as const, title: "Create or Join", desc: "Create your own chit or enter an invite code to join one", color: COLORS.brand[500] },
            { icon: "people-outline" as const, title: "Add Members", desc: "Share the invite code or approve join requests", color: COLORS.gold[500] },
            { icon: "wallet-outline" as const, title: "Save & Win", desc: "Pay installments each cycle and receive payouts", color: COLORS.success.DEFAULT },
          ].map((step, idx) => (
            <View key={idx} style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: idx < 2 ? 20 : 0 }}>
              <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: "rgba(99,102,241,0.08)", alignItems: "center", justifyContent: "center", marginRight: 14 }}>
                <Ionicons name={step.icon} size={18} color={step.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: COLORS.text.primary, fontSize: 14, fontWeight: "600", marginBottom: 2 }}>{step.title}</Text>
                <Text style={{ color: COLORS.text.secondary, fontSize: 12, lineHeight: 18 }}>{step.desc}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.surface.bg, paddingHorizontal: SPACING[5] }}>
      <ScreenHeader
        title="Chits"
        subtitle="Your active and upcoming chit pools"
        rightElement={
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity
              onPress={() => router.push("/committees/create")}
              style={{
                width: 40, height: 40, borderRadius: 14,
                backgroundColor: "rgba(99,102,241,0.1)", borderWidth: 1, borderColor: "rgba(99,102,241,0.2)",
                alignItems: "center", justifyContent: "center",
              }}
            >
              <Ionicons name="add" size={24} color={COLORS.brand[500]} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push("/(auth)/join-committee" as any)}
              style={{
                width: 40, height: 40, borderRadius: 14,
                backgroundColor: "rgba(245,158,11,0.1)", borderWidth: 1, borderColor: "rgba(245,158,11,0.2)",
                alignItems: "center", justifyContent: "center",
              }}
            >
              <Ionicons name="enter-outline" size={22} color={COLORS.gold[500]} />
            </TouchableOpacity>
          </View>
        }
        transparent
      />

      <FlatList
        ref={listRef}
        data={committees}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={COLORS.brandPrimary} />
        }
        contentContainerStyle={{ paddingBottom: 100, flexGrow: 1 }}
        ListHeaderComponent={
          committees.length > 0 ? (
            <TouchableOpacity
              onPress={() => router.push("/(auth)/join-committee" as any)}
              activeOpacity={0.8}
              style={{
                marginBottom: 16, borderRadius: BORDER_RADIUS["2xl"],
                backgroundColor: "rgba(245,158,11,0.07)",
                borderWidth: 1, borderColor: "rgba(245,158,11,0.2)",
                flexDirection: "row", alignItems: "center",
                paddingHorizontal: 16, paddingVertical: 14,
              }}
            >
              <View style={{
                width: 42, height: 42, borderRadius: 14,
                backgroundColor: "rgba(245,158,11,0.15)",
                alignItems: "center", justifyContent: "center", marginRight: 14,
              }}>
                <Ionicons name="enter-outline" size={22} color={COLORS.gold[500]} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: COLORS.gold[600], fontSize: 14, fontWeight: "700" }}>Join Another Committee</Text>
                <Text style={{ color: COLORS.text.muted, fontSize: 11, marginTop: 2 }}>Enter an invite code to join a new chit fund</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.gold[300]} />
            </TouchableOpacity>
          ) : null
        }
        ListEmptyComponent={renderEmptyState()}
        renderItem={({ item }) => {
          const totalPot = BigInt(item.installmentAmountPaise) * BigInt(item.totalSlots);
          const progress = item.filledSlots / item.totalSlots;
          const isActive = item.status === "ACTIVE";
          const isDraft = item.status === "DRAFT";

          return (
            <TouchableOpacity onPress={() => router.push(`/committees/${item.id}`)} activeOpacity={0.85}>
              <Card
                style={{ marginBottom: 16 }}
                padding={0}
                accent={isActive ? "gold" : isDraft ? "brand" : "neutral"}
              >
                <View style={{ padding: 20 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                    <View style={{ flex: 1, marginRight: 12 }}>
                      <Text style={{ color: COLORS.text.primary, fontSize: 17, fontWeight: "700" }}>{item.name}</Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
                        <Ionicons name="time-outline" size={13} color={COLORS.text.muted} />
                        <Text style={{ color: COLORS.text.muted, fontSize: 12 }}>{item.cycleDurationDays} days cycle</Text>
                      </View>
                    </View>
                    <Badge label={item.status} variant={committeeVariant(item.status)} size="sm" dot />
                  </View>

                  <View style={{ flexDirection: "row", gap: 16, marginBottom: 16 }}>
                    <View style={{
                      flex: 1, backgroundColor: "rgba(245,158,11,0.07)",
                      borderRadius: BORDER_RADIUS.xl, padding: 12,
                    }}>
                      <Text style={{ color: COLORS.text.muted, fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Total Pot</Text>
                      <Text style={{ color: COLORS.gold[600], fontWeight: "700", fontSize: 16 }}>{formatINR(totalPot)}</Text>
                    </View>
                    <View style={{
                      flex: 1, backgroundColor: COLORS.surface.warm,
                      borderRadius: BORDER_RADIUS.xl, padding: 12,
                    }}>
                      <Text style={{ color: COLORS.text.muted, fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Installment</Text>
                      <Text style={{ color: COLORS.text.primary, fontWeight: "700", fontSize: 16 }}>{formatINR(item.installmentAmountPaise)}</Text>
                    </View>
                  </View>

                  <View style={{ marginBottom: 10 }}>
                    <View style={{
                      height: 6, borderRadius: 3, backgroundColor: "rgba(0,0,0,0.05)",
                      overflow: "hidden",
                    }}>
                      <View style={{
                        width: `${Math.min(progress * 100, 100)}%`, height: "100%",
                        borderRadius: 3,
                        backgroundColor: COLORS.brand[500],
                      }} />
                    </View>
                  </View>

                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      <Ionicons name="people-outline" size={14} color={COLORS.text.muted} />
                      <Text style={{ color: COLORS.text.muted, fontSize: 12, fontWeight: "600", marginLeft: 6 }}>
                        {item.filledSlots} / {item.totalSlots} slots filled
                      </Text>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Text style={{ color: COLORS.text.muted, fontSize: 11 }}>Details</Text>
                      <Ionicons name="chevron-forward" size={14} color={COLORS.text.muted} />
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
