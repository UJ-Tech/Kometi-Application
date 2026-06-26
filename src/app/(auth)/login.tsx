// src/app/(auth)/login.tsx
// Email, phone, and password sign in.

import React, { useState } from "react";
import { View, Text, KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Input from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import ScreenHeader from "../../components/shared/ScreenHeader";
import { authApi } from "../../services/auth.api";
import { useAuthStore } from "../../stores/auth.store";
import { tokenStorage } from "../../utils/storage";
import { isValidEmail, isValidPhone } from "../../utils/validators";
import { COLORS, FONT_SIZE, SPACING, BORDER_RADIUS } from "../../constants/theme";

export default function LoginScreen() {
  const router         = useRouter();
  const insets         = useSafeAreaInsets();
  const setUser        = useAuthStore((s) => s.setUser);
  const setAccessToken = useAuthStore((s) => s.setAccessToken);

  const [email,     setEmail]     = useState("");
  const [phone,     setPhone]     = useState("");
  const [password,  setPassword]  = useState("");
  const [errors,    setErrors]    = useState<{ email?: string; phone?: string; password?: string; form?: string }>({});
  const [isLoading, setIsLoading] = useState(false);

  const validate = () => {
    const nextErrors: typeof errors = {};
    if (!isValidEmail(email)) nextErrors.email = "Enter a valid email address";
    if (!isValidPhone(phone.trim().replace(/\s/g, ""))) {
      nextErrors.phone = "Enter a valid 10-digit Indian mobile number";
    }
    if (password.length < 8) nextErrors.password = "Password must be at least 8 characters";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    setIsLoading(true);
    try {
      const res = await authApi.login({
        email: email.trim().toLowerCase(),
        phone: phone.trim().replace(/\s/g, ""),
        password,
      });
      const { accessToken, refreshToken, user } = res.data.data;
      await Promise.all([
        tokenStorage.saveAccessToken(accessToken),
        tokenStorage.saveRefreshToken(refreshToken),
        tokenStorage.saveUser(user),
      ]);
      setAccessToken(accessToken);
      setUser(user);
      router.replace("/(auth)/mpin-enter");
    } catch (e: any) {
      setErrors({ form: e.message ?? "Login failed. Check your details and try again." });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: COLORS.surface.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScreenHeader title="Sign In" showBack />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + SPACING[6] },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        <View style={styles.topSection}>
          <View style={styles.iconCircle}>
            <Ionicons name="phone-portrait-outline" size={28} color={COLORS.brand[500]} />
          </View>

          <Text style={styles.title}>Sign in to{"\n"}your account</Text>
          <Text style={styles.subtitle}>
            Use your registered email, mobile number, and password.
          </Text>
        </View>

        <View style={styles.formCard}>
          <Input
            label="Email"
            required
            placeholder="rahul@example.com"
            value={email}
            onChangeText={(t) => { setEmail(t); setErrors((e) => ({ ...e, email: undefined, form: undefined })); }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
            error={errors.email}
            leftIcon={<Ionicons name="mail-outline" size={18} color={COLORS.text.muted} />}
          />

          <Input
            label="Mobile Number"
            required
            placeholder="9876543210"
            value={phone}
            onChangeText={(t) => { setPhone(t); setErrors((e) => ({ ...e, phone: undefined, form: undefined })); }}
            keyboardType="phone-pad"
            maxLength={10}
            returnKeyType="next"
            error={errors.phone}
            leftIcon={
              <Text style={{ fontSize: FONT_SIZE.base, color: COLORS.text.secondary, fontWeight: "600" }}>
                +91
              </Text>
            }
          />

          <Input
            label="Password"
            required
            placeholder="Enter password"
            value={password}
            onChangeText={(t) => { setPassword(t); setErrors((e) => ({ ...e, password: undefined, form: undefined })); }}
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={handleLogin}
            error={errors.password}
            leftIcon={<Ionicons name="lock-closed-outline" size={18} color={COLORS.text.muted} />}
          />

          {errors.form ? (
            <Text style={styles.formError}>{errors.form}</Text>
          ) : null}

          <View style={{ marginTop: SPACING[2] }}>
            <Button
              label="Sign In"
              variant="primary"
              size="lg"
              isLoading={isLoading}
              onPress={handleLogin}
            />
          </View>

          <Button
            label="Create Account"
            variant="secondary"
            size="md"
            onPress={() => router.push("/(auth)/register")}
          />
        </View>

        <View style={styles.trustRow}>
          {[
            { icon: "shield-checkmark-outline", label: "256-bit Encrypted" },
            { icon: "lock-closed-outline",      label: "RBI Compliant" },
          ].map(({ icon, label }) => (
            <View key={label} style={styles.trustItem}>
              <Ionicons name={icon as any} size={14} color={COLORS.brand[400]} />
              <Text style={styles.trustText}>{label}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1, paddingHorizontal: SPACING[6], gap: SPACING[6],
  },
  topSection: { gap: SPACING[2.5], paddingTop: SPACING[2] },
  iconCircle: {
    width: 56, height: 56, borderRadius: 14,
    alignItems: "center", justifyContent: "center", marginBottom: SPACING[1],
    backgroundColor: COLORS.surface.card,
    borderWidth: 1,
    borderColor: COLORS.surface.border,
  },
  title: {
    fontSize: FONT_SIZE["3xl"], fontWeight: "700",
    color: COLORS.text.primary, lineHeight: 36,
  },
  subtitle: {
    fontSize: FONT_SIZE.base, color: COLORS.text.secondary, lineHeight: 22,
  },
  formCard: {
    backgroundColor: COLORS.surface.card,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.surface.border,
    padding: SPACING[5],
    gap: SPACING[4.5],
  },
  formError: { fontSize: FONT_SIZE.sm, color: COLORS.danger.light, lineHeight: 20 },
  trustRow: {
    flexDirection: "row", gap: SPACING[5], justifyContent: "center",
    paddingTop: SPACING[1],
  },
  trustItem: { flexDirection: "row", alignItems: "center", gap: SPACING[1.5] },
  trustText:  { fontSize: FONT_SIZE.xs, color: COLORS.text.muted, fontWeight: "500" },
});
