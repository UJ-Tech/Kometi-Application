import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import ScreenHeader from "../../../components/shared/ScreenHeader";
import Input from "../../../components/ui/Input";
import { AmountInput } from "../../../components/ui/AmountInput";
import Button from "../../../components/ui/Button";
import Card from "../../../components/ui/Card";
import { committeesApi } from "../../../services/committees.api";
import { useCommitteeStore } from "../../../stores/committee.store";
import { useAlertModal } from "../../../components/ui/AlertModal";
import { COLORS, SHADOWS } from "../../../constants/theme";
import { Ionicons } from "@expo/vector-icons";

export default function CreateCommittee() {
  const router = useRouter();
  const { alert, confirm, AlertComponent } = useAlertModal();
  const { upsertCommittee } = useCommitteeStore();

  const [isLoading, setIsLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    totalSlots: "12",
    installmentAmountPaise: 0n,
    cycleDurationDays: "30",
  });

  const validate = async (): Promise<boolean> => {
    const missing: string[] = [];
    if (!form.name.trim()) missing.push("Chit name is required");
    else if (form.name.length < 3) missing.push("Chit name must be at least 3 characters");
    if (form.installmentAmountPaise <= 0n) missing.push("Installment per slot amount is required");

    const slots = parseInt(form.totalSlots);
    if (isNaN(slots) || slots < 2 || slots > 50) missing.push("Total slots must be between 2 and 50");

    const duration = parseInt(form.cycleDurationDays);
    if (isNaN(duration) || duration < 1) missing.push("Cycle duration must be at least 1 day");

    if (missing.length > 0) {
      await alert("Missing Fields", missing.join("\n"));
      return false;
    }
    return true;
  };

  const handleCreate = async () => {
    if (!(await validate())) return;

    try {
      setIsLoading(true);
      const res = await committeesApi.create({
        name: form.name,
        description: form.description || undefined,
        totalSlots: parseInt(form.totalSlots),
        installmentAmountPaise: Number(form.installmentAmountPaise),
        cycleDurationDays: parseInt(form.cycleDurationDays),
        startDate: new Date().toISOString(),
        includeOrganizerAsMember: true,
      });

      if (res.data.success) {
        upsertCommittee(res.data.data);
        await alert("Success", "Committee created successfully in DRAFT mode.");
        router.back();
      }
    } catch (err) {
      console.error("[CreateCommittee] failed:", err);
      await alert("Error", err instanceof Error ? err.message : "Failed to create committee");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View className="flex-1 px-4" style={{ backgroundColor: COLORS.surface.bg }}>
      <ScreenHeader
        title="Create New Chit"
        subtitle="Setup a new chit fund pool"
        showBack
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        <Card accent="brand" style={{ marginBottom: 24 }}>
          <View className="p-5">
            <Input
              label="Chit Name"
              placeholder="e.g. Monthly Savings Group A"
              value={form.name}
              onChangeText={(val) => setForm({ ...form, name: val })}
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

        <View className="flex-row items-center gap-2 mb-3 ml-1">
          <View className="w-1 h-5 rounded-full" style={{ backgroundColor: COLORS.gold[500] }} />
          <Text className="text-slate-800 text-base font-bold">Chit Economics</Text>
        </View>
        <Card accent="gold" style={{ marginBottom: 24 }}>
          <View className="p-5">
            <AmountInput
              label="Installment Per Slot"
              valuePaise={form.installmentAmountPaise}
              onChangePaise={(val) => setForm({ ...form, installmentAmountPaise: val })}
            />

            <View className="flex-row gap-4 mt-2">
              <View className="flex-1">
                <Input
                  label="Total Slots (Members)"
                  keyboardType="number-pad"
                  value={form.totalSlots}
                  onChangeText={(val) => setForm({ ...form, totalSlots: val })}
                  required
                />
              </View>
              <View className="flex-1">
                <Input
                  label="Cycle (Days)"
                  keyboardType="number-pad"
                  value={form.cycleDurationDays}
                  onChangeText={(val) => setForm({ ...form, cycleDurationDays: val })}
                  hint="e.g. 30 for Monthly"
                  required
                />
              </View>
            </View>

            <View className="mt-4 p-3 rounded-xl" style={{ backgroundColor: "rgba(245,158,11,0.08)", borderWidth: 1, borderColor: "rgba(245,158,11,0.15)" }}>
              <View className="flex-row justify-between items-center">
                <Text className="text-slate-500 text-xs font-semibold">Total Pot Value</Text>
                <Text className="font-bold text-sm" style={{ color: COLORS.gold[600] }}>
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

        <Card accent="brand" style={{ marginBottom: 24 }}>
          <View className="p-5">
            <View className="flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-xl items-center justify-center"
                style={{ backgroundColor: "rgba(99,102,241,0.1)", borderWidth: 1, borderColor: "rgba(99,102,241,0.2)" }}
              >
                <Ionicons name="shield-checkmark" size={20} color={COLORS.brand[600]} />
              </View>
              <View className="flex-1">
                <Text className="text-slate-900 font-semibold text-sm">You are included as slot #1</Text>
                <Text className="text-slate-500 text-[11px] mt-0.5">
                  As the organizer, you automatically join this chit. You will pay installments and be eligible for payouts.
                </Text>
              </View>
            </View>
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

      <AlertComponent />
    </View>
  );
}
