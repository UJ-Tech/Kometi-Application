import React, { useEffect, useState } from "react";
import { View, Text } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Button from "../../components/ui/Button";
import ScreenHeader from "../../components/shared/ScreenHeader";
import { committeesApi } from "../../services/committees.api";
import { COLORS, FONT_SIZE, SPACING, BORDER_RADIUS } from "../../constants/theme";

export default function JoinPendingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    committeeId: string;
    committeeName: string;
    requestId: string;
  }>();

  const [status, setStatus] = useState<"PENDING" | "APPROVED" | "REJECTED">("PENDING");
  const [isPolling, setIsPolling] = useState(true);

  useEffect(() => {
    if (!isPolling || !params.committeeId || !params.requestId) return;

    const interval = setInterval(async () => {
      try {
        const res = await committeesApi.getMyJoinRequestStatus(params.committeeId!);
        const request = res.data.data;
        if (request && request.status !== "PENDING") {
          setStatus(request.status);
          setIsPolling(false);
        }
      } catch {
        // Ignore polling errors silently
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [isPolling, params.committeeId, params.requestId]);

  const handleGoToDashboard = () => {
    router.replace("/(app)/dashboard");
  };

  const statusConfig = {
    PENDING: {
      icon: "time-outline" as const,
      color: COLORS.gold[400],
      bgGradient: ["rgba(245,158,11,0.1)", "rgba(245,158,11,0.04)"] as [string, string],
      title: "Request Pending",
    },
    APPROVED: {
      icon: "checkmark-circle-outline" as const,
      color: COLORS.success.DEFAULT,
      bgGradient: ["rgba(34,197,94,0.1)", "rgba(34,197,94,0.04)"] as [string, string],
      title: "Request Approved!",
    },
    REJECTED: {
      icon: "close-circle-outline" as const,
      color: COLORS.danger.DEFAULT,
      bgGradient: ["rgba(239,68,68,0.1)", "rgba(239,68,68,0.04)"] as [string, string],
      title: "Request Declined",
    },
  };

  const config = statusConfig[status];

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.surface.bg }}>
      <ScreenHeader title="Join Request" showBack={false} />

      <View style={[{ flex: 1, paddingHorizontal: SPACING[6], gap: SPACING[6], paddingTop: SPACING[8] }, { paddingBottom: insets.bottom + SPACING[8] }]}>
        <View style={{ alignItems: "center", gap: SPACING[3] }}>
          <LinearGradient
            colors={config.bgGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              width: 80,
              height: 80,
              borderRadius: 24,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: COLORS.surface.border,
            }}
          >
            <Ionicons name={config.icon} size={36} color={config.color} />
          </LinearGradient>

          <Text style={{
            fontSize: FONT_SIZE["2xl"],
            fontWeight: "800",
            color: status === "APPROVED" ? COLORS.success.dark : status === "REJECTED" ? COLORS.danger.dark : COLORS.gold[700],
            textAlign: "center",
          }}>
            {config.title}
          </Text>

          {status === "PENDING" && (
            <Text style={{ fontSize: FONT_SIZE.base, color: COLORS.text.secondary, textAlign: "center", lineHeight: 24 }}>
              Your request to join{"\n"}
              <Text style={{ color: COLORS.gold[600], fontWeight: "700" }}>
                {params.committeeName ?? "the committee"}
              </Text>
              {"\n"}has been sent for approval.
            </Text>
          )}

          {status === "APPROVED" && (
            <Text style={{ fontSize: FONT_SIZE.base, color: COLORS.text.secondary, textAlign: "center", lineHeight: 24 }}>
              Congratulations! You have been approved to join{"\n"}
              <Text style={{ color: COLORS.success.dark, fontWeight: "700" }}>
                {params.committeeName ?? "the committee"}
              </Text>
            </Text>
          )}

          {status === "REJECTED" && (
            <Text style={{ fontSize: FONT_SIZE.base, color: COLORS.text.secondary, textAlign: "center", lineHeight: 24 }}>
              Your request to join{"\n"}
              <Text style={{ color: COLORS.danger.dark, fontWeight: "700" }}>
                {params.committeeName ?? "the committee"}
              </Text>
              {"\n"}was declined by the organizer.
            </Text>
          )}
        </View>

        {/* Pending indicator */}
        {status === "PENDING" && (
          <View style={{
            backgroundColor: "rgba(245,158,11,0.08)",
            borderRadius: BORDER_RADIUS["2xl"],
            padding: SPACING[5],
            gap: SPACING[3],
            borderWidth: 1,
            borderColor: "rgba(245,158,11,0.15)",
          }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: SPACING[2] }}>
              <View style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: COLORS.gold[400],
              }} />
              <Text style={{ fontSize: FONT_SIZE.sm, fontWeight: "600", color: COLORS.gold[600] }}>
                Waiting for organizer response...
              </Text>
            </View>
            <Text style={{ fontSize: FONT_SIZE.xs, color: COLORS.text.muted, lineHeight: 18 }}>
              This usually takes a few minutes. You can leave this screen and check back later.
            </Text>
          </View>
        )}

        {/* Actions */}
        {status === "PENDING" && (
          <Button label="Go to Dashboard" variant="ghost" size="md" onPress={handleGoToDashboard} />
        )}

        {status === "APPROVED" && (
          <Button label="Go to Dashboard" variant="primary" size="lg" gradient onPress={handleGoToDashboard} />
        )}

        {status === "REJECTED" && (
          <View style={{ gap: SPACING[3] }}>
            <Button
              label="Try Another Code"
              variant="gold"
              size="lg"
              onPress={() => router.replace("/(auth)/join-committee" as any)}
            />
            <Button label="Go to Dashboard" variant="ghost" size="md" onPress={handleGoToDashboard} />
          </View>
        )}
      </View>
    </View>
  );
}
