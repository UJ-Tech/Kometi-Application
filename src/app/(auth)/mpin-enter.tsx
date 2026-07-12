import React, { useState, useEffect, useRef } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import OTPInput from "../../components/ui/OTPInput";
import Button from "../../components/ui/Button";
import { authApi } from "../../services/auth.api";
import { useAuthStore } from "../../stores/auth.store";
import { useBiometrics } from "../../hooks/useBiometrics";
import { COLORS, FONT_SIZE, SPACING, BORDER_RADIUS } from "../../constants/theme";
import { useAlertModal } from "../../components/ui/AlertModal";

const LOCKOUT_KEY = "mpin_lockout";
const LOCKOUT_MINUTES = 10;

export default function MPINEnterScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const user    = useAuthStore((s) => s.user);
  const logout  = useAuthStore((s) => s.logout);
  const { isEnrolled, biometricType, authenticate } = useBiometrics();
  const { alert, confirm, AlertComponent } = useAlertModal();

  const [mpin,      setMPIN]      = useState("");
  const [error,     setError]     = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);
  const [lockedUntil, setLockedUntil] = useState<Date | null>(null);
  const [lockoutTimer, setLockoutTimer] = useState("");

  const handleBiometric = async () => {
    const ok = await authenticate("Verify your identity to continue");
    if (ok) router.replace("/(app)/dashboard");
  };

  const biometricOffered = useRef(false);

  const checkLockout = async () => {
    try {
      const stored = await AsyncStorage.getItem(LOCKOUT_KEY);
      if (!stored) return;
      const data = JSON.parse(stored);
      const until = new Date(data.lockedUntil);
      if (until > new Date()) {
        setLockedUntil(until);
        setRemainingAttempts(0);
      } else {
        await AsyncStorage.removeItem(LOCKOUT_KEY);
      }
    } catch {}
  };

  useEffect(() => {
    checkLockout();
    if (isEnrolled && !biometricOffered.current) {
      biometricOffered.current = true;
      handleBiometric();
    }
  }, [isEnrolled]);

  useEffect(() => {
    if (!lockedUntil) return;
    const interval = setInterval(() => {
      const diff = lockedUntil.getTime() - Date.now();
      if (diff <= 0) {
        setLockedUntil(null);
        setRemainingAttempts(null);
        setLockoutTimer("");
        AsyncStorage.removeItem(LOCKOUT_KEY).catch(() => {});
        return;
      }
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setLockoutTimer(`${mins}:${secs.toString().padStart(2, "0")}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [lockedUntil]);

  const handleVerify = async () => {
    if (mpin.length < 6) { setError("Enter your 6-digit MPIN"); return; }
    if (lockedUntil) return;

    setIsLoading(true);
    setError("");
    try {
      const res = await authApi.verifyMPIN({ mpin });
      if (res.data.data.verified) {
        await AsyncStorage.removeItem(LOCKOUT_KEY).catch(() => {});
        setRemainingAttempts(null);
        router.replace("/(app)/dashboard");
      }
    } catch (err: any) {
      const remaining = err.data?.remainingAttempts as number | undefined;
      const isLocked = err.data?.locked === true;

      if (isLocked || err.status === 429) {
        const until = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
        setLockedUntil(until);
        setRemainingAttempts(0);
        await AsyncStorage.setItem(LOCKOUT_KEY, JSON.stringify({ lockedUntil: until.toISOString() }));
        setError(`Too many failed attempts. Try again after ${LOCKOUT_MINUTES} minutes.`);
      } else if (remaining !== undefined && remaining > 0) {
        setRemainingAttempts(remaining);
        setError(`Incorrect MPIN. ${remaining} attempt(s) remaining.`);
      } else {
        setError("Incorrect MPIN.");
      }
      setMPIN("");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
    <View style={{ flex: 1, backgroundColor: COLORS.surface.bg }}>
      <View style={{ paddingTop: insets.top + SPACING[2], paddingHorizontal: SPACING[5] }}>
        <TouchableOpacity
          onPress={() => router.replace("/(auth)/login")}
          style={{
            width: 38,
            height: 38,
            borderRadius: BORDER_RADIUS.lg,
            backgroundColor: "rgba(79, 70, 229, 0.08)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="chevron-back" size={20} color={COLORS.text.primary} />
        </TouchableOpacity>
      </View>

      <View style={[{ flex: 1, paddingHorizontal: SPACING[6], justifyContent: "space-between" }, { paddingBottom: insets.bottom + SPACING[6] }]}>
        <View style={{ alignItems: "center", gap: SPACING[2], marginTop: SPACING[4] }}>
          {/* Avatar */}
          <LinearGradient
            colors={["#6366f1", "#4f46e5"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              width: 86,
              height: 86,
              borderRadius: 43,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: SPACING[2],
              shadowColor: COLORS.brand[500],
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.3,
              shadowRadius: 20,
              elevation: 8,
            }}
          >
            <Text style={{ fontSize: FONT_SIZE["3xl"], fontWeight: "800", color: COLORS.white }}>
              {user?.name?.[0]?.toUpperCase() ?? "K"}
            </Text>
          </LinearGradient>
          <Text style={{ fontSize: FONT_SIZE.base, color: COLORS.text.secondary }}>Welcome back</Text>
          <Text style={{ fontSize: FONT_SIZE["2xl"], fontWeight: "800", color: COLORS.text.primary }}>
            {user?.name ?? "User"}
          </Text>
        </View>

        <View style={{ gap: SPACING[4] }}>
          {lockedUntil ? (
            <View style={{ alignItems: "center", gap: SPACING[4] }}>
              <Ionicons name="lock-closed-outline" size={48} color={COLORS.text.muted} />
              <View style={{ alignItems: "center", gap: SPACING[1] }}>
                <Text style={{ fontSize: FONT_SIZE.lg, color: COLORS.text.primary, fontWeight: "700" }}>
                  Account Locked
                </Text>
                <Text style={{ fontSize: FONT_SIZE.sm, color: COLORS.text.muted, textAlign: "center" }}>
                  Too many failed attempts. Try again in
                </Text>
              </View>
              <Text style={{ fontSize: FONT_SIZE["4xl"], fontWeight: "800", color: COLORS.brand[600], fontVariant: ["tabular-nums"] }}>
                {lockoutTimer}
              </Text>
            </View>
          ) : (
            <View style={{ gap: SPACING[4] }}>
              <Text style={{ fontSize: FONT_SIZE.base, color: COLORS.text.secondary, fontWeight: "500", textAlign: "center" }}>
                Enter your MPIN
              </Text>
              <OTPInput
                value={mpin}
                onChange={(val) => { setMPIN(val); setError(""); }}
                error={error}
              />
              {remainingAttempts !== null && (
                <Text style={{ fontSize: FONT_SIZE.sm, color: COLORS.warning.DEFAULT, fontWeight: "500", textAlign: "center" }}>
                  {remainingAttempts} attempt(s) remaining
                </Text>
              )}
            </View>
          )}

          {isEnrolled && !lockedUntil && (
            <TouchableOpacity style={{ alignItems: "center", gap: SPACING[2] }} onPress={handleBiometric}>
              <LinearGradient
                colors={["rgba(79, 70, 229, 0.08)", "rgba(79, 70, 229, 0.04)"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: "rgba(79, 70, 229, 0.15)",
                }}
              >
                <Ionicons
                  name={biometricType === "face" ? "scan-outline" : "finger-print-outline"}
                  size={28}
                  color={COLORS.brand[600]}
                />
              </LinearGradient>
              <Text style={{ fontSize: FONT_SIZE.sm, color: COLORS.brand[600], fontWeight: "600" }}>
                Use {biometricType === "face" ? "Face ID" : "Fingerprint"}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={{ gap: SPACING[4] }}>
          <Button
            label="Continue"
            variant="primary"
            size="lg"
            gradient
            isLoading={isLoading}
            onPress={handleVerify}
            disabled={mpin.length < 6 || !!lockedUntil}
          />

          <TouchableOpacity onPress={() => router.push("/(auth)/login")}>
            <Text style={{ textAlign: "center", fontSize: FONT_SIZE.sm, color: COLORS.text.muted, fontWeight: "500" }}>
              Not you? Switch account
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
    <AlertComponent />
    </>
  );
}
