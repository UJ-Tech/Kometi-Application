import React, { useState } from "react";
import { View, Text, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Input from "../../../components/ui/Input";
import Button from "../../../components/ui/Button";
import ScreenHeader from "../../../components/shared/ScreenHeader";
import { authApi } from "../../../services/auth.api";
import { useAuthStore } from "../../../stores/auth.store";
import { COLORS, FONT_SIZE, SPACING, BORDER_RADIUS } from "../../../constants/theme";
import { useAlertModal } from "../../../components/ui/AlertModal";

export default function ChangePasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const { alert, AlertComponent } = useAlertModal();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<{ current?: string; new?: string; confirm?: string; form?: string }>({});
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    const e: typeof errors = {};
    if (!currentPassword) e.current = "Enter your current password";
    if (newPassword.length < 8) e.new = "New password must be at least 8 characters";
    if (confirmPassword !== newPassword) e.confirm = "Passwords do not match";
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    setIsLoading(true);
    try {
      await authApi.changePassword({ currentPassword, newPassword });
      await alert("Success", "Password changed successfully!");
      router.back();
    } catch (err: any) {
      setErrors({ form: err.message || "Failed to change password" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: COLORS.surface.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScreenHeader title="Change Password" showBack />

      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: SPACING[5], paddingBottom: insets.bottom + 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="items-center py-6">
          <View className="w-16 h-16 rounded-2xl items-center justify-center mb-4"
            style={{ backgroundColor: "rgba(99,102,241,0.08)" }}
          >
            <Ionicons name="lock-closed-outline" size={28} color={COLORS.brand[500]} />
          </View>
          <Text className="text-xl font-bold text-slate-900 mb-1">Update Password</Text>
          <Text className="text-sm text-slate-500 text-center">
            Enter your current password and a new one.
          </Text>
        </View>

        <View className="bg-white rounded-2xl p-5 border border-slate-100 gap-4"
          style={{
            shadowColor: COLORS.brand[500],
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.05,
            shadowRadius: 12,
            elevation: 3,
          }}
        >
          <Input
            label="Current Password"
            required
            placeholder="Enter current password"
            value={currentPassword}
            onChangeText={(t) => { setCurrentPassword(t); setErrors({}); }}
            secureTextEntry
            leftIcon={<Ionicons name="lock-closed-outline" size={18} color={COLORS.text.muted} />}
            error={errors.current}
          />
          <Input
            label="New Password"
            required
            placeholder="At least 8 characters"
            value={newPassword}
            onChangeText={(t) => { setNewPassword(t); setErrors({}); }}
            secureTextEntry
            leftIcon={<Ionicons name="key-outline" size={18} color={COLORS.text.muted} />}
            error={errors.new}
          />
          <Input
            label="Confirm New Password"
            required
            placeholder="Re-enter new password"
            value={confirmPassword}
            onChangeText={(t) => { setConfirmPassword(t); setErrors({}); }}
            secureTextEntry
            leftIcon={<Ionicons name="shield-checkmark-outline" size={18} color={COLORS.text.muted} />}
            error={errors.confirm}
          />

          {errors.form && (
            <Text className="text-red-500 text-sm">{errors.form}</Text>
          )}

          <Button
            label="Update Password"
            variant="primary"
            size="lg"
            gradient
            isLoading={isLoading}
            onPress={handleSubmit}
          />
        </View>
      </ScrollView>
      <AlertComponent />
    </KeyboardAvoidingView>
  );
}
