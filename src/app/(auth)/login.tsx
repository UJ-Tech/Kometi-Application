import React, { useState } from "react";
import { View, Text, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Input from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import ScreenHeader from "../../components/shared/ScreenHeader";
import KKMark from "../../components/brand/KKMark";
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
          { flexGrow: 1, paddingHorizontal: SPACING[5] },
          { paddingBottom: insets.bottom + SPACING[6] },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        {/* Brand Header */}
        <View style={{ alignItems: "center", paddingTop: SPACING[4], paddingBottom: SPACING[6] }}>
          <View style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            backgroundColor: "rgba(79, 70, 229, 0.08)",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: SPACING[3],
          }}>
            <KKMark size={32} color={COLORS.brand[500]} />
          </View>
          <Text style={{
            fontSize: FONT_SIZE["2xl"],
            fontWeight: "800",
            color: COLORS.text.primary,
            textAlign: "center",
          }}>
            Welcome back
          </Text>
          <Text style={{
            fontSize: FONT_SIZE.base,
            color: COLORS.text.secondary,
            textAlign: "center",
            marginTop: SPACING[1],
          }}>
            Sign in to your Monio account
          </Text>
        </View>

        {/* Form */}
        <View style={{
          backgroundColor: COLORS.surface.card,
          borderRadius: BORDER_RADIUS["2xl"],
          padding: SPACING[5],
          gap: SPACING[4],
          borderWidth: 1,
          borderColor: COLORS.surface.border,
          shadowColor: COLORS.brand[500],
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.05,
          shadowRadius: 12,
          elevation: 3,
        }}>
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
            <Text style={{ fontSize: FONT_SIZE.sm, color: COLORS.danger.light, lineHeight: 20 }}>
              {errors.form}
            </Text>
          ) : null}

          <Button
            label="Sign In"
            variant="primary"
            size="lg"
            gradient
            isLoading={isLoading}
            onPress={handleLogin}
          />

          <Button
            label="Create Account"
            variant="secondary"
            size="md"
            onPress={() => router.push("/(auth)/register")}
          />
        </View>

        {/* Trust Indicators */}
        <View style={{
          flexDirection: "row",
          gap: SPACING[5],
          justifyContent: "center",
          paddingTop: SPACING[6],
        }}>
          {[
            { icon: "shield-checkmark-outline", label: "256-bit Encrypted" },
            { icon: "lock-closed-outline",      label: "RBI Compliant" },
          ].map(({ icon, label }) => (
            <View key={label} style={{ flexDirection: "row", alignItems: "center", gap: SPACING[1.5] }}>
              <Ionicons name={icon as any} size={14} color={COLORS.brand[400]} />
              <Text style={{ fontSize: FONT_SIZE.xs, color: COLORS.text.muted, fontWeight: "500" }}>
                {label}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
