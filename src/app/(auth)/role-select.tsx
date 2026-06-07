// src/app/(auth)/role-select.tsx
// Role selection — choose between Committee Member or Organizer

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

type RoleOption = "MEMBER" | "ORGANIZER";

export default function RoleSelectScreen() {
  const router   = useRouter();
  const insets   = useSafeAreaInsets();
  const setUser  = useAuthStore((s) => s.setUser);

  const [selectedRole, setSelectedRole] = useState<RoleOption>("MEMBER");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleContinue = async () => {
    setIsLoading(true);
    setError("");
    try {
      const res = await authApi.setRole({ role: selectedRole });
      const updatedUser = res.data.data;
      setUser(updatedUser);

      if (selectedRole === "ORGANIZER") {
        router.replace({ pathname: "/(app)/dashboard" } as any);
      } else {
        router.push({ pathname: "/(auth)/join-committee" } as any);
      }
    } catch (e: any) {
      setError(e.message ?? "Failed to set role. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const roles: { value: RoleOption; icon: string; title: string; description: string; gradient: readonly [string, string] }[] = [
    {
      value: "MEMBER",
      icon: "people-outline",
      title: "Committee Member",
      description: "Join an existing committee using an invite code. Pay installments and receive payouts.",
      gradient: ["rgba(245,158,11,0.25)", "rgba(245,158,11,0.08)"] as const,
    },
    {
      value: "ORGANIZER",
      icon: "star-outline",
      title: "Organizer",
      description: "Create and manage your own chit committees. Invite members, collect installments, and distribute payouts.",
      gradient: ["rgba(111,94,255,0.25)", "rgba(111,94,255,0.08)"] as const,
    },
  ];

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
            Select how you want to use Kometi. You can change this later from settings.
          </Text>
        </View>

        {roles.map((role) => {
          const isSelected = selectedRole === role.value;
          return (
            <TouchableOpacity
              key={role.value}
              onPress={() => setSelectedRole(role.value)}
              activeOpacity={0.7}
              style={[
                styles.card,
                isSelected && styles.cardSelected,
                isSelected && role.value === "ORGANIZER" && styles.cardSelectedOrganizer,
              ]}
            >
              {isSelected && (
                <LinearGradient
                  colors={role.gradient}
                  style={StyleSheet.absoluteFill}
                />
              )}
              <View style={[
                styles.cardIcon,
                isSelected && role.value === "ORGANIZER" ? styles.cardIconOrganizer : styles.cardIconMember,
              ]}>
                <Ionicons
                  name={role.icon as any}
                  size={28}
                  color={isSelected ? (role.value === "ORGANIZER" ? COLORS.brandPrimary : COLORS.gold[400]) : "#71717a"}
                />
              </View>
              <Text style={[
                styles.cardTitle,
                isSelected && (role.value === "ORGANIZER" ? styles.cardTitleOrganizer : styles.cardTitleMember),
              ]}>
                {role.title}
              </Text>
              <Text style={styles.cardDesc}>{role.description}</Text>
              {isSelected && (
                <View style={styles.checkBadge}>
                  <Ionicons
                    name="checkmark-circle"
                    size={18}
                    color={role.value === "ORGANIZER" ? COLORS.brandPrimary : COLORS.gold[400]}
                  />
                </View>
              )}
            </TouchableOpacity>
          );
        })}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button
          label={selectedRole === "ORGANIZER" ? "Continue as Organizer" : "Continue as Member"}
          variant={selectedRole === "ORGANIZER" ? "primary" : "gold"}
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
  content: { flex: 1, paddingHorizontal: SPACING[6], gap: SPACING[5], paddingTop: SPACING[4] },
  top: { gap: SPACING[3] },
  iconCircle: {
    width: 64, height: 64, borderRadius: 20, overflow: "hidden",
    alignItems: "center", justifyContent: "center", marginBottom: SPACING[2],
  },
  title: { fontSize: FONT_SIZE["3xl"], fontWeight: "800", color: COLORS.text.primary, lineHeight: 36 },
  subtitle: { fontSize: FONT_SIZE.base, color: COLORS.text.secondary, lineHeight: 22 },
  card: {
    position: "relative", borderRadius: 16, padding: SPACING[5],
    borderWidth: 1.5, borderColor: "transparent",
    overflow: "hidden",
  },
  cardSelected: {
    borderColor: COLORS.gold[500],
  },
  cardSelectedOrganizer: {
    borderColor: COLORS.brandPrimary,
  },
  cardIcon: {
    width: 48, height: 48, borderRadius: 14,
    alignItems: "center", justifyContent: "center",
    marginBottom: SPACING[3],
  },
  cardIconMember: {
    backgroundColor: "rgba(245,158,11,0.15)",
  },
  cardIconOrganizer: {
    backgroundColor: "rgba(111,94,255,0.15)",
  },
  cardTitle: { fontSize: FONT_SIZE.lg, fontWeight: "700", color: COLORS.text.secondary, marginBottom: SPACING[1] },
  cardTitleMember: { color: COLORS.gold[300] },
  cardTitleOrganizer: { color: COLORS.brandPrimary },
  cardDesc: { fontSize: FONT_SIZE.sm, color: COLORS.text.secondary, lineHeight: 20 },
  checkBadge: { position: "absolute", top: SPACING[4], right: SPACING[4] },
  error: { fontSize: FONT_SIZE.sm, color: COLORS.danger.light, textAlign: "center" },
});
