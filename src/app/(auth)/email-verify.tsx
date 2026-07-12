import React, { useState, useEffect } from "react";
import {
  View, Text, KeyboardAvoidingView, Platform, TouchableOpacity,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import OTPInput from "../../components/ui/OTPInput";
import Input from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import ScreenHeader from "../../components/shared/ScreenHeader";
import { authApi } from "../../services/auth.api";
import { useAuthStore } from "../../stores/auth.store";
import { isValidEmail } from "../../utils/validators";
import { COLORS, FONT_SIZE, SPACING, BORDER_RADIUS } from "../../constants/theme";
import { APP_CONFIG } from "../../constants/config";

const OTP_EXPIRY = APP_CONFIG.OTP_EXPIRY_SECONDS;

export default function EmailVerifyScreen() {
  const router   = useRouter();
  const params   = useLocalSearchParams<{ returnTo?: string }>();
  const insets   = useSafeAreaInsets();
  const user     = useAuthStore((s) => s.user);
  const updateProfile = useAuthStore((s) => s.updateProfile);

  const isFromRegistration = !!params.returnTo;

  const [email,         setEmail]         = useState(user?.email ?? "");
  const [otp,           setOTP]           = useState("");
  const [error,         setError]         = useState("");
  const [isLoading,     setIsLoading]     = useState(false);
  const [step,          setStep]          = useState<"email" | "otp">("email");
  const [countdown,     setCountdown]     = useState<number>(0);
  const [canResend,     setCanResend]     = useState(false);

  useEffect(() => {
    if (countdown <= 0) { setCanResend(true); return; }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  const handleSendOtp = async () => {
    if (!isValidEmail(email)) { setError("Enter a valid email address"); return; }

    setIsLoading(true);
    setError("");
    try {
      await authApi.sendEmailOTP({ email: email.trim().toLowerCase() });
      setStep("otp");
      setCountdown(OTP_EXPIRY);
      setCanResend(false);
      setOTP("");
    } catch (e: any) {
      setError(e.message ?? "Failed to send OTP. Try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async () => {
    if (otp.length < APP_CONFIG.OTP_LENGTH) {
      setError("Please enter the complete 6-digit OTP");
      return;
    }

    setIsLoading(true);
    setError("");
    try {
      await authApi.verifyEmailOTP({ email: email.trim().toLowerCase(), otp });
      if (user) {
        updateProfile({ email: email.trim().toLowerCase() });
      }
      if (isFromRegistration) {
        router.replace(`/(auth)/${params.returnTo}`);
      } else {
        router.back();
      }
    } catch (e: any) {
      setError(e.message ?? "Invalid OTP. Please try again.");
      setOTP("");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: COLORS.surface.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScreenHeader title="Verify Email" showBack={!isFromRegistration} />

      <View style={[{ flex: 1, paddingHorizontal: SPACING[6], gap: SPACING[8], paddingTop: SPACING[4] }, { paddingBottom: insets.bottom + SPACING[6] }]}>
        <View style={{ alignItems: "center", gap: SPACING[3] }}>
          <LinearGradient
            colors={["rgba(79, 70, 229, 0.1)", "rgba(79, 70, 229, 0.04)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              width: 72,
              height: 72,
              borderRadius: 22,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: "rgba(79, 70, 229, 0.1)",
            }}
          >
            <Ionicons name="mail-outline" size={32} color={COLORS.brand[500]} />
          </LinearGradient>
          <View style={{ alignItems: "center", gap: SPACING[1] }}>
            <Text style={{ fontSize: FONT_SIZE["2xl"], fontWeight: "800", color: COLORS.text.primary }}>
              {step === "email" ? "Verify your email" : "Check your email"}
            </Text>
            {step === "email" ? (
              <Text style={{ fontSize: FONT_SIZE.base, color: COLORS.text.secondary, lineHeight: 24, textAlign: "center" }}>
                {isFromRegistration
                  ? "Verify your email to continue. We'll send a 6-digit code."
                  : "We'll send a 6-digit code to your email"
                }
              </Text>
            ) : (
              <Text style={{ fontSize: FONT_SIZE.base, color: COLORS.text.secondary, lineHeight: 24, textAlign: "center" }}>
                We sent a 6-digit code to{"\n"}
                <Text style={{ color: COLORS.brand[500], fontWeight: "700" }}>{email}</Text>
              </Text>
            )}
          </View>
        </View>

        {step === "email" ? (
          <View style={{ gap: SPACING[4] }}>
            <Input
              label="Email"
              placeholder="rahul@example.com"
              value={email}
              onChangeText={(t) => { setEmail(t); setError(""); }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleSendOtp}
              error={error}
              editable={!isFromRegistration}
              leftIcon={<Ionicons name="mail-outline" size={18} color={COLORS.text.muted} />}
            />

            <Button
              label="Send OTP"
              variant="primary"
              size="lg"
              gradient
              isLoading={isLoading}
              onPress={handleSendOtp}
            />
          </View>
        ) : (
          <View style={{ gap: SPACING[4] }}>
            <OTPInput
              value={otp}
              onChange={(val) => { setOTP(val); setError(""); }}
              error={error}
              autoFocus
            />

            <Button
              label="Verify OTP"
              variant="primary"
              size="lg"
              gradient
              isLoading={isLoading}
              onPress={handleVerify}
            />

            <View style={{ alignItems: "center" }}>
              {canResend ? (
                <TouchableOpacity onPress={handleSendOtp}>
                  <Text style={{ fontSize: FONT_SIZE.sm, color: COLORS.brand[500], fontWeight: "600" }}>
                    Resend OTP
                  </Text>
                </TouchableOpacity>
              ) : (
                <Text style={{ fontSize: FONT_SIZE.sm, color: COLORS.text.muted }}>
                  Resend in{" "}
                  <Text style={{ color: COLORS.brand[500], fontWeight: "600" }}>
                    {formatTime(countdown)}
                  </Text>
                </Text>
              )}
            </View>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
