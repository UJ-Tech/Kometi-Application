// src/modules/wallet/wallet.service.ts
import supabase from "../../config/supabase";
import { emitToUser } from "../../config/socket";

export class WalletService {
  static async getWalletData(userId: string) {
    const { data: wallet, error } = await supabase
      .from("wallets")
      .select("*, transactions(*)")
      .eq("userId", userId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return await this.createWallet(userId);
      }
      throw error;
    }

    if (!wallet) throw new Error("Wallet not found");
    
    // Sort transactions locally since Supabase joined query order might vary
    if (wallet.transactions) {
      wallet.transactions.sort((a: any, b: any) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }

    return wallet;
  }

  private static async createWallet(userId: string) {
    const { data, error } = await supabase
      .from("wallets")
      .insert({
        userId,
        balancePaise: 0,
      })
      .select("*, transactions(*)")
      .single();

    if (error) throw error;
    return data;
  }

  static async topup(userId: string, amountPaise: bigint) {
    const amount = Number(amountPaise);
    if (amount <= 0) throw new Error("Amount must be greater than zero");

    const wallet = await this.getWalletData(userId);

    const balanceBefore = Number(wallet.balancePaise);
    const balanceAfter = balanceBefore + amount;

    // Update wallet balance
    const { error: updateError } = await supabase
      .from("wallets")
      .update({ balancePaise: balanceAfter })
      .eq("id", wallet.id);
    
    if (updateError) throw updateError;

    // Log transaction ledger entry
    const { error: txnError } = await supabase
      .from("transactions")
      .insert({
        walletId: wallet.id,
        userId,
        type: "CREDIT",
        category: "WALLET_TOPUP",
        status: "COMPLETED",
        amountPaise: amount,
        balanceBefore,
        balanceAfter,
        description: "Wallet Deposit (UPI)",
        paymentMethod: "UPI",
        idempotencyKey: `topup-${wallet.id}-${Date.now()}`,
      });

    if (txnError) throw txnError;

    // Notify client via sockets
    emitToUser(userId, "wallet:credited", {
      amountPaise: amount,
      newBalance: balanceAfter,
    });
  }

  static async transfer(senderId: string, recipientPhone: string, amountPaise: bigint) {
    const amount = Number(amountPaise);
    if (amount <= 0) throw new Error("Amount must be greater than zero");

    const senderWallet = await this.getWalletData(senderId);

    if (Number(senderWallet.balancePaise) < amount) throw new Error("Insufficient wallet balance");

    const { data: recipient, error: recipientError } = await supabase
      .from("users")
      .select("*, wallets(*)")
      .eq("phone", recipientPhone)
      .single();

    if (recipientError || !recipient) {
      throw new Error("Recipient not found");
    }

    // Lazy create recipient wallet if missing
    let recipientWallet = Array.isArray(recipient.wallets) ? recipient.wallets[0] : recipient.wallets;
    if (!recipientWallet) {
      recipientWallet = await this.createWallet(recipient.id);
    }

    if (senderId === recipient.id) {
      throw new Error("Cannot transfer funds to your own wallet");
    }

    const senderBefore = Number(senderWallet.balancePaise);
    const senderAfter = senderBefore - amount;
    const senderWalletId = senderWallet.id;

    const recipientBefore = Number(recipientWallet.balancePaise);
    const recipientAfter = recipientBefore + amount;
    const recipientWalletId = recipientWallet.id;
    const recipientId = recipient.id;
    const recipientName = recipient.name;

    const idempotencyKey = `tx-${senderWalletId}-${recipientWalletId}-${Date.now()}`;

    // 1. Deduct from sender
    const { error: sUpdateError } = await supabase
      .from("wallets")
      .update({ balancePaise: senderAfter })
      .eq("id", senderWalletId);
    
    if (sUpdateError) throw sUpdateError;

    // 2. Add to recipient
    const { error: rUpdateError } = await supabase
      .from("wallets")
      .update({ balancePaise: recipientAfter })
      .eq("id", recipientWalletId);
    
    if (rUpdateError) throw rUpdateError;

    // 3. Create ledger entries
    const { error: txnError } = await supabase
      .from("transactions")
      .insert([
        {
          walletId: senderWalletId,
          userId: senderId,
          type: "DEBIT",
          category: "WALLET_TRANSFER",
          status: "COMPLETED",
          amountPaise: amount,
          balanceBefore: senderBefore,
          balanceAfter: senderAfter,
          description: `Transfer to ${recipientName}`,
          paymentMethod: "WALLET",
          idempotencyKey: `${idempotencyKey}-debit`,
        },
        {
          walletId: recipientWalletId,
          userId: recipientId,
          type: "CREDIT",
          category: "WALLET_TRANSFER",
          status: "COMPLETED",
          amountPaise: amount,
          balanceBefore: recipientBefore,
          balanceAfter: recipientAfter,
          description: `Received from ${senderId}`,
          paymentMethod: "WALLET",
          idempotencyKey: `${idempotencyKey}-credit`,
        }
      ]);

    if (txnError) throw txnError;

    // Notify both users via Socket
    emitToUser(senderId, "wallet:debited", {
      amountPaise: amount,
      newBalance: senderAfter,
    });

    emitToUser(recipientId, "wallet:credited", {
      amountPaise: amount,
      newBalance: recipientAfter,
    });
  }
}
