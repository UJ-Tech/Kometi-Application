import React, { useState, useEffect, useRef } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import OTPInput from "../../components/ui/OTPInput";
import Button from "../../components/ui/Button";
import { authApi } from "../../services/auth.api";
import { useAuthStore } from "../../stores/auth.store";
import { useBiometrics } from "../../hooks/useBiometrics";
import { COLORS, FONT_SIZE, SPACING, BORDER_RADIUS } from "../../constants/theme";
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
          <View style={{ gap: SPACING[4] }}>
            <Text style={{ fontSize: FONT_SIZE.base, color: COLORS.text.secondary, fontWeight: "500", textAlign: "center" }}>
              Enter your MPIN
            </Text>
            <OTPInput
              value={mpin}
              onChange={(val) => { setMPIN(val); setError(""); }}
              error={error}
            />
          </View>

          {isEnrolled && (
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
            disabled={mpin.length < 6}
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
