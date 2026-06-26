// src/app/(auth)/mpin-enter.tsx
// Returning user MPIN gate — with biometric shortcut

import React, { useState, useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import OTPInput from "../../components/ui/OTPInput";
import Button from "../../components/ui/Button";
import { authApi } from "../../services/auth.api";
import { useAuthStore } from "../../stores/auth.store";
import { useBiometrics } from "../../hooks/useBiometrics";
import { COLORS, FONT_SIZE, SPACING } from "../../constants/theme";
import { useAlertModal } from "../../components/ui/AlertModal";

export default function MPINEnterScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const user    = useAuthStore((s) => s.user);
  const logout  = useAuthStore((s) => s.logout);
  const { isEnrolled, biometricType, authenticate } = useBiometrics();
  const { alert, confirm, AlertComponent } = useAlertModal();

  const [mpin,      setMPIN]      = useState("");
  const [error,     setError]     = useState("");
  const [attempts,  setAttempts]  = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const MAX_ATTEMPTS = 5;

  const handleBiometric = async () => {
    const ok = await authenticate("Verify your identity to continue");
    if (ok) router.replace("/(app)/dashboard");
  };

  const biometricOffered = useRef(false);
  useEffect(() => {
    if (isEnrolled && !biometricOffered.current) {
      biometricOffered.current = true;
      handleBiometric();
    }
  }, [isEnrolled]);

  const handleVerify = async () => {
    if (mpin.length < 6) { setError("Enter your 6-digit MPIN"); return; }
    if (attempts >= MAX_ATTEMPTS) {
      await alert("Account Locked", "Too many failed attempts. Please login again.");
      await logout();
      router.replace("/(auth)/login");
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
    <>
    <View style={{ flex: 1, backgroundColor: COLORS.surface.bg }}>

      {/* Back Button */}
      <View style={{ paddingTop: insets.top + SPACING[2], paddingHorizontal: SPACING[5] }}>
        <TouchableOpacity
          onPress={() => router.replace("/(auth)/login")}
          style={{
            width: 38, height: 38, borderRadius: 12,
            backgroundColor: "rgba(13,148,136,0.08)",
            alignItems: "center", justifyContent: "center",
          }}
        >
          <Ionicons name="chevron-back" size={20} color={COLORS.text.primary} />
        </TouchableOpacity>
      </View>

      <View style={[styles.content, { paddingBottom: insets.bottom + SPACING[6] }]}>
        <View style={styles.top}>
          <View style={styles.avatar}>
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
              color={COLORS.brand[600]}
            />
            </View>
            <Text style={styles.biometricText}>
              Use {biometricType === "face" ? "Face ID" : "Fingerprint"}
            </Text>
          </TouchableOpacity>
        )}

        <View style={{ gap: SPACING[4] }}>
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
    </View>
    <AlertComponent />
    </>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, paddingHorizontal: SPACING[6], justifyContent: "space-between" },
  top:     { alignItems: "center", gap: SPACING[2], marginTop: SPACING[4] },
  avatar:  {
    width: 86, height: 86, borderRadius: 43,
    alignItems: "center", justifyContent: "center", marginBottom: SPACING[2],
    backgroundColor: COLORS.surface.card,
    borderWidth: 1,
    borderColor: COLORS.surface.border,
    shadowColor: COLORS.brand[500],
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 8,
  },
  avatarText: { fontSize: FONT_SIZE["2xl"], fontWeight: "800", color: "#fff" },
  welcome:    { fontSize: FONT_SIZE.base, color: COLORS.text.secondary },
  name:       { fontSize: FONT_SIZE["2xl"], fontWeight: "800", color: COLORS.text.primary },
  pinSection: { gap: SPACING[4], marginVertical: SPACING[2] },
  pinLabel:   { fontSize: FONT_SIZE.base, color: COLORS.text.secondary, fontWeight: "500", textAlign: "center" },
  biometricBtn:   { alignItems: "center", gap: SPACING[2] },
  biometricCircle:{
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: "rgba(13,148,136,0.06)",
    borderWidth: 1,
    borderColor: "rgba(13,148,136,0.15)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: COLORS.brand[500],
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 2,
  },
  biometricText: { fontSize: FONT_SIZE.sm, color: COLORS.brand[600], fontWeight: "600" },
  switchText:    { textAlign: "center", fontSize: FONT_SIZE.sm, color: COLORS.text.muted, fontWeight: "500" },
});
