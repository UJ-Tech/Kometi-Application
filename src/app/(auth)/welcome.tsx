import React from "react";
import { View, Text, TouchableOpacity, Dimensions } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import Button from "../../components/ui/Button";
import KKMark, { KKSeparator } from "../../components/brand/KKMark";
import { COLORS, FONT_SIZE, SPACING, BORDER_RADIUS } from "../../constants/theme";

const { width } = Dimensions.get("window");

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.surface.bg }}>
      {/* Hero Section */}
      <LinearGradient
        colors={["#1e1b4b", "#312e81", "#3730a3"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          paddingTop: insets.top + SPACING[12],
          paddingBottom: SPACING[16],
          paddingHorizontal: SPACING[6],
          borderBottomLeftRadius: BORDER_RADIUS["4xl"],
          borderBottomRightRadius: BORDER_RADIUS["4xl"],
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* K-Mark Watermark */}
        <View style={{
          position: "absolute",
          right: -60,
          top: -20,
          opacity: 0.06,
        }}>
          <KKMark size={260} color={COLORS.white} />
        </View>

        <View style={{ alignItems: "center" }}>
          <View style={{
            width: 80,
            height: 80,
            borderRadius: 24,
            backgroundColor: "rgba(255,255,255,0.1)",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: SPACING[4],
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.15)",
          }}>
            <KKMark size={44} color={COLORS.white} />
          </View>
          <Text style={{
            fontSize: FONT_SIZE["4xl"],
            fontWeight: "800",
            color: COLORS.white,
            letterSpacing: -1,
          }}>
            Monio
          </Text>
          <KKSeparator color="rgba(255,255,255,0.3)" width={60} thickness={2} />
          <Text style={{
            fontSize: FONT_SIZE.base,
            color: COLORS.brand[200],
            marginTop: SPACING[2],
            textAlign: "center",
            lineHeight: 24,
          }}>
            Committee Management
          </Text>
        </View>
      </LinearGradient>

      {/* Content */}
      <View style={{
        flex: 1,
        paddingHorizontal: SPACING[6],
        paddingTop: SPACING[8],
        gap: SPACING[6],
      }}>
        {/* Feature Highlights */}
        <View style={{
          backgroundColor: COLORS.surface.card,
          borderRadius: BORDER_RADIUS["2xl"],
          padding: SPACING[6],
          borderWidth: 1,
          borderColor: COLORS.surface.border,
          shadowColor: COLORS.brand[500],
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.05,
          shadowRadius: 12,
          elevation: 3,
          gap: SPACING[5],
        }}>
          {[
            { icon: "shield-checkmark", title: "Secure & Transparent", desc: "Every transaction is recorded and verifiable" },
            { icon: "flash", title: "Instant Payments", desc: "Pay installments and receive payouts instantly" },
            { icon: "people", title: "Manage Committees", desc: "Create, join, and manage chit funds seamlessly" },
          ].map((item, i) => (
            <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: SPACING[4] }}>
              <View style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                backgroundColor: "rgba(79, 70, 229, 0.08)",
                alignItems: "center",
                justifyContent: "center",
              }}>
                <Ionicons name={item.icon as any} size={22} color={COLORS.brand[500]} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: FONT_SIZE.base, fontWeight: "600", color: COLORS.text.primary }}>
                  {item.title}
                </Text>
                <Text style={{ fontSize: FONT_SIZE.sm, color: COLORS.text.secondary, marginTop: 1 }}>
                  {item.desc}
                </Text>
              </View>
            </View>
          ))}
        </View>
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
          color: COLORS.text.muted,
          textAlign: "center",
          lineHeight: 18,
        }}>
          By continuing, you agree to our{" "}
          <Text style={{ color: COLORS.brand[400], fontWeight: "600" }}>Terms</Text>
          {" "}and{" "}
          <Text style={{ color: COLORS.brand[400], fontWeight: "600" }}>Privacy Policy</Text>
        </Text>
      </View>
    </View>
  );
}
