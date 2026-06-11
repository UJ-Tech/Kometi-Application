// src/app/(app)/committees/create.tsx
// Organiser Committee (Chit) Creation Screen

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Alert,
  Switch,
} from "react-native";
import { useRouter } from "expo-router";
import ScreenHeader from "../../../components/shared/ScreenHeader";
import Input from "../../../components/ui/Input";
import { AmountInput } from "../../../components/ui/AmountInput";
import Button from "../../../components/ui/Button";
import Card from "../../../components/ui/Card";
import { committeesApi } from "../../../services/committees.api";
import { useCommitteeStore } from "../../../stores/committee.store";
import { useAuthStore } from "../../../stores/auth.store";
import { canCreateCommittee } from "../../../utils/rbac";

export default function CreateCommittee() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { upsertCommittee } = useCommitteeStore();

  // Guard: Redirect if not allowed to create committees
  useEffect(() => {
    if (user && !canCreateCommittee(user.role)) {
      Alert.alert("Access Denied", "You do not have permission to create a committee.");
      router.replace("/dashboard");
    }
  }, [user]);

  const [isLoading, setIsLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    totalSlots: "12",
    installmentAmountPaise: 0n,
    cycleDurationDays: "30",
    includeOrganizerAsMember: false,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!form.name.trim()) newErrors.name = "Name is required";
    if (form.name.length < 3) newErrors.name = "Name must be at least 3 characters";
    if (form.installmentAmountPaise <= 0n) newErrors.installmentAmountPaise = "Amount must be greater than zero";
    
    const slots = parseInt(form.totalSlots);
    if (isNaN(slots) || slots < 2 || slots > 50) {
      newErrors.totalSlots = "Slots must be between 2 and 50";
    }

    const duration = parseInt(form.cycleDurationDays);
    if (isNaN(duration) || duration < 1) {
      newErrors.cycleDurationDays = "Duration must be at least 1 day";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCreate = async () => {
    if (!validate()) return;

    try {
      setIsLoading(true);
      const res = await committeesApi.create({
        name: form.name,
        description: form.description || undefined,
        totalSlots: parseInt(form.totalSlots),
        installmentAmountPaise: Number(form.installmentAmountPaise),
        cycleDurationDays: parseInt(form.cycleDurationDays),
        startDate: new Date().toISOString(),
        includeOrganizerAsMember: form.includeOrganizerAsMember,
      });

      if (res.data.success) {
        upsertCommittee(res.data.data);
        Alert.alert("Success", "Committee created successfully in DRAFT mode.");
        router.back();
      }
    } catch (err) {
      console.error("[CreateCommittee] failed:", err);
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to create committee");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-surface-950 px-4">
      <ScreenHeader
        title="Create New Chit"
        subtitle="Setup a new chit fund pool"
        showBack
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 60 }}
      >
        <Card style={{ marginBottom: 24 }}>
          <View className="p-5">
            <Input
              label="Chit Name"
              placeholder="e.g. Monthly Savings Group A"
              value={form.name}
              onChangeText={(val) => setForm({ ...form, name: val })}
              error={errors.name}
              required
            />

            <Input
              label="Description (Optional)"
              placeholder="Describe the purpose or rules..."
              value={form.description}
              onChangeText={(val) => setForm({ ...form, description: val })}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              containerStyle={{ marginTop: 16 }}
            />
          </View>
        </Card>

        <Text className="text-white font-bold text-base mb-3 ml-1">Chit Economics</Text>
        <Card style={{ marginBottom: 24 }}>
          <View className="p-5">
            <AmountInput
              label="Installment Per Slot"
              valuePaise={form.installmentAmountPaise}
              onChangePaise={(val) => setForm({ ...form, installmentAmountPaise: val })}
              error={errors.installmentAmountPaise}
            />

            <View className="flex-row gap-4 mt-2">
              <View className="flex-1">
                <Input
                  label="Total Slots (Members)"
                  keyboardType="number-pad"
                  value={form.totalSlots}
                  onChangeText={(val) => setForm({ ...form, totalSlots: val })}
                  error={errors.totalSlots}
                  required
                />
              </View>
              <View className="flex-1">
                <Input
                  label="Cycle (Days)"
                  keyboardType="number-pad"
                  value={form.cycleDurationDays}
                  onChangeText={(val) => setForm({ ...form, cycleDurationDays: val })}
                  error={errors.cycleDurationDays}
                  hint="e.g. 30 for Monthly"
                  required
                />
              </View>
            </View>

            <View className="mt-4 bg-brand-500/5 p-3 rounded-lg border border-brand-500/10">
              <View className="flex-row justify-between items-center">
                <Text className="text-neutral-400 text-xs font-semibold">Total Pot Value</Text>
                <Text className="text-gold-500 font-bold">
                  {new Intl.NumberFormat("en-IN", {
                    style: "currency",
                    currency: "INR",
                    maximumFractionDigits: 0,
                  }).format((Number(form.installmentAmountPaise) * parseInt(form.totalSlots || "0")) / 100)}
                </Text>
              </View>
            </View>
          </View>
        </Card>

        <Text className="text-white font-bold text-base mb-3 ml-1">Organizer Membership</Text>
        <Card style={{ marginBottom: 24 }}>
          <View className="p-5">
            <View className="flex-row items-center justify-between">
              <View className="flex-1 mr-4">
                <Text className="text-white font-semibold text-sm">Join as Member</Text>
                <Text className="text-neutral-500 text-[11px] mt-1">
                  Include yourself as slot #1 in this chit. You will pay installments and be eligible for payouts.
                </Text>
              </View>
              <Switch
                value={form.includeOrganizerAsMember}
                onValueChange={(val) => setForm({ ...form, includeOrganizerAsMember: val })}
                trackColor={{ false: "#3f3f46", true: "#d4a853" }}
                thumbColor={form.includeOrganizerAsMember ? "#fff" : "#a1a1aa"}
              />
            </View>
            {form.includeOrganizerAsMember && (
              <View className="mt-3 bg-brand-500/5 p-3 rounded-lg border border-brand-500/10">
                <Text className="text-neutral-400 text-xs">
                  You will be added as slot #1. Filled slots: 1/{form.totalSlots || "0"} (remaining: {Math.max(0, parseInt(form.totalSlots || "0") - 1)})
                </Text>
              </View>
            )}
          </View>
        </Card>

        <View style={{ marginTop: 24 }}>
          <Button
            label="Create Committee"
            onPress={handleCreate}
            isLoading={isLoading}
            variant="primary"
            size="lg"
          />
        </View>
      </ScrollView>
    </View>
  );
}
