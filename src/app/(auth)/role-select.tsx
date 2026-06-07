// src/app/(auth)/role-select.tsx
// Role selection — committee membership onboarding

import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Button from "../../components/ui/Button";
import ScreenHeader from "../../components/shared/ScreenHeader";
import { authApi } from "../../services/auth.api";
import { useAuthStore } from "../../stores/auth.store";
import { COLORS, FONT_SIZE, SPACING, GRADIENTS } from "../../constants/theme";

export default function RoleSelectScreen() {
  const router   = useRouter();
  const insets   = useSafeAreaInsets();
  const setUser  = useAuthStore((s) => s.setUser);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleContinue = async () => {
    setIsLoading(true);
    setError("");
    try {
      const res = await authApi.setRole({ role: "MEMBER" });
      const updatedUser = res.data.data;
      setUser(updatedUser);
      router.push({ pathname: "/(auth)/join-committee" } as any);
    } catch (e: any) {
      setError(e.message ?? "Failed to set role. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.surface.bg }}>
      <ScreenHeader
        title="Choose Your Role"
        showBack
        onBack={() => router.replace("/(auth)/mpin-setup")}
      />
      <LinearGradient
        colors={["rgba(111,94,255,0.18)", "transparent"]}
        style={styles.blob}
      />

      <View style={[styles.content, { paddingBottom: insets.bottom + SPACING[8] }]}>
        <View style={styles.top}>
          <View style={styles.iconCircle}>
            <LinearGradient colors={GRADIENTS.brandPrimary as readonly [string, string]} style={StyleSheet.absoluteFill} />
            <Ionicons name="people-outline" size={28} color="#fff" />
          </View>
          <Text style={styles.title}>Welcome to{"\n"}Kometi!</Text>
          <Text style={styles.subtitle}>
            Join a chit committee using an invite code. Pay installments and receive payouts.
          </Text>
        </View>

        <View style={styles.card}>
          <LinearGradient
            colors={["rgba(245,158,11,0.25)", "rgba(245,158,11,0.08)"]}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.cardIconActiveGold}>
            <Ionicons name="person-outline" size={28} color={COLORS.gold[400]} />
          </View>
          <Text style={styles.cardTitleActiveGold}>
            Committee Member
          </Text>
          <Text style={styles.cardDesc}>
            Join an existing committee using an invite code. Pay installments and receive payouts.
          </Text>
          <View style={styles.checkBadge}>
            <Ionicons name="checkmark-circle" size={18} color={COLORS.gold[400]} />
          </View>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button
          label="Continue as Member"
          variant="gold"
          size="lg"
          isLoading={isLoading}
          onPress={handleContinue}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  blob: { position: "absolute", top: -40, left: -60, width: 220, height: 220, borderRadius: 110 },
  content: { flex: 1, paddingHorizontal: SPACING[6], gap: SPACING[6], paddingTop: SPACING[4] },
  top: { gap: SPACING[3] },
  iconCircle: {
    width: 64, height: 64, borderRadius: 20, overflow: "hidden",
    alignItems: "center", justifyContent: "center", marginBottom: SPACING[2],
  },
  title: { fontSize: FONT_SIZE["3xl"], fontWeight: "800", color: COLORS.text.primary, lineHeight: 36 },
  subtitle: { fontSize: FONT_SIZE.base, color: COLORS.text.secondary, lineHeight: 22 },
  card: {
    position: "relative", borderRadius: 16, padding: SPACING[5],
    borderWidth: 1.5, borderColor: COLORS.gold[500],
    overflow: "hidden",
  },
  cardIconActiveGold: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: "rgba(245,158,11,0.15)",
    alignItems: "center", justifyContent: "center",
    marginBottom: SPACING[3],
  },
  cardTitleActiveGold: { fontSize: FONT_SIZE.lg, fontWeight: "700", color: COLORS.gold[300], marginBottom: SPACING[1] },
  cardDesc: { fontSize: FONT_SIZE.sm, color: COLORS.text.secondary, lineHeight: 20 },
  checkBadge: { position: "absolute", top: SPACING[4], right: SPACING[4] },
  error: { fontSize: FONT_SIZE.sm, color: COLORS.danger.light, textAlign: "center" },
});
