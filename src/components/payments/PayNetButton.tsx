// src/components/payments/PayNetButton.tsx
// Pay net contribution from wallet balance after resolution (netted flow).
// Non-winners pay: contribution - distribution share.
// Shows countdown, penalty warnings, and amount breakdown.

import React, { useState, useEffect } from "react";
import { View, Text, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { committeesApi } from "../../services/committees.api";
import { walletApi } from "../../services/wallet.api";
import { formatINR } from "../../utils/currency";
import { COLORS } from "../../constants/theme";
import Button from "../ui/Button";

const F = (p: number | bigint | null | undefined) => formatINR(p ?? 0);

interface PayNetButtonProps {
  committeeId: string;
  monthId: string;
  memberId: string;
  monthNumber: number;
  netAmountPaise: number;
  dueDate?: string;
  contributionAmount?: number;
  distributionShare?: number;
  isBlocked?: boolean;
  onPaymentSuccess?: () => void;
}

interface CountdownState {
  days: number;
  hours: number;
  minutes: number;
}

interface PenaltyInfo {
  daysOverdue: number;
  penaltyPercent: number;
  penaltyAmountPaise: number;
}

export default function PayNetButton({
  committeeId,
  monthId,
  memberId,
  monthNumber,
  netAmountPaise,
  dueDate,
  contributionAmount,
  distributionShare,
  isBlocked = false,
  onPaymentSuccess,
}: PayNetButtonProps) {
  const [loading, setLoading] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(true);
  const [countdown, setCountdown] = useState<CountdownState>({ days: 0, hours: 0, minutes: 0 });
  const [penaltyInfo, setPenaltyInfo] = useState<PenaltyInfo>({ daysOverdue: 0, penaltyPercent: 0, penaltyAmountPaise: 0 });
  const [isPastDue, setIsPastDue] = useState(false);

  const hasSufficientBalance = walletBalance !== null && walletBalance >= netAmountPaise;

  useEffect(() => {
    fetchBalance();
  }, []);

  // Countdown and penalty timer
  useEffect(() => {
    if (!dueDate) return;

    const updateTimer = () => {
      const now = Date.now();
      const due = new Date(dueDate).getTime();
      const diff = due - now;

      if (diff <= 0) {
        // Past due
        const daysOverdue = Math.floor((now - due) / (1000 * 60 * 60 * 24));
        const extraDays = Math.max(0, daysOverdue - 2);
        setPenaltyInfo({
          daysOverdue,
          penaltyPercent: extraDays * 3,
          penaltyAmountPaise: Math.round(netAmountPaise * 0.03 * extraDays),
        });
        setCountdown({ days: 0, hours: 0, minutes: 0 });
        setIsPastDue(true);
      } else {
        // Before due
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        setCountdown({ days, hours, minutes });
        setPenaltyInfo({ daysOverdue: 0, penaltyPercent: 0, penaltyAmountPaise: 0 });
        setIsPastDue(false);
      }
    };

    updateTimer();
    const timer = setInterval(updateTimer, 60000); // Update every minute

    return () => clearInterval(timer);
  }, [dueDate, netAmountPaise]);

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
      await committeesApi.payNetAmount(committeeId, monthId, memberId);
      Alert.alert(
        "Payment Successful!",
        `${F(netAmountPaise)} paid for Month ${monthNumber} from wallet.`
      );
      onPaymentSuccess?.();
    } catch (err: any) {
      const message = err?.response?.data?.message || err?.message || "Payment failed.";
      if (message.includes("already")) {
        Alert.alert("Already Paid", "This obligation has already been settled.");
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

  // Determine urgency level for styling
  const getUrgencyColor = () => {
    if (isBlocked) return "danger";
    if (isPastDue && penaltyInfo.daysOverdue > 2) return "danger";
    if (isPastDue) return "danger";
    if (countdown.days === 0 && !isPastDue) return "danger"; // deadline today
    if (countdown.days <= 1) return "warning";
    return "brand";
  };

  const urgencyColor = getUrgencyColor();
  const borderClass = urgencyColor === "danger"
    ? "border-danger-500/30"
    : urgencyColor === "warning"
    ? "border-warning-500/30"
    : "border-brand-500/20";

  return (
    <View>
      {/* Amount Breakdown */}
      {contributionAmount !== undefined && distributionShare !== undefined && (
        <View className="bg-surface-950 rounded-xl p-3 mb-3">
          <Text className="text-neutral-400 text-[10px] uppercase font-bold mb-2">Amount Breakdown</Text>
          <View className="flex-row justify-between mb-1">
            <Text className="text-neutral-500 text-xs">Your Contribution</Text>
            <Text className="text-white text-xs">{F(contributionAmount)}</Text>
          </View>
          <View className="flex-row justify-between mb-1">
            <Text className="text-neutral-500 text-xs">- Distribution Share</Text>
            <Text className="text-success-400 text-xs">{F(distributionShare)}</Text>
          </View>
          <View className="border-t border-neutral-700 my-2" />
          <View className="flex-row justify-between">
            <Text className="text-white font-bold text-xs">Net Amount Due</Text>
            <Text className="text-white font-extrabold text-lg">{F(netAmountPaise)}</Text>
          </View>
        </View>
      )}

      {/* Countdown Timer (before deadline) */}
      {!isPastDue && (countdown.days > 0 || countdown.hours > 0) && (
        <View className={`bg-brand-500/10 border ${borderClass} rounded-xl px-3 py-2 mb-3`}>
          <View className="flex-row items-center justify-center">
            <Ionicons name="time-outline" size={14} color={COLORS.brandPrimary} />
            <Text className="text-brand-400 text-xs font-bold ml-1.5">
              {countdown.days > 0 && `${countdown.days} day${countdown.days !== 1 ? "s" : ""} `}
              {countdown.hours > 0 && `${countdown.hours} hour${countdown.hours !== 1 ? "s" : ""} `}
              remaining
            </Text>
          </View>
        </View>
      )}

      {/* Day 3: Last Day Warning */}
      {!isPastDue && countdown.days === 0 && countdown.hours <= 23 && (
        <View className="bg-danger-500/10 border border-danger-500/30 rounded-xl px-3 py-2 mb-3">
          <View className="flex-row items-center">
            <Ionicons name="alert-circle-outline" size={14} color="#ef4444" />
            <Text className="text-danger-400 text-xs font-bold ml-1.5">
              Last day! Penalty starts tomorrow
            </Text>
          </View>
        </View>
      )}

      {/* Penalty Warning: Days 1-2 overdue (penalty not yet active) */}
      {isPastDue && penaltyInfo.daysOverdue > 0 && penaltyInfo.daysOverdue <= 2 && (
        <View className="bg-warning-500/10 border border-warning-500/30 rounded-xl px-3 py-2 mb-3">
          <View className="flex-row items-center">
            <Ionicons name="warning-outline" size={14} color="#f59e0b" />
            <Text className="text-warning-400 text-xs font-bold ml-1.5">
              Pay within {2 - penaltyInfo.daysOverdue} day{2 - penaltyInfo.daysOverdue !== 1 ? "s" : ""} to avoid penalties
            </Text>
          </View>
        </View>
      )}

      {/* Penalty Active: Days 3+ overdue */}
      {isPastDue && penaltyInfo.daysOverdue > 2 && (
        <View className="bg-danger-500/10 border border-danger-500/30 rounded-xl px-3 py-2 mb-3">
          <View className="flex-row items-center mb-1">
            <Ionicons name="warning-outline" size={14} color="#ef4444" />
            <Text className="text-danger-400 text-xs font-bold ml-1.5">
              Penalty active: 3% per day ({F(Math.round(netAmountPaise * 0.03))}/day)
            </Text>
          </View>
          <Text className="text-danger-400 text-[10px] ml-5">
            Current penalty: {penaltyInfo.penaltyPercent}% ({F(penaltyInfo.penaltyAmountPaise)})
          </Text>
        </View>
      )}

      {/* Blocked State */}
      {isBlocked && (
        <View className="bg-danger-500/10 border border-danger-500/30 rounded-xl px-3 py-3 mb-3">
          <View className="flex-row items-center mb-1">
            <Ionicons name="lock-closed-outline" size={14} color="#ef4444" />
            <Text className="text-danger-400 text-xs font-bold ml-1.5">
              Account Blocked - Organiser Paid For You
            </Text>
          </View>
          <Text className="text-danger-400 text-[10px] ml-5">
            Total owed to organiser: {F(netAmountPaise + penaltyInfo.penaltyAmountPaise)}
          </Text>
          <Text className="text-neutral-500 text-[10px] ml-5 mt-1">
            Pay the organiser directly to unblock your account.
          </Text>
        </View>
      )}

      {/* Amount Box */}
      {!isBlocked && (
        <View className="bg-surface-950 rounded-xl p-3 mb-3">
          <View className="flex-row justify-between items-center mb-1">
            <Text className="text-neutral-400 text-xs">Net Amount Due</Text>
            <Text className="text-white font-extrabold text-lg">{F(netAmountPaise)}</Text>
          </View>
          {dueDate && (
            <View className="flex-row justify-between">
              <Text className="text-neutral-500 text-[10px]">Due by</Text>
              <Text className="text-neutral-400 text-[10px]">
                {new Date(dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Wallet Balance */}
      {!isBlocked && (
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
      )}

      {/* Pay Button (hidden when blocked) */}
      {!isBlocked && (
        <Button
          label={
            loading
              ? "Processing..."
              : hasSufficientBalance
              ? `Pay ${F(netAmountPaise)} from Wallet`
              : "Insufficient Wallet Balance"
          }
          variant={hasSufficientBalance ? "primary" : "secondary"}
          onPress={hasSufficientBalance ? handlePay : undefined}
          isLoading={loading}
          disabled={loading || !hasSufficientBalance || balanceLoading}
          icon={!loading ? <Ionicons name="wallet-outline" size={18} color="#fff" /> : undefined}
        />
      )}

      {/* Refresh hint */}
      {!isBlocked && !hasSufficientBalance && !balanceLoading && (
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
