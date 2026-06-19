// src/modules/wallet/withdrawal.service.ts
// Withdrawal flow: member requests withdrawal from wallet to bank/UPI via Razorpay payouts.
//
// Pre-checks (fail-fast):
//   a) KYC: verified payment_methods entry (is_verified = true)
//   b) Minimum: amount >= ₹100 (10000 paise)
//   c) Balance: amount <= availableForWithdrawal (not totalBalance)
//   d) Velocity: < 3 withdrawals in last 24h
//   e) Daily amount: sum of last 24h withdrawals + this amount <= ₹50,000
//   f) Account: committee_members.is_active = true
//
// If all pass:
//   1. Create withdrawal_requests row (status='requested')
//   2. WalletLedgerService.debitWallet() — locks funds immediately
//   3. Razorpay payout (transfers from nodal account to member's fund_account)
//   4. Update withdrawal_requests with payout ID and status='processing'

import supabase from "../../config/supabase";
import { WalletLedgerService } from "./wallet-ledger.service";
import { PaymentsService } from "../payments/payments.service";
import {
  KycNotVerifiedError,
  MinimumWithdrawalError,
  DailyWithdrawalLimitError,
  DailyAmountLimitError,
  InactiveMemberError,
  InsufficientBalanceError,
  WithdrawalNotFoundError,
  WithdrawalFailedError,
  WithdrawalNotCancellableError,
} from "../../utils/errors";

// ─── Types ────────────────────────────────────────────────────────────

export interface WithdrawalRequest {
  id: string;
  member_id: string;
  committee_id: string;
  amount: number;
  payment_method_id: string | null;
  status: "requested" | "processing" | "completed" | "failed" | "cancelled";
  razorpay_payout_id: string | null;
  ledger_entry_id: string | null;
  requested_at: string;
  completed_at: string | null;
  failure_reason: string | null;
}

interface RequestWithdrawalParams {
  memberId: string;
  committeeId: string;
  amountPaise: number;
  paymentMethodId: string;
}

// ─── Constants ────────────────────────────────────────────────────────

const MINIMUM_WITHDRAWAL_PAISE = 10_000; // ₹100
const DAILY_WITHDRAWAL_COUNT_LIMIT = 3;
const DAILY_WITHDRAWAL_AMOUNT_LIMIT_PAISE = 5_000_000; // ₹50,000
const VELOCITY_WINDOW_HOURS = 24;

// ─── Service ──────────────────────────────────────────────────────────

export class WithdrawalService {
  /**
   * Request a withdrawal from a member's wallet to their bank account/UPI.
   *
   * Runs 6 pre-checks in order (fail-fast), then:
   *   1. Creates withdrawal_requests row
   *   2. Debits wallet via WalletLedgerService
   *   3. Initiates Razorpay payout
   *   4. Updates withdrawal status to 'processing'
   */
  static async requestWithdrawal(params: RequestWithdrawalParams): Promise<WithdrawalRequest> {
    const { memberId, committeeId, amountPaise, paymentMethodId } = params;

    // ─── Pre-check a) KYC verification ──────────────────────────────────
    await this.verifyKyc(memberId, paymentMethodId);

    // ─── Pre-check b) Minimum amount ────────────────────────────────────
    if (amountPaise < MINIMUM_WITHDRAWAL_PAISE) {
      throw new MinimumWithdrawalError(amountPaise);
    }

    // ─── Pre-check c) Balance check ─────────────────────────────────────
    const summary = await WalletLedgerService.getWalletSummary(memberId, committeeId);
    if (amountPaise > summary.availableForWithdrawal) {
      throw new InsufficientBalanceError(summary.availableForWithdrawal, amountPaise);
    }

    // ─── Pre-check d) Velocity: count of withdrawals in last 24h ───────
    const recentCount = await this.getRecentWithdrawalCount(memberId);
    if (recentCount >= DAILY_WITHDRAWAL_COUNT_LIMIT) {
      throw new DailyWithdrawalLimitError(recentCount);
    }

    // ─── Pre-check e) Daily amount limit ────────────────────────────────
    const recentSum = await this.getRecentWithdrawalSum(memberId);
    if (recentSum + amountPaise > DAILY_WITHDRAWAL_AMOUNT_LIMIT_PAISE) {
      throw new DailyAmountLimitError(recentSum, amountPaise);
    }

    // ─── Pre-check f) Active member check ───────────────────────────────
    await this.verifyActiveMember(memberId, committeeId);

    // ─── All checks passed — create withdrawal ──────────────────────────

    // 1. Create withdrawal_requests row
    const { data: withdrawal, error: createError } = await supabase
      .from("withdrawal_requests")
      .insert({
        member_id: memberId,
        committee_id: committeeId,
        amount: amountPaise,
        payment_method_id: paymentMethodId,
        status: "requested",
        requested_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (createError) throw createError;

    // 2. Debit wallet — locks funds immediately
    const idempotencyKey = `withdrawal_${withdrawal.id}`;
    const ledgerEntry = await WalletLedgerService.debitWallet({
      memberId,
      committeeId,
      amount: amountPaise,
      entryType: "withdrawal_debit",
      referenceType: "withdrawal_request",
      referenceId: withdrawal.id,
      idempotencyKey,
      createdBy: "system",
      notes: `Withdrawal request #${withdrawal.id}`,
    });

    // 3. Update withdrawal with ledger entry ID
    const { error: linkError } = await supabase
      .from("withdrawal_requests")
      .update({ ledger_entry_id: ledgerEntry.id })
      .eq("id", withdrawal.id);

    if (linkError) throw linkError;

    // 4. Initiate Razorpay payout
    try {
      const { data: method, error: methodError } = await supabase
        .from("saved_payment_methods")
        .select("razorpay_fund_account_id, method_type")
        .eq("id", paymentMethodId)
        .single();

      if (methodError || !method) {
        throw new Error("Payment method not found");
      }

      if (!method.razorpay_fund_account_id) {
        throw new Error("Payment method does not have a Razorpay fund account");
      }

      // Determine payout mode from method type
      const mode = method.method_type === "upi" ? "UPI" : "NEFT";

      const transfer = await PaymentsService.createPayout(
        method.razorpay_fund_account_id,
        amountPaise,
        mode as "IMPS" | "NEFT" | "RTGS" | "UPI"
      );

      // 5. Update withdrawal with Razorpay payout ID and status
      const { error: updateError } = await supabase
        .from("withdrawal_requests")
        .update({
          razorpay_payout_id: (transfer as any).id,
          status: "processing",
        })
        .eq("id", withdrawal.id);

      if (updateError) throw updateError;

      return {
        ...withdrawal,
        razorpay_payout_id: (transfer as any).id,
        status: "processing",
      };
    } catch (payoutError: any) {
      // Payout failed — mark withdrawal as failed and reverse the ledger entry
      await supabase
        .from("withdrawal_requests")
        .update({
          status: "failed",
          failure_reason: payoutError.message || "Payout initiation failed",
        })
        .eq("id", withdrawal.id);

      // Reverse the debit entry to restore wallet balance
      try {
        await WalletLedgerService.reverseEntry({
          ledgerEntryId: ledgerEntry.id,
          reason: `Payout failed: ${payoutError.message}`,
          performedBy: "system",
        });
      } catch (reverseError) {
        console.error(
          `[WithdrawalService] CRITICAL: Failed to reverse ledger entry ${ledgerEntry.id} after payout failure:`,
          reverseError
        );
      }

      throw new WithdrawalFailedError(withdrawal.id, payoutError.message || "Payout initiation failed");
    }
  }

  /**
   * Get withdrawal details by ID.
   */
  static async getWithdrawal(
    withdrawalId: string,
    memberId: string
  ): Promise<WithdrawalRequest> {
    const { data, error } = await supabase
      .from("withdrawal_requests")
      .select("*")
      .eq("id", withdrawalId)
      .eq("member_id", memberId)
      .single();

    if (error || !data) {
      throw new WithdrawalNotFoundError(withdrawalId);
    }

    return data;
  }

  /**
   * Cancel a pending withdrawal request.
   *
   * Only allowed if status='requested' (not yet sent to Razorpay).
   * Reverses the debit entry to restore wallet balance.
   */
  static async cancelWithdrawal(
    withdrawalId: string,
    memberId: string
  ): Promise<WithdrawalRequest> {
    // 1. Find the withdrawal
    const { data: withdrawal, error: findError } = await supabase
      .from("withdrawal_requests")
      .select("*")
      .eq("id", withdrawalId)
      .eq("member_id", memberId)
      .single();

    if (findError || !withdrawal) {
      throw new WithdrawalNotFoundError(withdrawalId);
    }

    // 2. Only 'requested' status can be cancelled
    if (withdrawal.status !== "requested") {
      throw new WithdrawalNotCancellableError(withdrawalId, withdrawal.status);
    }

    // 3. Reverse the debit entry to restore wallet balance
    if (withdrawal.ledger_entry_id) {
      await WalletLedgerService.reverseEntry({
        ledgerEntryId: withdrawal.ledger_entry_id,
        reason: `Withdrawal cancelled by member`,
        performedBy: memberId,
      });
    }

    // 4. Update status to 'cancelled'
    const { error: updateError } = await supabase
      .from("withdrawal_requests")
      .update({ status: "cancelled" })
      .eq("id", withdrawalId);

    if (updateError) throw updateError;

    return {
      ...withdrawal,
      status: "cancelled",
    };
  }

  /**
   * List withdrawal history for a member, optionally filtered by committee.
   */
  static async listWithdrawals(
    memberId: string,
    options?: {
      committeeId?: string;
      status?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ withdrawals: WithdrawalRequest[]; total: number }> {
    let query = supabase
      .from("withdrawal_requests")
      .select("*", { count: "exact" })
      .eq("member_id", memberId)
      .order("requested_at", { ascending: false });

    if (options?.committeeId) {
      query = query.eq("committee_id", options.committeeId);
    }

    if (options?.status) {
      query = query.eq("status", options.status);
    }

    const limit = options?.limit ?? 20;
    const offset = options?.offset ?? 0;
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    return {
      withdrawals: (data || []) as WithdrawalRequest[],
      total: count || 0,
    };
  }

  /**
   * Handle Razorpay payout webhook (called from payments webhook handler).
   * Updates withdrawal status based on payout outcome.
   */
  static async handlePayoutWebhook(
    payoutId: string,
    status: "processed" | "failed",
    failureReason?: string
  ): Promise<void> {
    // Find the withdrawal by Razorpay payout ID
    const { data: withdrawal, error: findError } = await supabase
      .from("withdrawal_requests")
      .select("*")
      .eq("razorpay_payout_id", payoutId)
      .single();

    if (findError || !withdrawal) {
      console.error(`[WithdrawalService] No withdrawal found for payout ${payoutId}`);
      return;
    }

    // Already processed (idempotent)
    if (withdrawal.status === "completed" || withdrawal.status === "failed") {
      return;
    }

    if (status === "processed") {
      // Mark as completed
      const { error: updateError } = await supabase
        .from("withdrawal_requests")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", withdrawal.id);

      if (updateError) throw updateError;
    } else {
      // Mark as failed and reverse the ledger entry
      const { error: updateError } = await supabase
        .from("withdrawal_requests")
        .update({
          status: "failed",
          failure_reason: failureReason || "Payout failed",
        })
        .eq("id", withdrawal.id);

      if (updateError) throw updateError;

      // Reverse the debit entry to restore wallet balance
      if (withdrawal.ledger_entry_id) {
        try {
          await WalletLedgerService.reverseEntry({
            ledgerEntryId: withdrawal.ledger_entry_id,
            reason: `Payout failed: ${failureReason}`,
            performedBy: "system",
          });
        } catch (reverseError) {
          console.error(
            `[WithdrawalService] CRITICAL: Failed to reverse ledger entry ${withdrawal.ledger_entry_id} for failed payout ${payoutId}:`,
            reverseError
          );
        }
      }
    }
  }

  // ─── Private Helpers ─────────────────────────────────────────────────

  /**
   * Verify that the member has a verified payment method (KYC check).
   */
  private static async verifyKyc(memberId: string, paymentMethodId: string): Promise<void> {
    const { data: method, error } = await supabase
      .from("saved_payment_methods")
      .select("id, is_verified")
      .eq("id", paymentMethodId)
      .eq("user_id", memberId)
      .single();

    if (error || !method) {
      throw new KycNotVerifiedError();
    }

    if (!method.is_verified) {
      throw new KycNotVerifiedError();
    }
  }

  /**
   * Verify that the member is an active participant in the committee.
   */
  private static async verifyActiveMember(memberId: string, committeeId: string): Promise<void> {
    const { data: member, error } = await supabase
      .from("committee_members")
      .select("id, is_active")
      .eq("committee_id", committeeId)
      .eq("user_id", memberId)
      .single();

    if (error || !member) {
      throw new InactiveMemberError(memberId, committeeId);
    }

    if (!member.is_active) {
      throw new InactiveMemberError(memberId, committeeId);
    }
  }

  /**
   * Count withdrawal requests by this member in the last 24 hours.
   * Counts statuses: requested, processing, completed.
   */
  private static async getRecentWithdrawalCount(memberId: string): Promise<number> {
    const windowStart = new Date(
      Date.now() - VELOCITY_WINDOW_HOURS * 60 * 60 * 1000
    ).toISOString();

    const { count, error } = await supabase
      .from("withdrawal_requests")
      .select("id", { count: "exact", head: true })
      .eq("member_id", memberId)
      .in("status", ["requested", "processing", "completed"])
      .gte("requested_at", windowStart);

    if (error) throw error;
    return count || 0;
  }

  /**
   * Sum of completed+processing withdrawals by this member in the last 24 hours.
   */
  private static async getRecentWithdrawalSum(memberId: string): Promise<number> {
    const windowStart = new Date(
      Date.now() - VELOCITY_WINDOW_HOURS * 60 * 60 * 1000
    ).toISOString();

    const { data, error } = await supabase
      .from("withdrawal_requests")
      .select("amount")
      .eq("member_id", memberId)
      .in("status", ["processing", "completed"])
      .gte("requested_at", windowStart);

    if (error) throw error;

    return (data || []).reduce((sum: number, row: any) => sum + Number(row.amount), 0);
  }
}
