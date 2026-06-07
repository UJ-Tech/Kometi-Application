// src/modules/installments/installments.service.ts
import supabase from "../../config/supabase";
import { emitToUser } from "../../config/socket";

export class InstallmentsService {
  static async getUpcomingDues(userId: string) {
    const { data, error } = await supabase
      .from("installments")
      .select("*, committee:committees(id, name)")
      .eq("userId", userId)
      .in("status", ["PENDING", "OVERDUE", "PARTIAL"])
      .order("dueDate", { ascending: true });
    
    if (error) throw error;
    return data;
  }

  static async collectPayment(
    installmentId: string,
    collectedById: string,
    paymentMethod: "CASH" | "UPI" | "BANK_TRANSFER" | "WALLET",
    paymentReference?: string,
    notes?: string
  ) {
    const { data: installment, error: instError } = await supabase
      .from("installments")
      .select("*, paidByUser:users(*, wallets(*))")
      .eq("id", installmentId)
      .single();

    if (instError || !installment) throw new Error("Installment not found");
    if (installment.status === "PAID") throw new Error("Installment already paid");

    const amountToPay = Number(installment.amountDuePaise) + Number(installment.penaltyPaise);

    // 1. If paying via Wallet, verify and deduct balance
    if (paymentMethod === "WALLET") {
      const wallet = installment.paidByUser.wallets;
      if (!wallet) throw new Error("Wallet not found for this user");
      if (Number(wallet.balancePaise) < amountToPay) {
        throw new Error("Insufficient wallet balance");
      }

      const balanceBefore = Number(wallet.balancePaise);
      const balanceAfter = balanceBefore - amountToPay;

      // Deduct from Wallet
      const { error: walletError } = await supabase
        .from("wallets")
        .update({ balancePaise: balanceAfter })
        .eq("id", wallet.id);
      
      if (walletError) throw walletError;

      // Record Transaction Ledger Entry
      const { error: txnError } = await supabase
        .from("transactions")
        .insert({
          walletId: wallet.id,
          userId: installment.userId,
          type: "DEBIT",
          category: "INSTALLMENT_PAYMENT",
          status: "COMPLETED",
          amountPaise: amountToPay,
          balanceBefore,
          balanceAfter,
          description: `Chit Installment Payment - Cycle #${installment.cycleNo}`,
          referenceId: installment.id,
          referenceType: "Installment",
          paymentMethod: "WALLET",
          idempotencyKey: `pay-inst-${installment.id}-${Date.now()}`,
        });
      
      if (txnError) throw txnError;
    }

    // 2. Mark installment as Paid
    const { error: updateError } = await supabase
      .from("installments")
      .update({
        status: "PAID",
        amountPaidPaise: amountToPay,
        paidAt: new Date().toISOString(),
        paymentMethod,
        paymentReference,
        collectedById,
        notes,
      })
      .eq("id", installmentId);
    
    if (updateError) throw updateError;

    // 3. Emit real-time events to user
    emitToUser(installment.userId, "installment:paid", { installmentId });
    
    if (paymentMethod === "WALLET") {
      const { data: updatedWallet } = await supabase
        .from("wallets")
        .select("balancePaise")
        .eq("userId", installment.userId)
        .single();

      if (updatedWallet) {
        emitToUser(installment.userId, "wallet:debited", {
          amountPaise: amountToPay,
          newBalance: Number(updatedWallet.balancePaise),
        });
      }
    }
  }
}
