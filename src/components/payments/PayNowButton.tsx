// src/components/payments/PayNowButton.tsx
// Razorpay Checkout button — creates order, opens checkout, verifies payment.

import React, { useState } from "react";
import { View, Text, Alert, Platform, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { paymentsApi } from "../../services/payments.api";
import { openRazorpayCheckout, loadRazorpayScript } from "../../utils/razorpay";
import { formatINR } from "../../utils/currency";
import { useAuthStore } from "../../stores/auth.store";
import { COLORS } from "../../constants/theme";
import Button from "../ui/Button";

const F = (p: number | bigint | null | undefined) => formatINR(p ?? 0);

interface PayNowButtonProps {
  committeeId: string;
  monthId: string;
  memberId: string;
  committeeName: string;
  monthNumber: number;
  amountPaise: number;          // total due (amount_due + late_fee)
  lateFeePaise?: number;
  onPaymentSuccess?: () => void;
}

export default function PayNowButton({
  committeeId,
  monthId,
  memberId,
  committeeName,
  monthNumber,
  amountPaise,
  lateFeePaise = 0,
  onPaymentSuccess,
}: PayNowButtonProps) {
  const currentUser = useAuthStore((s: any) => s.user);
  const [loading, setLoading] = useState(false);
  const [scriptReady, setScriptReady] = useState<boolean | null>(null);

  // Pre-load Razorpay script on mount (web only)
  React.useEffect(() => {
    if (Platform.OS === "web") {
      loadRazorpayScript().then(setScriptReady);
    }
  }, []);

  const handlePay = async () => {
    if (loading) return;

    // Network check
    if (!navigator.onLine) {
      Alert.alert("No Internet", "Please check your network connection and try again.");
      return;
    }

    setLoading(true);
    try {
      // 1. Create order from backend
      const orderRes = await paymentsApi.createContributionOrder(committeeId, monthId, memberId);
      const { orderId, amount, currency, razorpayKeyId } = orderRes.data.data;

      // 2. Validate amount matches
      if (amount !== amountPaise) {
        Alert.alert(
          "Amount Mismatch",
          `Expected ${F(amountPaise)} but server returned ${F(amount)}. Please refresh and try again.`
        );
        setLoading(false);
        return;
      }

      // 3. Open Razorpay Checkout
      if (Platform.OS === "web") {
        await openRazorpayCheckout({
          key: razorpayKeyId,
          amount,
          currency,
          name: "Kometi",
          description: `Month ${monthNumber} contribution — ${committeeName}`,
          order_id: orderId,
          prefill: {
            name: currentUser?.name || "",
            email: currentUser?.email || "",
            contact: currentUser?.phone || "",
          },
          theme: { color: "#6f5eff" },
          handler: async (response) => {
            // 4. Verify payment on backend
            try {
              const verifyRes = await paymentsApi.verifyPayment({
                orderId: response.razorpay_order_id,
                paymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature,
              });

              if (verifyRes.data.data.success) {
                Alert.alert("Payment Successful!", `₹${(amount / 100).toFixed(0)} paid for Month ${monthNumber}.`);
                onPaymentSuccess?.();
              } else {
                Alert.alert("Verification Pending", "Your payment was received. We'll verify it shortly.");
              }
            } catch (verifyErr: any) {
              Alert.alert(
                "Payment Received",
                "Your payment was successful but verification failed. Please contact support if the issue persists."
              );
            }
          },
          modal: {
            ondismiss: () => {
              Alert.alert("Payment Cancelled", "You cancelled the payment. No amount was charged.");
              setLoading(false);
            },
          },
        });
      } else {
        // Mobile fallback — show manual UPI instruction
        Alert.alert(
          "Web Only",
          "Razorpay Checkout is currently supported on web. Please use the web app to make payments."
        );
      }
    } catch (err: any) {
      const message = err?.message || "Payment failed. Please try again.";

      if (message.includes("already paid")) {
        Alert.alert("Already Paid", "This contribution has already been paid.");
        onPaymentSuccess?.();
      } else if (message.includes("network") || message.includes("fetch")) {
        Alert.alert("Network Error", "Could not connect to payment server. Please check your internet.");
      } else {
        Alert.alert("Payment Error", message);
      }
    } finally {
      setLoading(false);
    }
  };

  const isMobile = Platform.OS !== "web";
  const isScriptLoading = Platform.OS === "web" && scriptReady === null;

  return (
    <View>
      {lateFeePaise > 0 && (
        <View className="bg-warning-500/10 border border-warning-500/20 rounded-xl px-3 py-2 mb-3">
          <View className="flex-row items-center">
            <Ionicons name="alert-circle-outline" size={14} color={COLORS.warning.light} />
            <Text className="text-warning-400 text-xs font-bold ml-1.5">
              Late fee: {F(lateFeePaise)} included
            </Text>
          </View>
        </View>
      )}

      <View className="bg-surface-950 rounded-xl p-3 mb-3">
        <View className="flex-row justify-between items-center mb-1">
          <Text className="text-neutral-400 text-xs">Total Amount</Text>
          <Text className="text-white font-extrabold text-lg">{F(amountPaise)}</Text>
        </View>
        {lateFeePaise > 0 && (
          <View className="flex-row justify-between">
            <Text className="text-neutral-500 text-[10px]">Base: {F(amountPaise - lateFeePaise)}</Text>
            <Text className="text-warning-400 text-[10px]">+ Late fee: {F(lateFeePaise)}</Text>
          </View>
        )}
      </View>

      {isMobile ? (
        <TouchableOpacity
          disabled={loading}
          className="bg-surface-card border border-brand-primary/20 rounded-xl h-14 items-center justify-center flex-row"
          onPress={() =>
            Alert.alert(
              "Use Web App",
              "Online payments are available on the web app. Please visit kometi.app to complete your payment."
            )
          }
        >
          <Ionicons name="phone-portrait-outline" size={18} color={COLORS.brandPrimary} />
          <Text className="text-brand-400 font-bold text-sm ml-2">View on Web to Pay</Text>
        </TouchableOpacity>
      ) : (
        <Button
          label={loading ? "Processing..." : `Pay ${F(amountPaise)}`}
          variant="gold"
          onPress={handlePay}
          isLoading={loading}
          disabled={loading || scriptReady === false}
          icon={!loading ? <Ionicons name="card-outline" size={18} color="#fff" /> : undefined}
        />
      )}

      {Platform.OS === "web" && scriptReady === false && (
        <Text className="text-danger-400 text-[10px] text-center mt-2">
          Failed to load payment gateway. Check your network.
        </Text>
      )}
    </View>
  );
}
