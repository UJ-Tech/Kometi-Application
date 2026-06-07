// src/app/(auth)/welcome.tsx
// Kometi Welcome / Onboarding screen

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Button from "../../components/ui/Button";
import { COLORS, FONT_SIZE, SPACING, GRADIENTS } from "../../constants/theme";

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.surface.bg }}>
      {/* Hero gradient blob */}
      <LinearGradient
        colors={["rgba(111,94,255,0.35)", "transparent"]}
        style={styles.heroGradient}
      />

      {/* Logo area */}
      <View style={[styles.logoContainer, { paddingTop: insets.top + SPACING[10] }]}>
        <View style={styles.logoCircle}>
          <LinearGradient
            colors={GRADIENTS.brandPrimary as [string, string]}
            style={StyleSheet.absoluteFill}
          />
          <Text style={styles.logoText}>₹</Text>
        </View>
        <Text style={styles.appName}>Kometi</Text>
        <Text style={styles.tagline}>Smart Committee Management</Text>
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
          Manage members, track installments, and disburse payouts — all in one secure app built for Indian chit funds.
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
  heroGradient: {
    position:     "absolute",
    top:          -120,
    left:         -80,
    width:        400,
    height:       400,
    borderRadius: 200,
  },
  logoContainer: {
    alignItems: "center",
    gap:        SPACING[2],
    flex:       1,
    justifyContent: "center",
  },
  logoCircle: {
    width:         80,
    height:        80,
    borderRadius:  40,
    overflow:      "hidden",
    alignItems:    "center",
    justifyContent:"center",
    marginBottom:  SPACING[2],
  },
  logoText: {
    fontSize:   36,
    fontWeight: "800",
    color:      COLORS.white,
  },
  appName: {
    fontSize:   FONT_SIZE["4xl"],
    fontWeight: "800",
    color:      COLORS.text.primary,
    letterSpacing: -1,
  },
  tagline: {
    fontSize: FONT_SIZE.sm,
    color:    COLORS.text.secondary,
    letterSpacing: 2,
    textTransform: "uppercase",
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
    borderRadius:      SPACING[6],
    backgroundColor:   "rgba(111,94,255,0.12)",
    borderWidth:       1,
    borderColor:       COLORS.surface.border,
  },
  featurePillText: {
    fontSize:   FONT_SIZE.xs,
    fontWeight: "600",
    color:      COLORS.brand[300],
  },
  contentBlock: {
    paddingHorizontal: SPACING[6],
    gap:               SPACING[3],
    marginBottom:      SPACING[8],
  },
  headline: {
    fontSize:   FONT_SIZE["3xl"],
    fontWeight: "800",
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
