// src/app/(auth)/otp-verify.tsx
// OTP verification with countdown timer, resend, and new-user redirect

import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, KeyboardAvoidingView, Platform, StyleSheet, TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import OTPInput from "../../components/ui/OTPInput";
import Button from "../../components/ui/Button";
import ScreenHeader from "../../components/shared/ScreenHeader";
import { authApi } from "../../services/auth.api";
import { useAuthStore } from "../../stores/auth.store";
import { tokenStorage } from "../../utils/storage";
import { COLORS, FONT_SIZE, SPACING, GRADIENTS } from "../../constants/theme";
import { APP_CONFIG } from "../../constants/config";

const OTP_EXPIRY = APP_CONFIG.OTP_EXPIRY_SECONDS;

export default function OTPVerifyScreen() {
  const router         = useRouter();
  const insets         = useSafeAreaInsets();
  const pendingPhone   = useAuthStore((s) => s.pendingPhone);
  const setUser        = useAuthStore((s) => s.setUser);
  const setAccessToken = useAuthStore((s) => s.setAccessToken);

  const [otp,        setOTP]        = useState("");
  const [error,      setError]      = useState("");
  const [isLoading,  setIsLoading]  = useState(false);
  const [countdown,  setCountdown]  = useState<number>(OTP_EXPIRY);
  const [canResend,  setCanResend]  = useState(false);

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) { setCanResend(true); return; }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  const handleVerify = async () => {
    if (otp.length < APP_CONFIG.OTP_LENGTH) {
      setError("Please enter the complete 6-digit OTP");
      return;
    }
    if (!pendingPhone) { router.replace("/(auth)/login"); return; }

    setError("");
    setIsLoading(true);
    try {
      const res = await authApi.verifyOTP({ phone: pendingPhone, otp });
      const { accessToken, refreshToken, user } = res.data.data;

      await Promise.all([
        tokenStorage.saveAccessToken(accessToken),
        tokenStorage.saveRefreshToken(refreshToken),
        tokenStorage.saveUser(user),
      ]);
      setAccessToken(accessToken);
      setUser(user);

      // New user → register; existing → MPIN enter
      if (!user.name || user.name === "") {
        router.replace("/(auth)/register");
      } else {
        router.replace("/(auth)/mpin-enter");
      }
    } catch (e: any) {
      setError(e.message ?? "Invalid OTP. Please try again.");
      setOTP("");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (!pendingPhone || !canResend) return;
    try {
      await authApi.sendOTP({ phone: pendingPhone });
      setCountdown(OTP_EXPIRY);
      setCanResend(false);
      setError("");
      setOTP("");
    } catch (e: any) {
      setError(e.message ?? "Failed to resend OTP");
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: COLORS.surface.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScreenHeader title="Verify OTP" showBack />
      <LinearGradient
        colors={["rgba(111,94,255,0.18)", "transparent"]}
        style={styles.blob}
      />

      <View style={[styles.content, { paddingBottom: insets.bottom + SPACING[6] }]}>
        <View style={styles.top}>
          <View style={styles.iconCircle}>
            <LinearGradient colors={GRADIENTS.brandPrimary as [string, string]} style={StyleSheet.absoluteFill} />
            <Ionicons name="mail-outline" size={28} color="#fff" />
          </View>
          <Text style={styles.title}>Check your SMS</Text>
          <Text style={styles.subtitle}>
            We sent a 6-digit code to{"\n"}
            <Text style={{ color: COLORS.brand[300], fontWeight: "700" }}>
              +91 {pendingPhone}
            </Text>
          </Text>
        </View>

        <OTPInput
          value={otp}
          onChange={(val) => { setOTP(val); setError(""); }}
          error={error}
          autoFocus
        />

        {/* Auto verify when 6 digits entered */}
        {otp.length === APP_CONFIG.OTP_LENGTH && !isLoading && (() => {
          setTimeout(() => handleVerify(), 100);
          return null;
        })()}

        <Button
          label="Verify OTP"
          variant="primary"
          size="lg"
          isLoading={isLoading}
          onPress={handleVerify}
        />

        {/* Resend section */}
        <View style={styles.resendRow}>
          {canResend ? (
            <TouchableOpacity onPress={handleResend}>
              <Text style={{ fontSize: FONT_SIZE.sm, color: COLORS.brand[400], fontWeight: "600" }}>
                Resend OTP
              </Text>
            </TouchableOpacity>
          ) : (
            <Text style={{ fontSize: FONT_SIZE.sm, color: COLORS.text.muted }}>
              Resend in{" "}
              <Text style={{ color: COLORS.brand[400], fontWeight: "600" }}>
                {formatTime(countdown)}
              </Text>
            </Text>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  blob: { position: "absolute", top: -40, right: -60, width: 220, height: 220, borderRadius: 110 },
  content: { flex: 1, paddingHorizontal: SPACING[6], gap: SPACING[8], paddingTop: SPACING[4] },
  top:     { gap: SPACING[3] },
  iconCircle: {
    width: 64, height: 64, borderRadius: 20, overflow: "hidden",
    alignItems: "center", justifyContent: "center", marginBottom: SPACING[2],
  },
  title:    { fontSize: FONT_SIZE["2xl"], fontWeight: "800", color: COLORS.text.primary },
  subtitle: { fontSize: FONT_SIZE.base, color: COLORS.text.secondary, lineHeight: 24 },
  resendRow:{ alignItems: "center" },
});
