// src/components/payments/PayNowButton.tsx
// Pay contribution from wallet balance. No Razorpay — wallet only.

import React, { useState, useEffect } from "react";
import { View, Text, Alert, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { paymentsApi } from "../../services/payments.api";
import { walletApi } from "../../services/wallet.api";
import { formatINR } from "../../utils/currency";
import { COLORS } from "../../constants/theme";
import Button from "../ui/Button";

const F = (p: number | bigint | null | undefined) => formatINR(p ?? 0);

interface PayNowButtonProps {
  committeeId: string;
  monthId: string;
  memberId: string;
  committeeName: string;
  monthNumber: number;
  amountPaise: number;
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
  const [loading, setLoading] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(true);

  const hasSufficientBalance = walletBalance !== null && walletBalance >= amountPaise;

  useEffect(() => {
    fetchBalance();
  }, []);

  const fetchBalance = async () => {
    try {
      setBalanceLoading(true);
      const res = await walletApi.getBalance();
      setWalletBalance(Number(res.data.data?.balancePaise || 0));
    } catch {
      setWalletBalance(null);
    } finally {
      setBalanceLoading(false);
    }
  };

  const handlePay = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await paymentsApi.payFromWallet(committeeId, monthId, memberId);
      Alert.alert(
        "Payment Successful!",
        `₹${(amountPaise / 100).toFixed(0)} paid for Month ${monthNumber} from wallet.`
      );
      onPaymentSuccess?.();
    } catch (err: any) {
      const message = err?.response?.data?.message || err?.message || "Payment failed.";
      if (message.includes("already paid")) {
        Alert.alert("Already Paid", "This contribution has already been paid.");
        onPaymentSuccess?.();
      } else if (message.includes("Insufficient") || message.includes("insufficient")) {
        Alert.alert("Insufficient Balance", message);
        fetchBalance();
      } else {
        Alert.alert("Payment Error", message);
      }
    } finally {
      setLoading(false);
    }
  };

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

      {/* ── Wallet Balance ──────────────────────────────────────────────── */}
      <View className="flex-row items-center justify-between bg-surface-950 rounded-xl px-3 py-2 mb-3">
        <View className="flex-row items-center">
          <Ionicons name="wallet-outline" size={16} color={COLORS.brandPrimary} />
          <Text className="text-neutral-400 text-xs ml-1.5">Wallet Balance</Text>
        </View>
        {balanceLoading ? (
          <Text className="text-neutral-500 text-xs">Loading...</Text>
        ) : (
          <Text className={`font-bold text-sm ${hasSufficientBalance ? "text-success-400" : "text-danger-400"}`}>
            {walletBalance !== null ? F(walletBalance) : "N/A"}
          </Text>
        )}
      </View>

      {/* ── Pay Button ──────────────────────────────────────────────────── */}
      <Button
        label={
          loading
            ? "Processing..."
            : hasSufficientBalance
            ? `Pay ${F(amountPaise)} from Wallet`
            : "Insufficient Wallet Balance"
        }
        variant={hasSufficientBalance ? "primary" : "secondary"}
        onPress={hasSufficientBalance ? handlePay : undefined}
        isLoading={loading}
        disabled={loading || !hasSufficientBalance || balanceLoading}
        icon={!loading ? <Ionicons name="wallet-outline" size={18} color="#fff" /> : undefined}
      />

      {/* ── Refresh / Top-up hint ───────────────────────────────────────── */}
      {!hasSufficientBalance && !balanceLoading && (
        <View className="mt-3 items-center">
          <Text className="text-neutral-500 text-[10px] mb-2">
            Add funds to your wallet to pay instantly.
          </Text>
          <Button
            label="Refresh Balance"
            variant="secondary"
            onPress={fetchBalance}
            icon={<Ionicons name="refresh-outline" size={16} color={COLORS.brandPrimary} />}
          />
        </View>
      )}
    </View>
  );
}
