// src/modules/payments/payments.service.ts
// Razorpay payment methods + contribution payment flow — all data stored in Supabase.

import crypto from "crypto";
import supabase from "../../config/supabase";
import razorpay from "../../config/razorpay";
import { emitToUser } from "../../config/socket";

export class PaymentsService {
  // ─── Saved Payment Methods (Supabase) ──────────────────────────────────

  static async listMethods(userId: string) {
    const { data, error } = await supabase
      .from("saved_payment_methods")
      .select("*")
      .eq("user_id", userId)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  }

  static async getMethod(userId: string, methodId: string) {
    const { data, error } = await supabase
      .from("saved_payment_methods")
      .select("*")
      .eq("id", methodId)
      .eq("user_id", userId)
      .single();

    if (error) {
      if (error.code === "PGRST116") throw new Error("Payment method not found");
      throw error;
    }
    return data;
  }

  static async addMethod(
    userId: string,
    payload: {
      methodType: "upi" | "bank_account" | "card";
      upiId?: string;
      bankAccountNumber?: string;
      ifscCode?: string;
      accountHolderName?: string;
    }
  ) {
    // Validate: UPI requires upiId, bank_account requires number + ifsc + name
    if (payload.methodType === "upi" && !payload.upiId) {
      throw new Error("UPI ID is required for UPI payment method");
    }
    if (payload.methodType === "bank_account") {
      if (!payload.bankAccountNumber || !payload.ifscCode || !payload.accountHolderName) {
        throw new Error("Bank account number, IFSC code, and account holder name are required");
      }
    }

    // Ensure Razorpay contact exists for this user
    const razorpayContactId = await this.getOrCreateRazorpayContact(userId);

    // Create Razorpay fund account if bank/UPI
    let razorpayFundAccountId: string | null = null;
    if (payload.methodType === "upi" && payload.upiId) {
      const fundAccount = await this.createRazorpayFundAccount(
        razorpayContactId,
        "vpa",
        { vpa: payload.upiId }
      );
      razorpayFundAccountId = fundAccount.id;
    } else if (payload.methodType === "bank_account" && payload.bankAccountNumber) {
      const fundAccount = await this.createRazorpayFundAccount(
        razorpayContactId,
        "bank_account",
        {
          ifsc: payload.ifscCode!,
          account_number: payload.bankAccountNumber,
        }
      );
      razorpayFundAccountId = fundAccount.id;
    }

    // If this is the first method, make it default
    const existing = await this.listMethods(userId);
    const isDefault = existing.length === 0;

    const { data, error } = await supabase
      .from("saved_payment_methods")
      .insert({
        user_id: userId,
        razorpay_contact_id: razorpayContactId,
        razorpay_fund_account_id: razorpayFundAccountId,
        method_type: payload.methodType,
        upi_id: payload.upiId || null,
        bank_account_number: payload.bankAccountNumber || null,
        ifsc_code: payload.ifscCode || null,
        account_holder_name: payload.accountHolderName || null,
        is_default: isDefault,
        is_verified: false,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async setDefault(userId: string, methodId: string) {
    // Reset all defaults
    await supabase
      .from("saved_payment_methods")
      .update({ is_default: false })
      .eq("user_id", userId);

    // Set new default
    const { error } = await supabase
      .from("saved_payment_methods")
      .update({ is_default: true })
      .eq("id", methodId)
      .eq("user_id", userId);

    if (error) throw error;
  }

  static async deleteMethod(userId: string, methodId: string) {
    const method = await this.getMethod(userId, methodId);

    // Note: Razorpay fund accounts cannot be deleted via API.
    // We just remove the local record.
    const { error } = await supabase
      .from("saved_payment_methods")
      .delete()
      .eq("id", methodId)
      .eq("user_id", userId);

    if (error) throw error;

    // If deleted method was default, promote another
    if (method.is_default) {
      const remaining = await this.listMethods(userId);
      if (remaining.length > 0) {
        await this.setDefault(userId, remaining[0].id);
      }
    }
  }

  // ─── Razorpay Contact (lazy creation) ──────────────────────────────────

  private static async getOrCreateRazorpayContact(userId: string): Promise<string> {
    // Check if user already has a Razorpay contact
    const { data: existing } = await supabase
      .from("saved_payment_methods")
      .select("razorpay_contact_id")
      .eq("user_id", userId)
      .not("razorpay_contact_id", "is", null)
      .limit(1)
      .single();

    if (existing?.razorpay_contact_id) {
      return existing.razorpay_contact_id;
    }

    // Fetch user details for contact creation
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("name, phone, email")
      .eq("id", userId)
      .single();

    if (userError || !user) throw new Error("User not found");

    // Create Razorpay customer (contact)
    const contact = await razorpay.customers.create({
      name: user.name,
      reference_id: userId,
      phone: user.phone ? `+91${user.phone}` : undefined,
      email: user.email || undefined,
    } as any);

    return (contact as any).id;
  }

  // ─── Razorpay Fund Account ─────────────────────────────────────────────

  private static async createRazorpayFundAccount(
    contactId: string,
    accountType: "vpa" | "bank_account",
    accountDetails: Record<string, string>
  ) {
    const payload: any = {
      contact_id: contactId,
      account_type: accountType,
    };

    if (accountType === "vpa") {
      payload.vpa = { address: accountDetails.vpa };
    } else {
      payload.bank_account = {
        ifsc: accountDetails.ifsc,
        account_number: accountDetails.account_number,
      };
    }

    return razorpay.fundAccount.create(payload as any);
  }

  // ─── Razorpay Payout (create transfer to fund account) ─────────────────

  static async createPayout(
    fundAccountId: string,
    amountPaise: number,
    mode: "IMPS" | "NEFT" | "RTGS" | "UPI" = "NEFT"
  ) {
    const transfer = await razorpay.transfers.create({
      account_number: process.env.RAZORPAY_ACCOUNT_NUMBER || "",
      fund_account_id: fundAccountId,
      amount: amountPaise,
      currency: "INR",
      mode,
      purpose: "payout",
    } as any);

    return transfer;
  }

  // ─── Wallet Top-Up with Razorpay ──────────────────────────────────────

  /**
   * Step 1: Create a Razorpay order for wallet top-up.
   */
  static async createWalletTopupOrder(userId: string, amountPaise: number) {
    if (amountPaise <= 0) throw new Error("Amount must be greater than zero");
    if (amountPaise < 100) throw new Error("Minimum top-up amount is ₹1");

    // Create Razorpay order
    const receipt = `topup_${userId.slice(0, 8)}_${Date.now()}`;
    const order = await razorpay.orders.create({
      amount: amountPaise,
      currency: "INR",
      receipt,
      notes: {
        userId,
        type: "wallet_topup",
      },
    } as any);

    // Insert wallet_topup_orders row
    const { data: topupOrder, error: orderError } = await supabase
      .from("wallet_topup_orders")
      .insert({
        user_id: userId,
        razorpay_order_id: (order as any).id,
        amount: amountPaise,
        currency: "INR",
        status: "created",
      })
      .select()
      .single();

    if (orderError) throw orderError;

    return {
      orderId: (order as any).id,
      amount: amountPaise,
      currency: "INR",
      razorpayKeyId: process.env.RAZORPAY_KEY_ID,
      topupOrderId: topupOrder.id,
    };
  }

  /**
   * Step 2: Verify wallet top-up payment signature and credit wallet.
   */
  static async verifyWalletTopupPayment(
    userId: string,
    orderId: string,
    paymentId: string,
    signature: string
  ) {
    // 1. Verify signature
    const body = `${orderId}|${paymentId}`;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "")
      .update(body)
      .digest("hex");

    if (expectedSignature !== signature) {
      throw new Error("Payment verification failed — invalid signature");
    }

    // 2. Find the topup order
    const { data: topupOrder, error: orderError } = await supabase
      .from("wallet_topup_orders")
      .select("*")
      .eq("razorpay_order_id", orderId)
      .eq("user_id", userId)
      .single();

    if (orderError || !topupOrder) {
      throw new Error("Top-up order not found");
    }

    if (topupOrder.status === "completed") {
      // Already processed (idempotent)
      return { success: true, message: "Wallet already credited" };
    }

    // 3. Update topup order → completed
    const { error: updateOrderError } = await supabase
      .from("wallet_topup_orders")
      .update({
        status: "completed",
        razorpay_payment_id: paymentId,
        razorpay_signature: signature,
        completed_at: new Date().toISOString(),
      })
      .eq("id", topupOrder.id);

    if (updateOrderError) throw updateOrderError;

    // 4. Credit wallet
    const { data: wallet, error: walletError } = await supabase
      .from("wallets")
      .select("*")
      .eq("userId", userId)
      .single();

    if (walletError || !wallet) throw new Error("Wallet not found");

    const balanceBefore = Number(wallet.balancePaise);
    const balanceAfter = balanceBefore + topupOrder.amount;

    const { error: creditError } = await supabase
      .from("wallets")
      .update({ balancePaise: balanceAfter })
      .eq("id", wallet.id);

    if (creditError) throw creditError;

    // 5. Create transaction ledger entry
    const { error: txnError } = await supabase
      .from("transactions")
      .insert({
        walletId: wallet.id,
        userId,
        type: "CREDIT",
        category: "WALLET_TOPUP",
        status: "COMPLETED",
        amountPaise: topupOrder.amount,
        balanceBefore,
        balanceAfter,
        description: "Wallet Top-Up via Razorpay",
        paymentMethod: "UPI",
        externalTxnId: paymentId,
        idempotencyKey: `topup-${orderId}-${paymentId}`,
      });

    if (txnError) throw txnError;

    // 6. Emit real-time event
    emitToUser(userId, "wallet:credited", {
      amountPaise: topupOrder.amount,
      newBalance: balanceAfter,
    });

    return { success: true, message: "Wallet credited successfully" };
  }

  // ─── Contribution Payment Flow ─────────────────────────────────────────

  /**
   * Step 1: Create a Razorpay order for a member's monthly contribution.
   */
  static async createContributionOrder(
    committeeId: string,
    monthId: string,
    memberId: string
  ) {
    // 1. Fetch the monthly_contributions record
    const { data: contribution, error: fetchError } = await supabase
      .from("monthly_contributions")
      .select("*")
      .eq("committee_id", committeeId)
      .eq("month_id", monthId)
      .eq("member_id", memberId)
      .single();

    if (fetchError || !contribution) {
      throw new Error("Monthly contribution record not found");
    }

    // 2. Validate status
    if (contribution.status === "paid") {
      throw new Error("Contribution already paid");
    }
    if (contribution.status === "defaulted") {
      throw new Error("Contribution has been defaulted — contact organizer");
    }

    // 3. Calculate total amount = amount_due + late_fee
    const amountDue = Number(contribution.amount_due);
    const lateFee = Number(contribution.late_fee_amount || 0);
    const totalAmountPaise = amountDue + lateFee;

    if (totalAmountPaise <= 0) {
      throw new Error("Invalid amount — nothing to pay");
    }

    // 4. Create Razorpay order
    const receipt = `contrib_${committeeId.slice(0, 8)}_${monthId.slice(0, 8)}_${memberId.slice(0, 8)}`;
    const order = await razorpay.orders.create({
      amount: totalAmountPaise,
      currency: "INR",
      receipt,
      notes: {
        committeeId,
        monthId,
        memberId,
        type: "contribution",
      },
    } as any);

    // 5. Insert payment_transactions row
    const { data: tx, error: txError } = await supabase
      .from("payment_transactions")
      .insert({
        committee_id: committeeId,
        month_id: monthId,
        member_id: memberId,
        transaction_type: lateFee > 0 ? "late_fee" : "contribution",
        razorpay_order_id: (order as any).id,
        amount: totalAmountPaise,
        currency: "INR",
        status: "created",
      })
      .select()
      .single();

    if (txError) throw txError;

    // 6. Return order details for client-side checkout
    return {
      orderId: (order as any).id,
      amount: totalAmountPaise,
      currency: "INR",
      razorpayKeyId: process.env.RAZORPAY_KEY_ID,
      paymentTransactionId: tx.id,
    };
  }

  /**
   * Step 2: Verify payment signature and capture (mark as paid).
   */
  static async verifyAndCapturePayment(
    orderId: string,
    paymentId: string,
    signature: string
  ) {
    // 1. Verify signature
    const body = `${orderId}|${paymentId}`;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "")
      .update(body)
      .digest("hex");

    if (expectedSignature !== signature) {
      throw new Error("Payment verification failed — invalid signature");
    }

    // 2. Find the payment transaction
    const { data: tx, error: txError } = await supabase
      .from("payment_transactions")
      .select("*")
      .eq("razorpay_order_id", orderId)
      .single();

    if (txError || !tx) {
      throw new Error("Payment transaction not found for this order");
    }

    if (tx.status === "paid") {
      // Already processed (idempotent)
      const { data: contribution } = await supabase
        .from("monthly_contributions")
        .select("*")
        .eq("committee_id", tx.committee_id)
        .eq("month_id", tx.month_id)
        .eq("member_id", tx.member_id)
        .single();

      return { success: true, contribution };
    }

    // 3. Update payment_transactions → paid
    const { error: updateTxError } = await supabase
      .from("payment_transactions")
      .update({
        status: "paid",
        razorpay_payment_id: paymentId,
        razorpay_signature: signature,
        paid_at: new Date().toISOString(),
      })
      .eq("id", tx.id);

    if (updateTxError) throw updateTxError;

    // 4. Update monthly_contributions → paid
    const { data: contribution, error: updateContributionError } = await supabase
      .from("monthly_contributions")
      .update({
        status: "paid",
        amount_paid: tx.amount,
        paid_at: new Date().toISOString(),
        payment_transaction_id: tx.id,
      })
      .eq("committee_id", tx.committee_id)
      .eq("month_id", tx.month_id)
      .eq("member_id", tx.member_id)
      .select()
      .single();

    if (updateContributionError) throw updateContributionError;

    // 5. Emit real-time event
    emitToUser(tx.member_id, "contribution:paid", {
      committeeId: tx.committee_id,
      monthId: tx.month_id,
      amount: tx.amount,
    });

    return { success: true, contribution };
  }
}
