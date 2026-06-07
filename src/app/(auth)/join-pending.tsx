// src/app/(auth)/join-pending.tsx
// Pending approval screen — shown after member submits a join request

import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Button from "../../components/ui/Button";
import ScreenHeader from "../../components/shared/ScreenHeader";
import { committeesApi } from "../../services/committees.api";
import { COLORS, FONT_SIZE, SPACING, GRADIENTS } from "../../constants/theme";

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

  // Poll for status changes every 5 seconds
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

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.surface.bg }}>
      <ScreenHeader title="Join Request" showBack={false} />
      <LinearGradient
        colors={["rgba(245,158,11,0.18)", "transparent"]}
        style={styles.blob}
      />

      <View style={[styles.content, { paddingBottom: insets.bottom + SPACING[8] }]}>
        <View style={styles.top}>
          <View style={styles.iconCircle}>
            <LinearGradient colors={GRADIENTS.goldAccent as [string, string]} style={StyleSheet.absoluteFill} />
            <Ionicons
              name={status === "APPROVED" ? "checkmark-circle-outline" : status === "REJECTED" ? "close-circle-outline" : "time-outline"}
              size={28}
              color="#fff"
            />
          </View>

          {status === "PENDING" && (
            <>
              <Text style={styles.title}>Request Pending</Text>
              <Text style={styles.subtitle}>
                Your request to join{"\n"}
                <Text style={styles.committeeName}>{params.committeeName ?? "the committee"}</Text>
                {"\n"}has been sent to the organizer for approval.
              </Text>
            </>
          )}

          {status === "APPROVED" && (
            <>
              <Text style={[styles.title, { color: COLORS.success.light }]}>Request Approved!</Text>
              <Text style={styles.subtitle}>
                Congratulations! You have been approved to join{"\n"}
                <Text style={styles.committeeName}>{params.committeeName ?? "the committee"}</Text>
              </Text>
            </>
          )}

          {status === "REJECTED" && (
            <>
              <Text style={[styles.title, { color: COLORS.danger.light }]}>Request Declined</Text>
              <Text style={styles.subtitle}>
                Your request to join{"\n"}
                <Text style={styles.committeeName}>{params.committeeName ?? "the committee"}</Text>
                {"\n"}was declined by the organizer. You can try joining another committee.
              </Text>
            </>
          )}
        </View>

        {/* Status indicator */}
        {status === "PENDING" && (
          <View style={styles.pendingBox}>
            <View style={styles.pulseRow}>
              <View style={styles.pulseDot} />
              <Text style={styles.pendingText}>Waiting for organizer response...</Text>
            </View>
            <Text style={styles.pendingHint}>
              This usually takes a few minutes. You can leave this screen and check back later from the dashboard.
            </Text>
          </View>
        )}

        {/* Action buttons */}
        {status === "PENDING" && (
          <Button
            label="Go to Dashboard"
            variant="ghost"
            size="md"
            onPress={handleGoToDashboard}
          />
        )}

        {status === "APPROVED" && (
          <Button
            label="Go to Dashboard"
            variant="primary"
            size="lg"
            onPress={handleGoToDashboard}
          />
        )}

        {status === "REJECTED" && (
          <View style={styles.rejectedActions}>
            <Button
              label="Try Another Code"
              variant="gold"
              size="lg"
              onPress={() => router.replace("/(auth)/join-committee" as any)}
            />
            <Button
              label="Go to Dashboard"
              variant="ghost"
              size="md"
              onPress={handleGoToDashboard}
            />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  blob: { position: "absolute", top: -40, left: -60, width: 220, height: 220, borderRadius: 110 },
  content: { flex: 1, paddingHorizontal: SPACING[6], gap: SPACING[6], paddingTop: SPACING[8] },
  top: { gap: SPACING[3], alignItems: "center" },
  iconCircle: {
    width: 72, height: 72, borderRadius: 22, overflow: "hidden",
    alignItems: "center", justifyContent: "center", marginBottom: SPACING[2],
  },
  title: { fontSize: FONT_SIZE["3xl"], fontWeight: "800", color: COLORS.text.primary, textAlign: "center", lineHeight: 36 },
  subtitle: { fontSize: FONT_SIZE.base, color: COLORS.text.secondary, textAlign: "center", lineHeight: 24 },
  committeeName: { color: COLORS.gold[300], fontWeight: "700" },
  pendingBox: {
    backgroundColor: "rgba(245,158,11,0.08)", borderRadius: 16,
    padding: SPACING[5], gap: SPACING[3],
  },
  pulseRow: { flexDirection: "row", alignItems: "center", gap: SPACING[2] },
  pulseDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: COLORS.gold[400],
  },
  pendingText: { fontSize: FONT_SIZE.sm, fontWeight: "600", color: COLORS.gold[300] },
  pendingHint: { fontSize: FONT_SIZE.xs, color: COLORS.text.muted, lineHeight: 18 },
  rejectedActions: { gap: SPACING[3] },
});
