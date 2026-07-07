import React, { useState, useRef } from "react";
import {
  View, Text, ScrollView, TextInput, KeyboardAvoidingView, Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Button from "../../components/ui/Button";
import ScreenHeader from "../../components/shared/ScreenHeader";
import { committeesApi } from "../../services/committees.api";
import { COLORS, FONT_SIZE, SPACING, BORDER_RADIUS } from "../../constants/theme";

const CODE_LENGTH = 8;

export default function JoinCommitteeScreen() {
  const router   = useRouter();
  const insets   = useSafeAreaInsets();
  const inputsRef = useRef<(TextInput | null)[]>([]);

  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const digits = code.padEnd(CODE_LENGTH, "").slice(0, CODE_LENGTH).split("");

  const handleCharChange = (text: string, index: number) => {
    const cleaned = text.toUpperCase().replace(/[^A-Z0-9]/g, "");

    if (cleaned.length > 1) {
      const newCode = cleaned.slice(0, CODE_LENGTH);
      setCode(newCode);
      setError("");
      inputsRef.current[Math.min(newCode.length - 1, CODE_LENGTH - 1)]?.focus();
      return;
    }

    const arr    = [...digits];
    arr[index]   = cleaned;
    const newCode = arr.join("").replace(/ /g, "");
    setCode(newCode);
    setError("");

    if (cleaned && index < CODE_LENGTH - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === "Backspace") {
      if (!digits[index] && index > 0) {
        const arr  = [...digits];
        arr[index - 1] = "";
        setCode(arr.join("").replace(/ /g, ""));
        inputsRef.current[index - 1]?.focus();
      }
    }
  };

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
        contentContainerStyle={[{ flexGrow: 1, paddingHorizontal: SPACING[6], gap: SPACING[6], paddingTop: SPACING[4] }, { paddingBottom: insets.bottom + SPACING[8] }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ gap: SPACING[3] }}>
          <View style={{
            width: 64,
            height: 64,
            borderRadius: 20,
            backgroundColor: "rgba(245,158,11,0.08)",
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: "rgba(245,158,11,0.15)",
          }}>
            <Ionicons name="key-outline" size={30} color={COLORS.gold[500]} />
          </View>
          <Text style={{ fontSize: FONT_SIZE["2xl"], fontWeight: "800", color: COLORS.text.primary, lineHeight: 32 }}>
            Enter Invite Code
          </Text>
          <Text style={{ fontSize: FONT_SIZE.base, color: COLORS.text.secondary, lineHeight: 22 }}>
            Ask your committee organizer for the 8-character invite code.
          </Text>
        </View>

        {/* Code Input */}
        <View style={{ alignItems: "center" }}>
          <View style={{ flexDirection: "row", gap: 6, justifyContent: "center" }}>
            {Array.from({ length: CODE_LENGTH }).map((_, i) => {
              const filled = !!digits[i] && digits[i] !== " ";
              const borderColor = error
                ? COLORS.danger.DEFAULT
                : filled
                ? COLORS.brand[500]
                : COLORS.surface.border;

              return (
                <TextInput
                  key={i}
                  ref={(r) => { inputsRef.current[i] = r; }}
                  value={digits[i] === " " ? "" : digits[i]}
                  onChangeText={(t) => handleCharChange(t, i)}
                  onKeyPress={(e) => handleKeyPress(e, i)}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={2}
                  selectTextOnFocus
                  autoFocus={i === 0}
                  style={{
                    width: 40,
                    height: 54,
                    borderRadius: BORDER_RADIUS.lg,
                    borderWidth: 2,
                    borderColor,
                    backgroundColor: COLORS.surface.card,
                    textAlign: "center",
                    fontSize: FONT_SIZE.xl,
                    fontWeight: "700",
                    color: COLORS.brand[600],
                    shadowColor: filled ? COLORS.brand[500] : "transparent",
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.2,
                    shadowRadius: 4,
                    elevation: filled ? 2 : 0,
                  }}
                />
              );
            })}
          </View>
          <Text style={{
            fontSize: FONT_SIZE.xs,
            color: COLORS.text.muted,
            marginTop: SPACING[2],
          }}>
            {code.length}/{CODE_LENGTH}
          </Text>
        </View>

        {error ? (
          <Text style={{ fontSize: FONT_SIZE.sm, color: COLORS.danger.light, textAlign: "center" }}>{error}</Text>
        ) : null}

        {/* Info */}
        <View style={{
          flexDirection: "row",
          gap: SPACING[2],
          backgroundColor: "rgba(79, 70, 229, 0.06)",
          borderRadius: BORDER_RADIUS.lg,
          padding: SPACING[4],
          alignItems: "flex-start",
          borderWidth: 1,
          borderColor: "rgba(79, 70, 229, 0.1)",
        }}>
          <Ionicons name="information-circle-outline" size={18} color={COLORS.brand[400]} />
          <Text style={{ flex: 1, fontSize: FONT_SIZE.sm, color: COLORS.text.secondary, lineHeight: 20 }}>
            The invite code is provided by your committee organizer. It is unique to each committee.
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
