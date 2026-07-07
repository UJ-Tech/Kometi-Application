import React, { useState } from "react";
import { View, Text, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import OTPInput from "../../components/ui/OTPInput";
import Button from "../../components/ui/Button";
import ScreenHeader from "../../components/shared/ScreenHeader";
import KKMark from "../../components/brand/KKMark";
import { authApi } from "../../services/auth.api";
import { isValidMPIN } from "../../utils/validators";
import { COLORS, FONT_SIZE, SPACING, BORDER_RADIUS } from "../../constants/theme";

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
      router.replace("/(app)/dashboard");
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

      <ScrollView contentContainerStyle={[{ flexGrow: 1, paddingHorizontal: SPACING[6], gap: SPACING[8], paddingTop: SPACING[4] }, { paddingBottom: insets.bottom + SPACING[8] }]}>
        <View style={{ alignItems: "center", gap: SPACING[3] }}>
          <LinearGradient
            colors={["rgba(79, 70, 229, 0.1)", "rgba(79, 70, 229, 0.04)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
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
            <Ionicons name={isSetStep ? "keypad-outline" : "shield-checkmark-outline"} size={32} color={COLORS.brand[500]} />
          </LinearGradient>
          <View style={{ alignItems: "center", gap: SPACING[1] }}>
            <Text style={{ fontSize: FONT_SIZE["2xl"], fontWeight: "800", color: COLORS.text.primary, textAlign: "center" }}>
              {isSetStep ? "Create your security PIN" : "Confirm your PIN"}
            </Text>
            <Text style={{ fontSize: FONT_SIZE.base, color: COLORS.text.secondary, textAlign: "center", lineHeight: 22 }}>
              {isSetStep
                ? "Your 6-digit MPIN protects fund transfers and sensitive actions."
                : "Enter the same PIN again to confirm."}
            </Text>
          </View>
        </View>

        <OTPInput
          key={step}
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

        {isSetStep && (
          <View style={{
            backgroundColor: "rgba(79, 70, 229, 0.06)",
            borderRadius: BORDER_RADIUS.lg,
            padding: SPACING[4],
            gap: SPACING[2],
            borderWidth: 1,
            borderColor: "rgba(79, 70, 229, 0.1)",
          }}>
            {["Must be 6 digits", "Cannot be sequential (e.g. 123456)", "Cannot be all same (e.g. 111111)"].map((r) => (
              <View key={r} style={{ flexDirection: "row", alignItems: "center", gap: SPACING[2] }}>
                <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: COLORS.brand[400] }} />
                <Text style={{ fontSize: FONT_SIZE.sm, color: COLORS.text.secondary }}>{r}</Text>
              </View>
            ))}
          </View>
        )}

        <Button
          label={isSetStep ? "Continue" : "Set MPIN"}
          variant="primary"
          size="lg"
          gradient
          isLoading={isLoading}
          onPress={isSetStep ? handleNext : handleSetMPIN}
          disabled={isSetStep ? mpin.length < 6 : confirm.length < 6}
        />
      </ScrollView>
    </View>
  );
}
