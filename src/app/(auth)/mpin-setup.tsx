// src/app/(auth)/mpin-setup.tsx
// Set a 6-digit MPIN — with confirm step and strength validation

import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import OTPInput from "../../components/ui/OTPInput";
import Button from "../../components/ui/Button";
import ScreenHeader from "../../components/shared/ScreenHeader";
import { authApi } from "../../services/auth.api";
import { isValidMPIN } from "../../utils/validators";
import { COLORS, FONT_SIZE, SPACING, GRADIENTS } from "../../constants/theme";

type Step = "set" | "confirm";

export default function MPINSetupScreen() {
  const router   = useRouter();
  const insets   = useSafeAreaInsets();
  const [step,      setStep]      = useState<Step>("set");
  const [mpin,      setMPIN]      = useState("");
  const [confirm,   setConfirm]   = useState("");
  const [error,     setError]     = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleNext = () => {
    setError("");
    if (!isValidMPIN(mpin)) {
      setError("MPIN cannot be sequential or all same digits");
      return;
    }
    setStep("confirm");
  };

  const handleSetMPIN = async () => {
    if (confirm !== mpin) {
      setError("PINs don't match. Please try again.");
      setConfirm("");
      return;
    }
    setIsLoading(true);
    try {
      await authApi.setMPIN({ mpin });
      router.replace("/(auth)/role-select" as any);
    } catch (e: any) {
      setError(e.message ?? "Failed to set MPIN");
    } finally {
      setIsLoading(false);
    }
  };

  const isSetStep = step === "set";

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.surface.bg }}>
      <ScreenHeader
        title={isSetStep ? "Set MPIN" : "Confirm MPIN"}
        showBack
        onBack={isSetStep ? undefined : () => { setStep("set"); setConfirm(""); setError(""); }}
      />
      <LinearGradient colors={["rgba(111,94,255,0.18)", "transparent"]} style={styles.blob} />

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING[8] }]}>
        <View style={styles.top}>
          <View style={styles.iconCircle}>
            <LinearGradient colors={GRADIENTS.brandPrimary as [string, string]} style={StyleSheet.absoluteFill} />
            <Ionicons name={isSetStep ? "keypad-outline" : "shield-checkmark-outline"} size={28} color="#fff" />
          </View>
          <Text style={styles.title}>
            {isSetStep ? "Create your\nsecurity PIN" : "Confirm your\nPIN"}
          </Text>
          <Text style={styles.subtitle}>
            {isSetStep
              ? "Your 6-digit MPIN protects fund transfers and sensitive actions."
              : "Enter the same PIN again to confirm."}
          </Text>
        </View>

        <OTPInput
          key={step}  // remount on step change to clear focus
          value={isSetStep ? mpin : confirm}
          onChange={(val) => {
            setError("");
            if (isSetStep) {
              setMPIN(val);
            } else {
              setConfirm(val);
            }
          }}
          error={error}
        />

        {/* Rules */}
        {isSetStep && (
          <View style={styles.rulesBox}>
            {["Must be 6 digits", "Cannot be sequential (e.g. 123456)", "Cannot be all same (e.g. 111111)"].map((r) => (
              <View key={r} style={styles.ruleRow}>
                <Ionicons name="ellipse" size={5} color={COLORS.brand[400]} />
                <Text style={styles.ruleText}>{r}</Text>
              </View>
            ))}
          </View>
        )}

        <Button
          label={isSetStep ? "Continue" : "Set MPIN"}
          variant="primary"
          size="lg"
          isLoading={isLoading}
          onPress={isSetStep ? handleNext : handleSetMPIN}
          disabled={isSetStep ? mpin.length < 6 : confirm.length < 6}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  blob:   { position: "absolute", top: -40, left: -60, width: 220, height: 220, borderRadius: 110 },
  content:{ flexGrow: 1, paddingHorizontal: SPACING[6], gap: SPACING[8], paddingTop: SPACING[4] },
  top:    { gap: SPACING[3] },
  iconCircle: {
    width: 64, height: 64, borderRadius: 20, overflow: "hidden",
    alignItems: "center", justifyContent: "center", marginBottom: SPACING[2],
  },
  title:   { fontSize: FONT_SIZE["3xl"], fontWeight: "800", color: COLORS.text.primary, lineHeight: 36 },
  subtitle:{ fontSize: FONT_SIZE.base, color: COLORS.text.secondary, lineHeight: 22 },
  rulesBox:{ backgroundColor: "rgba(111,94,255,0.08)", borderRadius: 12, padding: SPACING[4], gap: SPACING[2] },
  ruleRow: { flexDirection: "row", alignItems: "center", gap: SPACING[2] },
  ruleText:{ fontSize: FONT_SIZE.sm, color: COLORS.text.secondary },
});
