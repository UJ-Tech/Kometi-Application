// src/stores/wallet.store.ts
import { create } from "zustand";
import type { Wallet, Transaction, PaginationMeta, Withdrawal } from "../types";
import { walletApi } from "../services/wallet.api";

interface WalletState {
  wallet:       Wallet | null;
  balancePaise: number;
  transactions: Transaction[];
  withdrawals:  Withdrawal[];
  isLoading:    boolean;
  isTransacting:boolean;
  hasMore:      boolean;
  pagination:   PaginationMeta;

  setWallet:          (wallet: Wallet) => void;
  updateBalance:      (balancePaise: number) => void;
  setTransactions:    (list: Transaction[]) => void;
  prependTransaction: (txn: Transaction) => void;
  appendTransactions: (list: Transaction[]) => void;
  setPagination:      (meta: PaginationMeta) => void;
  setLoading:         (v: boolean) => void;
  setTransacting:     (v: boolean) => void;
  fetchWalletData:    () => Promise<void>;
  topupWallet:        (amountPaise: number) => Promise<{ orderId: string; amount: number; currency: string; razorpayKeyId: string }>;
  verifyTopupPayment: (orderId: string, paymentId: string, signature: string) => Promise<void>;
  fetchWithdrawals:   (committeeId?: string) => Promise<void>;
  requestWithdrawal:  (committeeId: string, amountPaise: number, paymentMethodId: string) => Promise<Withdrawal>;
  cancelWithdrawal:   (withdrawalId: string) => Promise<void>;
  reset:              () => void;
}

const defaultPagination: PaginationMeta = {
  total: 0, page: 1, limit: 20, hasMore: false,
};

export const useWalletStore = create<WalletState>((set, get) => ({
  wallet:        null,
  balancePaise:  0,
  transactions:  [],
  withdrawals:   [],
  isLoading:     false,
  isTransacting: false,
  hasMore:       false,
  pagination:    defaultPagination,

  setWallet:       (wallet) => set({ wallet, balancePaise: wallet.balancePaise }),
  setTransactions: (list)   => set({ transactions: list }),
  setLoading:      (v)      => set({ isLoading: v }),
  setTransacting:  (v)      => set({ isTransacting: v }),
  setPagination:   (meta)   => set({ pagination: meta, hasMore: meta.hasMore }),

  updateBalance: (balancePaise) => {
    set((s) => ({
      balancePaise,
      wallet: s.wallet ? { ...s.wallet, balancePaise } : null,
    }));
  },

  prependTransaction: (txn) => {
    set((s) => ({ transactions: [txn, ...s.transactions] }));
  },

  appendTransactions: (list) => {
    set((s) => ({ transactions: [...s.transactions, ...list] }));
  },

  fetchWalletData: async () => {
    set({ isLoading: true });
    try {
      const [walletRes, txRes] = await Promise.all([
        walletApi.getWallet(),
        walletApi.getTransactions(),
      ]);
      set({
        wallet: walletRes.data.data,
        balancePaise: walletRes.data.data.balancePaise,
        transactions: txRes.data.data,
      });
    } catch (err) {
      console.error("[WalletStore] fetchWalletData failed:", err);
    } finally {
      set({ isLoading: false });
    }
  },

  topupWallet: async (amountPaise) => {
    set({ isTransacting: true });
    try {
      const orderRes = await walletApi.createTopupOrder(amountPaise);
      return orderRes.data.data;
    } catch (err) {
      console.error("[WalletStore] topupWallet failed:", err);
      throw err;
    } finally {
      set({ isTransacting: false });
    }
  },

  verifyTopupPayment: async (orderId, paymentId, signature) => {
    try {
      await walletApi.verifyTopup({ orderId, paymentId, signature });
      // Refresh wallet data after successful topup
      const [walletRes, txRes] = await Promise.all([
        walletApi.getWallet(),
        walletApi.getTransactions(),
      ]);
      set({
        wallet: walletRes.data.data,
        balancePaise: walletRes.data.data.balancePaise,
        transactions: txRes.data.data,
      });
    } catch (err) {
      console.error("[WalletStore] verifyTopupPayment failed:", err);
      throw err;
    }
  },

  fetchWithdrawals: async (committeeId?: string) => {
    try {
      const res = await walletApi.getWithdrawals({
        committeeId,
        limit: 50,
      });
      set({ withdrawals: res.data.data });
    } catch (err) {
      console.error("[WalletStore] fetchWithdrawals failed:", err);
    }
  },

  requestWithdrawal: async (committeeId, amountPaise, paymentMethodId) => {
    set({ isTransacting: true });
    try {
      const res = await walletApi.requestWithdrawal({
        committeeId,
        amount: amountPaise,
        paymentMethodId,
      });
      // Refresh wallet data after withdrawal request
      const [walletRes, txRes, wdRes] = await Promise.all([
        walletApi.getWallet(),
        walletApi.getTransactions(),
        walletApi.getWithdrawals(),
      ]);
      set({
        wallet: walletRes.data.data,
        balancePaise: walletRes.data.data.balancePaise,
        transactions: txRes.data.data,
        withdrawals: wdRes.data.data,
      });
      return res.data.data;
    } catch (err) {
      console.error("[WalletStore] requestWithdrawal failed:", err);
      throw err;
    } finally {
      set({ isTransacting: false });
    }
  },

  cancelWithdrawal: async (withdrawalId) => {
    set({ isTransacting: true });
    try {
      await walletApi.cancelWithdrawal(withdrawalId);
      // Refresh wallet + withdrawals after cancel
      const [walletRes, txRes, wdRes] = await Promise.all([
        walletApi.getWallet(),
        walletApi.getTransactions(),
        walletApi.getWithdrawals(),
      ]);
      set({
        wallet: walletRes.data.data,
        balancePaise: walletRes.data.data.balancePaise,
        transactions: txRes.data.data,
        withdrawals: wdRes.data.data,
      });
    } catch (err) {
      console.error("[WalletStore] cancelWithdrawal failed:", err);
      throw err;
    } finally {
      set({ isTransacting: false });
    }
  },

  reset: () => set({
    wallet: null, balancePaise: 0, transactions: [], withdrawals: [],
    isLoading: false, isTransacting: false, hasMore: false, pagination: defaultPagination,
  }),
}));
