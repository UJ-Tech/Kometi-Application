// src/app/(auth)/welcome.tsx
// Kometi Welcome / Onboarding screen

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Button from "../../components/ui/Button";
import { COLORS, FONT_SIZE, SPACING, BORDER_RADIUS } from "../../constants/theme";

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.surface.bg }}>
      {/* Logo area */}
      <View style={[styles.logoContainer, { paddingTop: insets.top + SPACING[10] }]}>
        <View style={styles.logoCircle}>
          <Text style={styles.logoText}>₹</Text>
        </View>
        <Text style={styles.appName}>Kometi</Text>
        <Text style={styles.tagline}>Committee Management</Text>
      </View>

      {/* Feature pills */}
      <View style={styles.featuresRow}>
        {["Secure", "Instant", "Transparent"].map((f) => (
          <View key={f} style={styles.featurePill}>
            <Text style={styles.featurePillText}>{f}</Text>
          </View>
        ))}
      </View>

      {/* Main content */}
      <View style={styles.contentBlock}>
        <Text style={styles.headline}>Run your committee{"\n"}the modern way</Text>
        <Text style={styles.subtext}>
          Manage members, track installments, and disburse payouts — all in one app built for Indian chit funds.
        </Text>
      </View>

      {/* CTA */}
      <View style={[styles.ctaContainer, { paddingBottom: insets.bottom + SPACING[6] }]}>
        <Button
          label="Get Started"
          variant="primary"
          size="lg"
          onPress={() => router.push("/(auth)/login")}
        />
        <Text style={styles.termsText}>
          By continuing, you agree to our{" "}
          <Text style={{ color: COLORS.brand[400] }}>Terms of Service</Text>
          {" "}and{" "}
          <Text style={{ color: COLORS.brand[400] }}>Privacy Policy</Text>
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  logoContainer: {
    alignItems: "center",
    gap:        SPACING[2],
    flex:       1,
    justifyContent: "center",
  },
  logoCircle: {
    width:         80,
    height:        80,
    borderRadius:  20,
    alignItems:    "center",
    justifyContent:"center",
    marginBottom:  SPACING[2],
    backgroundColor: COLORS.brand[500],
  },
  logoText: {
    fontSize:   36,
    fontWeight: "700",
    color:      COLORS.white,
  },
  appName: {
    fontSize:   FONT_SIZE["3xl"],
    fontWeight: "700",
    color:      COLORS.text.primary,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: FONT_SIZE.sm,
    color:    COLORS.text.secondary,
    letterSpacing: 1,
    fontWeight: "500",
  },
  featuresRow: {
    flexDirection:  "row",
    gap:            SPACING[2],
    justifyContent: "center",
    paddingHorizontal: SPACING[6],
    marginBottom:   SPACING[8],
  },
  featurePill: {
    paddingHorizontal: SPACING[3],
    paddingVertical:   SPACING[1.5],
    borderRadius:      BORDER_RADIUS.full,
    backgroundColor:   COLORS.surface.card,
    borderWidth:       1,
    borderColor:       COLORS.surface.border,
  },
  featurePillText: {
    fontSize:   FONT_SIZE.xs,
    fontWeight: "500",
    color:      COLORS.text.secondary,
  },
  contentBlock: {
    paddingHorizontal: SPACING[6],
    gap:               SPACING[3],
    marginBottom:      SPACING[8],
  },
  headline: {
    fontSize:   FONT_SIZE["3xl"],
    fontWeight: "700",
    color:      COLORS.text.primary,
    lineHeight: 38,
  },
  subtext: {
    fontSize:   FONT_SIZE.base,
    color:      COLORS.text.secondary,
    lineHeight: 24,
  },
  ctaContainer: {
    paddingHorizontal: SPACING[6],
    gap:               SPACING[4],
  },
  termsText: {
    fontSize:  FONT_SIZE.xs,
    color:     COLORS.text.muted,
    textAlign: "center",
    lineHeight: 18,
  },
});
