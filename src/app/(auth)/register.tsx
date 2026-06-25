// src/app/(auth)/register.tsx
// New user registration with required account details.

import React, { useState } from "react";
import {
  View, Text, KeyboardAvoidingView, Platform, ScrollView, StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Input from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import ScreenHeader from "../../components/shared/ScreenHeader";
import { authApi } from "../../services/auth.api";
import { useAuthStore } from "../../stores/auth.store";
import { tokenStorage } from "../../utils/storage";
import { isValidName, isValidEmail, isValidPhone } from "../../utils/validators";
import { COLORS, FONT_SIZE, SPACING, BORDER_RADIUS } from "../../constants/theme";

export default function RegisterScreen() {
  const router         = useRouter();
  const insets         = useSafeAreaInsets();
  const setUser        = useAuthStore((s) => s.setUser);
  const setAccessToken = useAuthStore((s) => s.setAccessToken);

  const [name,      setName]      = useState("");
  const [email,     setEmail]     = useState("");
  const [phone,     setPhone]     = useState("");
  const [password,  setPassword]  = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors,    setErrors]    = useState<{
    name?: string;
    email?: string;
    phone?: string;
    password?: string;
    confirmPassword?: string;
    form?: string;
  }>({});
  const [isLoading, setIsLoading] = useState(false);

  const validate = () => {
    const e: typeof errors = {};
    if (!isValidName(name)) e.name = "Enter your full name (2-60 characters)";
    if (!isValidEmail(email)) e.email = "Enter a valid email address";
    if (!isValidPhone(phone.trim().replace(/\s/g, ""))) {
      e.phone = "Enter a valid 10-digit Indian mobile number";
    }
    if (password.length < 8) e.password = "Password must be at least 8 characters";
    if (confirmPassword !== password) e.confirmPassword = "Passwords do not match";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleRegister = async () => {
    if (!validate()) return;
    setIsLoading(true);
    try {
      const res = await authApi.register({
        phone: phone.trim().replace(/\s/g, ""),
        name:  name.trim(),
        email: email.trim().toLowerCase(),
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
      router.replace("/(auth)/mpin-setup");
    } catch (e: any) {
      setErrors({ form: e.message ?? "Registration failed. Try again." });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: COLORS.surface.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScreenHeader title="Create Account" showBack />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING[6] }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.top}>
          <View style={styles.iconCircle}>
            <Ionicons name="person-outline" size={28} color={COLORS.brand[400]} />
          </View>
          <Text style={styles.title}>Tell us about{"\n"}yourself</Text>
          <Text style={styles.subtitle}>
            Create your account with the details required for login.
          </Text>
        </View>

        <View style={styles.formCard}>
          <Input
            label="Full Name"
            required
            placeholder="Rahul Kumar Sharma"
            value={name}
            onChangeText={(t) => { setName(t); setErrors((e) => ({ ...e, name: undefined, form: undefined })); }}
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="next"
            error={errors.name}
            leftIcon={<Ionicons name="person-outline" size={18} color={COLORS.text.muted} />}
          />

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
            placeholder="Create password"
            value={password}
            onChangeText={(t) => { setPassword(t); setErrors((e) => ({ ...e, password: undefined, confirmPassword: undefined, form: undefined })); }}
            secureTextEntry
            returnKeyType="next"
            error={errors.password}
            leftIcon={<Ionicons name="lock-closed-outline" size={18} color={COLORS.text.muted} />}
          />

          <Input
            label="Confirm Password"
            required
            placeholder="Re-enter password"
            value={confirmPassword}
            onChangeText={(t) => { setConfirmPassword(t); setErrors((e) => ({ ...e, confirmPassword: undefined, form: undefined })); }}
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={handleRegister}
            error={errors.confirmPassword}
            leftIcon={<Ionicons name="shield-checkmark-outline" size={18} color={COLORS.text.muted} />}
          />

          {errors.form ? (
            <Text style={styles.formError}>{errors.form}</Text>
          ) : null}

          <View style={{ marginTop: SPACING[2] }}>
            <Button
              label="Create Account"
              variant="primary"
              size="lg"
              isLoading={isLoading}
              onPress={handleRegister}
            />
          </View>

          <Button
            label="Back to Sign In"
            variant="ghost"
            size="md"
            onPress={() => router.replace("/(auth)/login")}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingHorizontal: SPACING[6], gap: SPACING[5] },
  top:     { gap: SPACING[2.5], paddingTop: SPACING[2] },
  iconCircle: {
    width: 60, height: 60, borderRadius: 18,
    alignItems: "center", justifyContent: "center", marginBottom: SPACING[1],
    backgroundColor: COLORS.surface.card,
    borderWidth: 1,
    borderColor: COLORS.surface.border,
    shadowColor: COLORS.brand[500],
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
  },
  title:    { fontSize: FONT_SIZE["3xl"], fontWeight: "800", color: COLORS.text.primary, lineHeight: 36 },
  subtitle: { fontSize: FONT_SIZE.base, color: COLORS.text.secondary, lineHeight: 22 },
  formCard: {
    backgroundColor: COLORS.surface.card,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.surface.border,
    padding: SPACING[5],
    gap: SPACING[4.5],
    shadowColor: COLORS.brand[500],
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 4,
  },
  formError:{ fontSize: FONT_SIZE.sm, color: COLORS.danger.light, lineHeight: 20 },
});
