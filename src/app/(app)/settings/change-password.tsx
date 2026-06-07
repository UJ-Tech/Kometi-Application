// src/app/(app)/settings/change-password.tsx
import React, { useState } from "react";
import { View, Text, ScrollView, Alert, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../../constants/theme";
import ScreenHeader from "../../../components/shared/ScreenHeader";
import Input from "../../../components/ui/Input";
import Button from "../../../components/ui/Button";
import Card from "../../../components/ui/Card";
import { authApi } from "../../../services/auth.api";

export default function ChangePassword() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [form, setForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!form.currentPassword) newErrors.currentPassword = "Current password is required";
    if (!form.newPassword) newErrors.newPassword = "New password is required";
    if (form.newPassword.length < 8) newErrors.newPassword = "Must be at least 8 characters";
    if (form.newPassword !== form.confirmPassword) newErrors.confirmPassword = "Passwords do not match";
    if (form.currentPassword === form.newPassword) newErrors.newPassword = "New password must be different";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChangePassword = async () => {
    if (!validate()) return;

    try {
      setIsLoading(true);
      await authApi.changePassword({
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      Alert.alert("Success", "Password changed successfully", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to change password");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Change Password"
        subtitle="Update your account password"
        showBack
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Card style={{ marginBottom: 20 }}>
          <View style={styles.cardContent}>
            <Ionicons name="lock-closed-outline" size={24} color={COLORS.brandPrimary} />
            <Text style={styles.securityNote}>
              For your security, please enter your current password before setting a new one.
            </Text>
          </View>
        </Card>

        <Input
          label="Current Password"
          placeholder="Enter current password"
          value={form.currentPassword}
          onChangeText={(val) => setForm({ ...form, currentPassword: val })}
          error={errors.currentPassword}
          secureTextEntry
          required
        />

        <Input
          label="New Password"
          placeholder="Enter new password"
          value={form.newPassword}
          onChangeText={(val) => setForm({ ...form, newPassword: val })}
          error={errors.newPassword}
          secureTextEntry
          containerStyle={{ marginTop: 16 }}
          required
        />

        <Input
          label="Confirm New Password"
          placeholder="Re-enter new password"
          value={form.confirmPassword}
          onChangeText={(val) => setForm({ ...form, confirmPassword: val })}
          error={errors.confirmPassword}
          secureTextEntry
          containerStyle={{ marginTop: 16 }}
          required
        />

        <Button
          label="Update Password"
          onPress={handleChangePassword}
          isLoading={isLoading}
          variant="primary"
          size="lg"
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surface.bg,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  cardContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
  },
  securityNote: {
    flex: 1,
    fontSize: 13,
    color: COLORS.text.secondary,
    lineHeight: 18,
  },
});
