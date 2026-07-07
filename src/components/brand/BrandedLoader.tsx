import React, { useEffect, useRef } from "react";
import { View, Animated, Easing, Text, Image, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, SPACING } from "../../constants/theme";

type LoaderEffect = "morph" | "orbit" | "ripple" | "glow" | "wave";

interface BrandedLoaderProps {
  message?: string;
  effect?: LoaderEffect;
  size?: number;
  fullScreen?: boolean;
  style?: ViewStyle;
}

const DOT_COLORS = [COLORS.brand[400], COLORS.gold[400], COLORS.brand[300], COLORS.gold[300]];
const ORBIT_RADIUS_RATIO = 0.9;

export default function BrandedLoader({
  message,
  effect = "orbit",
  size = 80,
  fullScreen = true,
  style,
}: BrandedLoaderProps) {
  const insets = useSafeAreaInsets();
  const anim = useRef(new Animated.Value(0)).current;
  const slowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(anim, {
        toValue: 1,
        duration: 2000,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, []);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(slowAnim, {
        toValue: 1,
        duration: 4000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const getLogoStyle = () => {
    switch (effect) {
      case "morph":
        return {
          opacity: anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.6, 1, 0.6] }),
          transform: [
            { scale: anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.9, 1.08, 0.9] }) },
            { rotate: anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: ["-5deg", "5deg", "-5deg"] }) },
          ],
        };
      case "glow":
        return {
          opacity: anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.85, 1, 0.85] }),
          transform: [{ scale: anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.98, 1.04, 0.98] }) }],
        };
      case "wave":
        return {
          transform: [
            { translateX: anim.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [0, 10, 0, -10, 0] }) },
            { translateY: anim.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [0, -8, -14, -8, 0] }) },
            { rotate: anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: ["-4deg", "4deg", "-4deg"] }) },
          ],
        };
      default:
        return {};
    }
  };

  const renderOrbitDots = () => {
    if (effect !== "orbit") return null;
    const r = size * ORBIT_RADIUS_RATIO;
    return [0, 1, 2, 3].map((i) => {
      const phase = i / 4;
      const dotColor = DOT_COLORS[i];
      const dotSize = i % 2 === 0 ? 8 : 6;
      const sinRange = [0, 0.25, 0.5, 0.75, 1];
      const sinOutput = sinRange.map((t) => {
        const angle = (t + phase) * 2 * Math.PI;
        return (Math.sin(angle) + 1) / 2;
      });
      return (
        <Animated.View
          key={i}
          style={{
            position: "absolute",
            width: dotSize,
            height: dotSize,
            borderRadius: dotSize / 2,
            backgroundColor: dotColor,
            opacity: slowAnim.interpolate({ inputRange: sinRange, outputRange: sinOutput }),
            transform: [
              {
                translateX: slowAnim.interpolate({
                  inputRange: [0, 0.25, 0.5, 0.75, 1],
                  outputRange: [
                    r * Math.cos(i * Math.PI / 2),
                    r * Math.cos(i * Math.PI / 2 + Math.PI / 4),
                    r * Math.cos(i * Math.PI / 2 + Math.PI / 2),
                    r * Math.cos(i * Math.PI / 2 + 3 * Math.PI / 4),
                    r * Math.cos(i * Math.PI / 2 + Math.PI),
                  ].map((v) => Math.round(v * 100) / 100),
                }),
              },
              {
                translateY: slowAnim.interpolate({
                  inputRange: [0, 0.25, 0.5, 0.75, 1],
                  outputRange: [
                    r * Math.sin(i * Math.PI / 2),
                    r * Math.sin(i * Math.PI / 2 + Math.PI / 4),
                    r * Math.sin(i * Math.PI / 2 + Math.PI / 2),
                    r * Math.sin(i * Math.PI / 2 + 3 * Math.PI / 4),
                    r * Math.sin(i * Math.PI / 2 + Math.PI),
                  ].map((v) => Math.round(v * 100) / 100),
                }),
              },
            ],
          }}
        />
      );
    });
  };

  const renderRings = () => {
    if (effect !== "ripple") return null;
    const ringBase = size * 0.6;
    return [0, 1].map((i) => {
      const ringAnim = i === 0 ? anim : slowAnim;
      const scale = ringAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 2.2 + i * 0.3],
      });
      const opacity = ringAnim.interpolate({
        inputRange: [0, 0.4, 1],
        outputRange: [0.4, 0.15, 0],
      });
      return (
        <Animated.View
          key={i}
          pointerEvents="none"
          style={{
            position: "absolute",
            width: ringBase,
            height: ringBase,
            borderRadius: ringBase / 2,
            borderWidth: 2,
            borderColor: COLORS.brand[400],
            opacity,
            transform: [{ scale }],
          }}
        />
      );
    });
  };

  const renderGlow = () => {
    if (effect !== "glow") return null;
    const glowSize = size + 24;
    return (
      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          width: glowSize,
          height: glowSize,
          borderRadius: glowSize / 2,
          backgroundColor: COLORS.brand[500],
          opacity: anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.06, 0.18, 0.06] }),
          transform: [{ scale: anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.85, 1.1, 0.85] }) }],
        }}
      />
    );
  };

  const logoSection = (
    <View style={{ alignItems: "center", justifyContent: "center", width: size + 40, height: size + 40 }}>
      {renderRings()}
      {renderGlow()}
      {renderOrbitDots()}
      <Animated.View style={getLogoStyle()}>
        <Image
          source={require("../../../assets/images/watermarklogo.png")}
          style={{ width: size, height: size }}
          resizeMode="contain"
        />
      </Animated.View>
    </View>
  );

  const content = (
    <View style={{ alignItems: "center", justifyContent: "center", gap: SPACING[5] }}>
      {logoSection}
      {message && (
        <Text style={{ fontSize: 14, color: COLORS.text.muted, textAlign: "center", maxWidth: 200 }}>
          {message}
        </Text>
      )}
    </View>
  );

  if (!fullScreen) return content;

  return (
    <View
      style={[{
        flex: 1,
        backgroundColor: COLORS.surface.bg,
        alignItems: "center",
        justifyContent: "center",
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
      }, style]}
    >
      {content}
    </View>
  );
}

export function LoadingOverlay({ message, effect = "orbit", size = 56 }: BrandedLoaderProps) {
  return (
    <View
      style={{
        position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: "rgba(250,248,245,0.85)",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 999,
      }}
      pointerEvents="none"
    >
      <BrandedLoader message={message} effect={effect} size={size} fullScreen={false} />
    </View>
  );
}
