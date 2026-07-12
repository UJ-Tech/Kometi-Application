import React from "react";
import { View, Text, Dimensions, Platform } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import Button from "../../components/ui/Button";
import KKMark from "../../components/brand/KKMark";
import { COLORS, FONT_SIZE, SPACING, BORDER_RADIUS } from "../../constants/theme";

const { width } = Dimensions.get("window");
const FEATURES = [
  { icon: "shield-checkmark", title: "Secure & Transparent", desc: "Every transaction is recorded and verifiable" },
  { icon: "flash", title: "Instant Payments", desc: "Pay installments and receive payouts instantly" },
  { icon: "people", title: "Manage Committees", desc: "Create, join, and manage chit funds seamlessly" },
];

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.surface.bg }}>
      <LinearGradient
        colors={["#1e1b4b", "#312e81", "#3730a3"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ flex: 1, position: "relative", overflow: "hidden" }}
      >
        {/* Full-bleed watermark overlay — no layout space consumed */}
        <View style={{
          position: "absolute",
          right: -80,
          top: -40,
          opacity: 0.05,
        }}>
          <KKMark size={320} color={COLORS.white} />
        </View>

        {/* Centered intro with glow */}
        <View style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: SPACING[6],
        }}>
          {/* Glowing logo */}
          <View style={{
            width: 96,
            height: 96,
            borderRadius: 28,
            backgroundColor: "rgba(255,255,255,0.08)",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: SPACING[5],
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.12)",
            ...Platform.select({
              ios: {
                shadowColor: COLORS.gold[400],
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.6,
                shadowRadius: 24,
              },
              android: {
                elevation: 12,
              },
            }),
          }}>
            <KKMark size={52} color={COLORS.white} />
          </View>

          {/* Glow behind text */}
          <View style={{
            position: "absolute",
            top: "45%",
            width: 200,
            height: 120,
            borderRadius: 100,
            backgroundColor: COLORS.gold[400],
            opacity: 0.12,
            ...Platform.select({
              ios: {
                shadowColor: COLORS.gold[400],
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.8,
                shadowRadius: 60,
              },
              android: { elevation: 0 },
            }),
          }} />

          <Text style={{
            fontSize: FONT_SIZE["4xl"],
            fontWeight: "800",
            color: COLORS.white,
            letterSpacing: -1,
          }}>
            Monio
          </Text>

          <View style={{
            width: 60,
            height: 2,
            backgroundColor: "rgba(255,255,255,0.25)",
            borderRadius: 1,
            marginVertical: SPACING[3],
          }} />

          <Text style={{
            fontSize: FONT_SIZE.base,
            color: COLORS.brand[200],
            textAlign: "center",
            lineHeight: 24,
          }}>
            Committee Management
          </Text>
        </View>

        {/* Feature cards — compact, at the bottom */}
        <View style={{
          paddingHorizontal: SPACING[6],
          gap: SPACING[3],
          marginBottom: SPACING[6],
        }}>
          {FEATURES.map((item, i) => (
            <View key={i} style={{
              flexDirection: "row",
              alignItems: "center",
              gap: SPACING[3],
              backgroundColor: "rgba(255,255,255,0.06)",
              borderRadius: BORDER_RADIUS.xl,
              paddingVertical: SPACING[3],
              paddingHorizontal: SPACING[4],
            }}>
              <Ionicons name={item.icon as any} size={18} color={COLORS.gold[400]} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: FONT_SIZE.sm, fontWeight: "600", color: COLORS.white }}>
                  {item.title}
                </Text>
                <Text style={{ fontSize: FONT_SIZE.xs, color: COLORS.brand[200], marginTop: 1 }}>
                  {item.desc}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* CTA */}
        <View style={{
          paddingHorizontal: SPACING[6],
          paddingBottom: insets.bottom + SPACING[6],
          gap: SPACING[3],
        }}>
          <Button
            label="Get Started"
            variant="primary"
            size="lg"
            gradient
            onPress={() => router.push("/(auth)/login")}
          />
          <Text style={{
            fontSize: FONT_SIZE.xs,
            color: "rgba(255,255,255,0.5)",
            textAlign: "center",
            lineHeight: 18,
          }}>
            By continuing, you agree to our{" "}
            <Text style={{ color: COLORS.gold[400], fontWeight: "600" }}>Terms</Text>
            {" "}and{" "}
            <Text style={{ color: COLORS.gold[400], fontWeight: "600" }}>Privacy Policy</Text>
          </Text>
        </View>
      </LinearGradient>
    </View>
  );
}
