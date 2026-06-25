// src/components/payments/PayNowButton.tsx
// Pay contribution from wallet balance. No Razorpay — wallet only.

import React, { useState, useEffect } from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { paymentsApi } from "../../services/payments.api";
import { walletApi } from "../../services/wallet.api";
import { formatINR } from "../../utils/currency";
import { COLORS } from "../../constants/theme";
import Button from "../ui/Button";
import { useAlertModal } from "../ui/AlertModal";

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
  const { alert, confirm, AlertComponent } = useAlertModal();
  const [loading, setLoading] = useState(false);
  const [paid, setPaid] = useState(false);
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
    if (loading || paid) return;
    setLoading(true);
    try {
      await paymentsApi.payFromWallet(committeeId, monthId, memberId);
      setPaid(true);
      await alert(
        "Payment Successful!",
        `₹${(amountPaise / 100).toFixed(0)} paid for Month ${monthNumber} from wallet.`
      );
      onPaymentSuccess?.();
    } catch (err: any) {
      const message = err?.response?.data?.message || err?.message || "Payment failed.";
      if (message.includes("already paid")) {
        setPaid(true);
        await alert("Already Paid", "This contribution has already been paid.");
        onPaymentSuccess?.();
      } else if (message.includes("Insufficient") || message.includes("insufficient")) {
        await alert("Insufficient Balance", message);
        fetchBalance();
      } else {
        await alert("Payment Error", message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
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

      {/* Amount Breakdown */}
      {!paid && (
        <View className="bg-surface-50 rounded-xl p-3 mb-3">
          <View className="flex-row justify-between items-center mb-1">
            <Text className="text-slate-400 text-xs">Total Amount</Text>
            <Text className="text-slate-900 font-extrabold text-lg">{F(amountPaise)}</Text>
          </View>
          {lateFeePaise > 0 && (
            <View className="flex-row justify-between">
              <Text className="text-slate-500 text-[10px]">Base: {F(amountPaise - lateFeePaise)}</Text>
              <Text className="text-warning-400 text-[10px]">+ Late fee: {F(lateFeePaise)}</Text>
            </View>
          )}
        </View>
      )}

      {/* ── Wallet Balance ──────────────────────────────────────────────── */}
      {!paid && (
        <View className="flex-row items-center justify-between bg-surface-50 rounded-xl px-3 py-2 mb-3">
          <View className="flex-row items-center">
            <Ionicons name="wallet-outline" size={16} color={COLORS.brandPrimary} />
            <Text className="text-slate-400 text-xs ml-1.5">Wallet Balance</Text>
          </View>
          {balanceLoading ? (
            <Text className="text-slate-500 text-xs">Loading...</Text>
          ) : (
            <Text className={`font-bold text-sm ${hasSufficientBalance ? "text-success-400" : "text-danger-400"}`}>
              {walletBalance !== null ? F(walletBalance) : "N/A"}
            </Text>
          )}
        </View>
      )}

      {/* ── Paid State ─────────────────────────────────────────────────── */}
      {paid && (
        <View className="bg-success-500/10 border border-success-500/30 rounded-xl px-3 py-3 mb-3">
          <View className="flex-row items-center">
            <Ionicons name="checkmark-circle-outline" size={14} color="#22c55e" />
            <Text className="text-success-600 text-xs font-bold ml-1.5">
              Contribution of {F(amountPaise)} for Month {monthNumber} paid
            </Text>
          </View>
          <Text className="text-slate-500 text-[10px] ml-5 mt-1">
            Thank you for your payment.
          </Text>
        </View>
      )}

      {/* ── Pay Button ──────────────────────────────────────────────────── */}
      <Button
        label={
          paid
            ? "Paid Successfully"
            : loading
            ? "Processing..."
            : hasSufficientBalance
            ? `Pay ${F(amountPaise)} from Wallet`
            : "Insufficient Wallet Balance"
        }
        variant={paid ? "secondary" : hasSufficientBalance ? "primary" : "secondary"}
        onPress={!paid && hasSufficientBalance ? handlePay : undefined}
        isLoading={loading}
        disabled={loading || paid || !hasSufficientBalance || balanceLoading}
        icon={!loading && !paid ? <Ionicons name="wallet-outline" size={18} color="#fff" /> : undefined}
      />

      {/* ── Refresh / Top-up hint ───────────────────────────────────────── */}
      {!paid && !hasSufficientBalance && !balanceLoading && (
        <View className="mt-3 items-center">
          <Text className="text-slate-500 text-[10px] mb-2">
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
    <AlertComponent />
    </>
  );
}
