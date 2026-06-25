// src/app/(auth)/join-committee.tsx
// Join committee by entering an 8-character invite code

import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput, KeyboardAvoidingView, Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Button from "../../components/ui/Button";
import ScreenHeader from "../../components/shared/ScreenHeader";
import { committeesApi } from "../../services/committees.api";
import { COLORS, FONT_SIZE, SPACING } from "../../constants/theme";

export default function JoinCommitteeScreen() {
  const router   = useRouter();
  const insets   = useSafeAreaInsets();

  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleJoin = async () => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length !== 8) {
      setError("Invite code must be 8 characters");
      return;
    }

    setIsLoading(true);
    setError("");
    try {
      const res = await committeesApi.joinByCode(trimmed);
      const { committee, joinRequest } = res.data.data;

      router.replace({
        pathname: "/(auth)/join-pending",
        params: {
          committeeId: committee.id,
          committeeName: committee.name,
          requestId: joinRequest.id,
        },
      } as any);
    } catch (e: any) {
      setError(e.message ?? "Failed to join committee. Please check the code.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = () => {
    router.replace("/(app)/dashboard");
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: COLORS.surface.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScreenHeader title="Join Committee" showBack />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING[8] }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.top}>
          <View style={styles.iconCircle}>
            <Ionicons name="key-outline" size={28} color={COLORS.gold[400]} />
          </View>
          <Text style={styles.title}>Enter Invite Code</Text>
          <Text style={styles.subtitle}>
            Ask your committee organizer for the 8-character invite code, then enter it below.
          </Text>
        </View>

        {/* Code Input */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.codeInput}
            value={code}
            onChangeText={(t) => {
              setCode(t.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8));
              setError("");
            }}
            placeholder="XXXXXXXX"
            placeholderTextColor={COLORS.text.muted}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={8}
            autoFocus
          />
          {code.length > 0 && (
            <Text style={styles.charCount}>{code.length}/8</Text>
          )}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {/* Info Box */}
        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={18} color={COLORS.brand[400]} />
          <Text style={styles.infoText}>
            The invite code is provided by your committee organizer. It is unique to each committee and allows you to request membership.
          </Text>
        </View>

        <Button
          label="Request to Join"
          variant="gold"
          size="lg"
          isLoading={isLoading}
          onPress={handleJoin}
          disabled={code.length !== 8}
        />

        <Button
          label="Skip for Now"
          variant="ghost"
          size="md"
          onPress={handleSkip}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingHorizontal: SPACING[6], gap: SPACING[6], paddingTop: SPACING[4] },
  top: { gap: SPACING[3] },
  iconCircle: {
    width: 64, height: 64, borderRadius: 20,
    alignItems: "center", justifyContent: "center", marginBottom: SPACING[2],
    backgroundColor: COLORS.surface.card,
    borderWidth: 1,
    borderColor: COLORS.surface.border,
  },
  title: { fontSize: FONT_SIZE["3xl"], fontWeight: "800", color: COLORS.text.primary, lineHeight: 36 },
  subtitle: { fontSize: FONT_SIZE.base, color: COLORS.text.secondary, lineHeight: 22 },
  inputContainer: { alignItems: "center" },
  codeInput: {
    width: "100%", height: 64, borderRadius: 16,
    backgroundColor: COLORS.surface.card,
    borderWidth: 1.5, borderColor: COLORS.surface.border,
    fontSize: FONT_SIZE["2xl"], fontWeight: "700",
    color: COLORS.gold[500], textAlign: "center",
    letterSpacing: 6,
  },
  charCount: {
    position: "absolute", right: SPACING[4], top: "50%",
    transform: [{ translateY: -10 }],
    fontSize: FONT_SIZE.xs, color: COLORS.text.muted,
  },
  error: { fontSize: FONT_SIZE.sm, color: COLORS.danger.light, textAlign: "center" },
  infoBox: {
    flexDirection: "row", gap: SPACING[2],
    backgroundColor: "rgba(13,148,136,0.06)", borderRadius: 12,
    padding: SPACING[4], alignItems: "flex-start",
  },
  infoText: { flex: 1, fontSize: FONT_SIZE.sm, color: COLORS.text.secondary, lineHeight: 20 },
});
