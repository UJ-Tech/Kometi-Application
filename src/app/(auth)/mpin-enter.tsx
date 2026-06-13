// src/app/(auth)/mpin-enter.tsx
// Returning user MPIN gate — with biometric shortcut

import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import OTPInput from "../../components/ui/OTPInput";
import Button from "../../components/ui/Button";
import { authApi } from "../../services/auth.api";
import { useAuthStore } from "../../stores/auth.store";
import { useBiometrics } from "../../hooks/useBiometrics";
import { COLORS, FONT_SIZE, SPACING, GRADIENTS } from "../../constants/theme";

export default function MPINEnterScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const user    = useAuthStore((s) => s.user);
  const logout  = useAuthStore((s) => s.logout);
  const { isEnrolled, biometricType, authenticate } = useBiometrics();

  const [mpin,      setMPIN]      = useState("");
  const [error,     setError]     = useState("");
  const [attempts,  setAttempts]  = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const MAX_ATTEMPTS = 5;

  const handleBiometric = async () => {
    const ok = await authenticate("Verify your identity to continue");
    if (ok) router.replace("/(app)/dashboard");
  };

  useEffect(() => {
    // Offer biometric on mount
    if (isEnrolled) handleBiometric();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEnrolled]);

  const handleVerify = async () => {
    if (mpin.length < 6) { setError("Enter your 6-digit MPIN"); return; }
    if (attempts >= MAX_ATTEMPTS) {
      Alert.alert("Account Locked", "Too many failed attempts. Please login again.", [
        { text: "OK", onPress: async () => { await logout(); router.replace("/(auth)/login"); } },
      ]);
      return;
    }

    setIsLoading(true);
    setError("");
    try {
      const res = await authApi.verifyMPIN({ mpin });
      if (res.data.data.verified) {
        router.replace("/(app)/dashboard");
      } else {
        throw new Error("Incorrect MPIN");
      }
    } catch {
      const remaining = MAX_ATTEMPTS - attempts - 1;
      setAttempts((a) => a + 1);
      setError(`Incorrect MPIN. ${remaining} attempts remaining.`);
      setMPIN("");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.surface.bg }}>
      <LinearGradient colors={["rgba(111,94,255,0.22)", "transparent"]} style={styles.blob} />

      <View style={[styles.content, { paddingTop: insets.top + SPACING[10], paddingBottom: insets.bottom + SPACING[8] }]}>
        <View style={styles.top}>
          <View style={styles.avatar}>
            <LinearGradient colors={GRADIENTS.brandPrimary as [string, string]} style={StyleSheet.absoluteFill} />
            <Text style={styles.avatarText}>
              {user?.name?.[0]?.toUpperCase() ?? "K"}
            </Text>
          </View>
          <Text style={styles.welcome}>Welcome back</Text>
          <Text style={styles.name}>{user?.name ?? "User"}</Text>
        </View>

        <View style={styles.pinSection}>
          <Text style={styles.pinLabel}>Enter your MPIN</Text>
          <OTPInput
            value={mpin}
            onChange={(val) => { setMPIN(val); setError(""); }}
            error={error}
          />
        </View>

        {isEnrolled && (
          <TouchableOpacity style={styles.biometricBtn} onPress={handleBiometric}>
            <View style={styles.biometricCircle}>
              <Ionicons
                name={biometricType === "face" ? "scan-outline" : "finger-print-outline"}
                size={28}
                color={COLORS.brand[400]}
              />
            </View>
            <Text style={styles.biometricText}>
              Use {biometricType === "face" ? "Face ID" : "Fingerprint"}
            </Text>
          </TouchableOpacity>
        )}

        <Button
          label="Continue"
          variant="primary"
          size="lg"
          isLoading={isLoading}
          onPress={handleVerify}
          disabled={mpin.length < 6}
        />

        <TouchableOpacity onPress={() => router.push("/(auth)/login")}>
          <Text style={styles.switchText}>Not you? Switch account</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  blob: { position: "absolute", top: -80, right: -60, width: 280, height: 280, borderRadius: 140 },
  content: { flex: 1, paddingHorizontal: SPACING[6], gap: SPACING[8] },
  top:     { alignItems: "center", gap: SPACING[2] },
  avatar:  {
    width: 80, height: 80, borderRadius: 40, overflow: "hidden",
    alignItems: "center", justifyContent: "center", marginBottom: SPACING[1],
  },
  avatarText: { fontSize: FONT_SIZE["2xl"], fontWeight: "800", color: "#fff" },
  welcome:    { fontSize: FONT_SIZE.base, color: COLORS.text.secondary },
  name:       { fontSize: FONT_SIZE["2xl"], fontWeight: "800", color: COLORS.text.primary },
  pinSection: { gap: SPACING[4] },
  pinLabel:   { fontSize: FONT_SIZE.base, color: COLORS.text.secondary, fontWeight: "500", textAlign: "center" },
  biometricBtn:   { alignItems: "center", gap: SPACING[2] },
  biometricCircle:{
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: "rgba(111,94,255,0.10)",
    borderWidth: 1, borderColor: COLORS.surface.border,
    alignItems: "center", justifyContent: "center",
  },
  biometricText: { fontSize: FONT_SIZE.sm, color: COLORS.brand[400], fontWeight: "600" },
  switchText:    { textAlign: "center", fontSize: FONT_SIZE.sm, color: COLORS.text.muted, fontWeight: "500" },
});
