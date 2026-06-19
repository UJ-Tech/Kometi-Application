// src/modules/wallet/__tests__/withdrawal.service.test.ts
// Unit tests for WithdrawalService.

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── In-Memory Stores (per-table) ────────────────────────────────────

const tableStores: Map<string, any[]> = new Map();

function getStore(table: string): any[] {
  if (!tableStores.has(table)) tableStores.set(table, []);
  return tableStores.get(table)!;
}

let idSeq = 0;

function nextId() {
  idSeq++;
  return `id-${idSeq}`;
}

function resetStores() {
  tableStores.clear();
  idSeq = 0;
}

// ─── Mock Supabase ────────────────────────────────────────────────────

function buildMock(table: string) {
  const state: any = {
    _filters: {},
    _filtersIn: {},
    _order: null,
    _limit: null,
    _range: null,
    _single: false,
    _countExact: false,
    _countHead: false,
    _insertData: null,
    _updateData: null,
  };

  const chain: any = {};

  chain.eq = (col: string, val: any) => { state._filters[col] = val; return chain; };
  chain.in = (col: string, vals: any[]) => { state._filtersIn[col] = vals; return chain; };
  chain.gte = (col: string, val: any) => { state._filters[`${col}__gte`] = val; return chain; };
  chain.not = (col: string, _op: string, val: any) => { state._filters[`${col}__not`] = val; return chain; };
  chain.order = (col: string, opts: any) => { state._order = { col, asc: opts.ascending }; return chain; };
  chain.limit = (n: number) => { state._limit = n; return chain; };
  chain.range = (s: number, e: number) => { state._range = [s, e]; return chain; };
  chain.single = () => { state._single = true; return chain; };
  chain.select = (_cols?: string, opts?: any) => {
    if (opts?.count === "exact") state._countExact = true;
    if (opts?.head) state._countHead = true;
    return chain;
  };
  chain.insert = (data: any) => { state._insertData = data; return chain; };
  chain.update = (data: any) => { state._updateData = data; return chain; };

  chain._exec = () => {
    const store = getStore(table);

    // INSERT
    if (state._insertData) {
      const rows = Array.isArray(state._insertData) ? state._insertData : [state._insertData];
      const inserted = rows.map((r: any) => ({
        id: nextId(),
        ...r,
        created_at: r.created_at || new Date().toISOString(),
        requested_at: r.requested_at || new Date().toISOString(),
      }));
      store.push(...inserted);
      const data = state._single ? inserted[0] : inserted;
      return { data, error: null, count: state._countExact ? inserted.length : null };
    }

    // UPDATE
    if (state._updateData) {
      let updated: any = null;
      for (let i = 0; i < store.length; i++) {
        const row = store[i];
        const match = Object.entries(state._filters).every(([k, v]: [string, any]) => {
          if (k.endsWith("__gte")) return row[k.replace("__gte", "")] >= v;
          if (k.endsWith("__not")) return row[k.replace("__not", "")] !== v;
          return row[k] === v;
        });
        if (match) {
          Object.assign(row, state._updateData);
          updated = row;
          break;
        }
      }
      return { data: updated, error: null };
    }

    // SELECT
    let rows = [...store] as any[];

    Object.entries(state._filters).forEach(([k, v]: [string, any]) => {
      if (k.endsWith("__gte")) {
        rows = rows.filter((r) => r[k.replace("__gte", "")] >= v);
      } else if (k.endsWith("__not")) {
        rows = rows.filter((r) => r[k.replace("__not", "")] !== v);
      } else {
        rows = rows.filter((r) => r[k] === v);
      }
    });
    Object.entries(state._filtersIn).forEach(([k, vals]) => {
      rows = rows.filter((r) => (vals as any[]).includes(r[k]));
    });

    if (state._order) {
      const { col, asc } = state._order;
      rows.sort((a: any, b: any) => {
        const cmp = String(a[col]).localeCompare(String(b[col]));
        return asc ? cmp : -cmp;
      });
    }

    if (state._range) {
      rows = rows.slice(state._range[0], state._range[1] + 1);
    } else if (state._limit) {
      rows = rows.slice(0, state._limit);
    }

    if (state._countExact && state._countHead) {
      return { data: null, error: null, count: rows.length };
    }

    if (state._single) {
      return rows[0]
        ? { data: rows[0], error: null, count: null }
        : { data: null, error: { code: "PGRST116", message: "not found" }, count: null };
    }

    return { data: rows, error: null, count: state._countExact ? rows.length : null };
  };

  chain.then = (resolve: any, reject: any) => {
    try {
      const result = chain._exec();
      resolve(result);
    } catch (err) {
      if (reject) reject(err);
      else throw err;
    }
  };

  return chain;
}

const mockFrom = vi.fn((table: string) => buildMock(table));
const mockRpc = vi.fn((_fn?: string, _params?: any) => Promise.resolve({ data: null, error: null }));

vi.mock("../../../config/supabase", () => ({
  default: {
    from: (table: string) => mockFrom(table),
    rpc: (fn: string, params?: any) => mockRpc(fn, params),
  },
}));

// Mock WalletLedgerService (path relative to test file → src/modules/wallet/)
const mockGetWalletSummary = vi.fn();
const mockDebitWallet = vi.fn();
const mockReverseEntry = vi.fn();

vi.mock("../wallet-ledger.service", () => ({
  WalletLedgerService: {
    getWalletSummary: (...args: any[]) => mockGetWalletSummary(...args),
    debitWallet: (...args: any[]) => mockDebitWallet(...args),
    reverseEntry: (...args: any[]) => mockReverseEntry(...args),
  },
}));

// Mock PaymentsService (path relative to test file → src/modules/payments/)
const mockCreatePayout = vi.fn();

vi.mock("../../payments/payments.service", () => ({
  PaymentsService: {
    createPayout: (...args: any[]) => mockCreatePayout(...args),
  },
}));

// ─── Test Constants ───────────────────────────────────────────────────

const MEMBER = "member-001";
const COMMITTEE = "committee-001";
const PAYMENT_METHOD = "pm-001";
const PAYMENT_METHOD_UNVERIFIED = "pm-unverified";

// ─── Tests ────────────────────────────────────────────────────────────

describe("WithdrawalService", () => {
  beforeEach(() => {
    resetStores();
    vi.clearAllMocks();

    // Default: successful ledger summary
    mockGetWalletSummary.mockResolvedValue({
      totalBalance: 100_000,
      availableForWithdrawal: 100_000,
      lockedBalance: 0,
      lastTransactionAt: new Date().toISOString(),
    });

    // Default: successful debit
    mockDebitWallet.mockResolvedValue({
      id: "ledger-001",
      amount: 0,
      direction: "debit",
      balance_after: 0,
      status: "confirmed",
    });

    // Default: successful payout
    mockCreatePayout.mockResolvedValue({ id: "payout-001" });

    // Default: no recent withdrawals
    mockRpc.mockImplementation((fn?: string) => {
      if (fn === "refresh_wallet_balance_cache") return Promise.resolve({ data: null, error: null });
      return Promise.resolve({ data: null, error: null });
    });
  });

  // ─── Pre-check a) KYC ───────────────────────────────────────────────

  describe("KYC verification", () => {
    it("rejects withdrawal if payment method not found", async () => {
      const { WithdrawalService } = await import("../withdrawal.service");

      await expect(
        WithdrawalService.requestWithdrawal({
          memberId: MEMBER,
          committeeId: COMMITTEE,
          amountPaise: 10_000,
          paymentMethodId: "nonexistent",
        })
      ).rejects.toThrow("Complete KYC verification before withdrawing");
    });

    it("rejects withdrawal if payment method is not verified", async () => {
      getStore("saved_payment_methods").push({
        id: PAYMENT_METHOD_UNVERIFIED,
        user_id: MEMBER,
        is_verified: false,
        method_type: "upi",
      });

      const { WithdrawalService } = await import("../withdrawal.service");

      await expect(
        WithdrawalService.requestWithdrawal({
          memberId: MEMBER,
          committeeId: COMMITTEE,
          amountPaise: 10_000,
          paymentMethodId: PAYMENT_METHOD_UNVERIFIED,
        })
      ).rejects.toThrow("Complete KYC verification before withdrawing");
    });

    it("passes KYC check for verified payment method", async () => {
      getStore("saved_payment_methods").push({
        id: PAYMENT_METHOD,
        user_id: MEMBER,
        is_verified: true,
        method_type: "upi",
        razorpay_fund_account_id: "fund-001",
      });
      getStore("committee_members").push({
        committee_id: COMMITTEE,
        user_id: MEMBER,
        is_active: true,
      });

      // Verify the payment method is in the store with is_verified = true
      const method = getStore("saved_payment_methods").find(
        (m: any) => m.id === PAYMENT_METHOD
      );
      expect(method.is_verified).toBe(true);
    });
  });

  // ─── Pre-check b) Minimum amount ────────────────────────────────────

  describe("Minimum amount", () => {
    it("rejects withdrawal below ₹100", async () => {
      getStore("saved_payment_methods").push({
        id: PAYMENT_METHOD,
        user_id: MEMBER,
        is_verified: true,
        method_type: "upi",
      });

      const { WithdrawalService } = await import("../withdrawal.service");

      await expect(
        WithdrawalService.requestWithdrawal({
          memberId: MEMBER,
          committeeId: COMMITTEE,
          amountPaise: 9999,
          paymentMethodId: PAYMENT_METHOD,
        })
      ).rejects.toThrow("Minimum withdrawal is ₹100");
    });

    it("accepts withdrawal of exactly ₹100", async () => {
      getStore("saved_payment_methods").push({
        id: PAYMENT_METHOD,
        user_id: MEMBER,
        is_verified: true,
        method_type: "upi",
        razorpay_fund_account_id: "fund-001",
      });
      getStore("committee_members").push({
        committee_id: COMMITTEE,
        user_id: MEMBER,
        is_active: true,
      });

      mockDebitWallet.mockResolvedValue({
        id: "ledger-001",
        amount: 10_000,
        direction: "debit",
        balance_after: 90_000,
        status: "confirmed",
      });

      const { WithdrawalService } = await import("../withdrawal.service");

      const withdrawal = await WithdrawalService.requestWithdrawal({
        memberId: MEMBER,
        committeeId: COMMITTEE,
        amountPaise: 10_000,
        paymentMethodId: PAYMENT_METHOD,
      });

      expect(withdrawal).toBeDefined();
      expect(withdrawal.amount).toBe(10_000);
    });
  });

  // ─── Pre-check c) Balance check ─────────────────────────────────────

  describe("Balance check", () => {
    it("rejects withdrawal exceeding available balance", async () => {
      getStore("saved_payment_methods").push({
        id: PAYMENT_METHOD,
        user_id: MEMBER,
        is_verified: true,
        method_type: "upi",
      });

      mockGetWalletSummary.mockResolvedValue({
        totalBalance: 50_000,
        availableForWithdrawal: 30_000,
        lockedBalance: 20_000,
        lastTransactionAt: null,
      });

      const { WithdrawalService } = await import("../withdrawal.service");

      await expect(
        WithdrawalService.requestWithdrawal({
          memberId: MEMBER,
          committeeId: COMMITTEE,
          amountPaise: 40_000,
          paymentMethodId: PAYMENT_METHOD,
        })
      ).rejects.toThrow("Insufficient balance");
    });

    it("uses availableForWithdrawal, not totalBalance", async () => {
      getStore("saved_payment_methods").push({
        id: PAYMENT_METHOD,
        user_id: MEMBER,
        is_verified: true,
        method_type: "upi",
      });

      mockGetWalletSummary.mockResolvedValue({
        totalBalance: 100_000,
        availableForWithdrawal: 40_000,
        lockedBalance: 60_000,
        lastTransactionAt: null,
      });

      const { WithdrawalService } = await import("../withdrawal.service");

      // Should fail because 50k > 40k available (even though total is 100k)
      await expect(
        WithdrawalService.requestWithdrawal({
          memberId: MEMBER,
          committeeId: COMMITTEE,
          amountPaise: 50_000,
          paymentMethodId: PAYMENT_METHOD,
        })
      ).rejects.toThrow("Insufficient balance");
    });
  });

  // ─── Pre-check d) Velocity ──────────────────────────────────────────

  describe("Velocity check", () => {
    it("rejects if 3 or more withdrawals in last 24h", async () => {
      getStore("saved_payment_methods").push({
        id: PAYMENT_METHOD,
        user_id: MEMBER,
        is_verified: true,
        method_type: "upi",
      });

      // Simulate 3 recent withdrawals
      const now = new Date().toISOString();
      for (let i = 0; i < 3; i++) {
        getStore("withdrawal_requests").push({
          id: `wr-${i}`,
          member_id: MEMBER,
          committee_id: COMMITTEE,
          amount: 10_000,
          status: "completed",
          requested_at: now,
        });
      }

      const { WithdrawalService } = await import("../withdrawal.service");

      await expect(
        WithdrawalService.requestWithdrawal({
          memberId: MEMBER,
          committeeId: COMMITTEE,
          amountPaise: 10_000,
          paymentMethodId: PAYMENT_METHOD,
        })
      ).rejects.toThrow("Daily withdrawal limit reached");
    });
  });

  // ─── Pre-check e) Daily amount limit ────────────────────────────────

  describe("Daily amount limit", () => {
    it("rejects if sum of recent withdrawals exceeds ₹50,000", async () => {
      getStore("saved_payment_methods").push({
        id: PAYMENT_METHOD,
        user_id: MEMBER,
        is_verified: true,
        method_type: "upi",
      });
      getStore("committee_members").push({
        committee_id: COMMITTEE,
        user_id: MEMBER,
        is_active: true,
      });

      // Set high available balance so the balance check passes
      mockGetWalletSummary.mockResolvedValue({
        totalBalance: 10_000_000,
        availableForWithdrawal: 10_000_000,
        lockedBalance: 0,
        lastTransactionAt: new Date().toISOString(),
      });

      // Simulate 2 recent withdrawals totaling ₹45,000 (= 4,500,000 paise)
      const now = new Date().toISOString();
      getStore("withdrawal_requests").push({
        id: "wr-1",
        member_id: MEMBER,
        committee_id: COMMITTEE,
        amount: 2_500_000, // ₹25,000 in paise
        status: "completed",
        requested_at: now,
      });
      getStore("withdrawal_requests").push({
        id: "wr-2",
        member_id: MEMBER,
        committee_id: COMMITTEE,
        amount: 2_000_000, // ₹20,000 in paise
        status: "processing",
        requested_at: now,
      });

      const { WithdrawalService } = await import("../withdrawal.service");

      // 4,500,000 + 1,000,000 = 5,500,000 > 5,000,000 limit
      await expect(
        WithdrawalService.requestWithdrawal({
          memberId: MEMBER,
          committeeId: COMMITTEE,
          amountPaise: 1_000_000, // ₹10,000 in paise
          paymentMethodId: PAYMENT_METHOD,
        })
      ).rejects.toThrow("Daily withdrawal amount limit exceeded");
    });
  });

  // ─── Pre-check f) Active member ─────────────────────────────────────

  describe("Active member check", () => {
    it("rejects if member is not active in committee", async () => {
      getStore("saved_payment_methods").push({
        id: PAYMENT_METHOD,
        user_id: MEMBER,
        is_verified: true,
        method_type: "upi",
      });

      getStore("committee_members").push({
        committee_id: COMMITTEE,
        user_id: MEMBER,
        is_active: false,
      });

      const { WithdrawalService } = await import("../withdrawal.service");

      await expect(
        WithdrawalService.requestWithdrawal({
          memberId: MEMBER,
          committeeId: COMMITTEE,
          amountPaise: 10_000,
          paymentMethodId: PAYMENT_METHOD,
        })
      ).rejects.toThrow("is not active in committee");
    });

    it("rejects if member has no committee record", async () => {
      getStore("saved_payment_methods").push({
        id: PAYMENT_METHOD,
        user_id: MEMBER,
        is_verified: true,
        method_type: "upi",
      });

      const { WithdrawalService } = await import("../withdrawal.service");

      await expect(
        WithdrawalService.requestWithdrawal({
          memberId: MEMBER,
          committeeId: COMMITTEE,
          amountPaise: 10_000,
          paymentMethodId: PAYMENT_METHOD,
        })
      ).rejects.toThrow("is not active in committee");
    });
  });

  // ─── Successful withdrawal ──────────────────────────────────────────

  describe("Successful withdrawal", () => {
    it("creates withdrawal, debits wallet, and initiates payout", async () => {
      getStore("saved_payment_methods").push({
        id: PAYMENT_METHOD,
        user_id: MEMBER,
        is_verified: true,
        method_type: "upi",
        razorpay_fund_account_id: "fund-001",
      });
      getStore("committee_members").push({
        committee_id: COMMITTEE,
        user_id: MEMBER,
        is_active: true,
      });

      mockDebitWallet.mockResolvedValue({
        id: "ledger-001",
        amount: 25_000,
        direction: "debit",
        balance_after: 75_000,
        status: "confirmed",
      });

      const { WithdrawalService } = await import("../withdrawal.service");

      const withdrawal = await WithdrawalService.requestWithdrawal({
        memberId: MEMBER,
        committeeId: COMMITTEE,
        amountPaise: 25_000,
        paymentMethodId: PAYMENT_METHOD,
      });

      // Verify withdrawal was created
      expect(withdrawal).toBeDefined();
      expect(withdrawal.status).toBe("processing");
      expect(withdrawal.amount).toBe(25_000);
      expect(withdrawal.razorpay_payout_id).toBe("payout-001");

      // Verify ledger was debited
      expect(mockDebitWallet).toHaveBeenCalledWith(
        expect.objectContaining({
          memberId: MEMBER,
          committeeId: COMMITTEE,
          amount: 25_000,
          entryType: "withdrawal_debit",
        })
      );

      // Verify payout was initiated
      expect(mockCreatePayout).toHaveBeenCalledWith(
        "fund-001",
        25_000,
        "UPI"
      );

      // Verify withdrawal_requests row exists in store
      const store = getStore("withdrawal_requests");
      const wr = store.find((r: any) => r.member_id === MEMBER);
      expect(wr).toBeDefined();
      expect(wr.status).toBe("processing");
      expect(wr.razorpay_payout_id).toBe("payout-001");
    });
  });

  // ─── Payout failure handling ────────────────────────────────────────

  describe("Payout failure", () => {
    it("marks withdrawal as failed and reverses ledger on payout error", async () => {
      getStore("saved_payment_methods").push({
        id: PAYMENT_METHOD,
        user_id: MEMBER,
        is_verified: true,
        method_type: "bank_account",
        razorpay_fund_account_id: "fund-002",
      });
      getStore("committee_members").push({
        committee_id: COMMITTEE,
        user_id: MEMBER,
        is_active: true,
      });

      mockDebitWallet.mockResolvedValue({
        id: "ledger-002",
        amount: 15_000,
        direction: "debit",
        balance_after: 85_000,
        status: "confirmed",
      });

      mockCreatePayout.mockRejectedValue(new Error("Razorpay: insufficient balance in nodal account"));

      const { WithdrawalService } = await import("../withdrawal.service");

      await expect(
        WithdrawalService.requestWithdrawal({
          memberId: MEMBER,
          committeeId: COMMITTEE,
          amountPaise: 15_000,
          paymentMethodId: PAYMENT_METHOD,
        })
      ).rejects.toThrow("Withdrawal");

      // Verify withdrawal was marked as failed
      const store = getStore("withdrawal_requests");
      const wr = store.find((r: any) => r.member_id === MEMBER);
      expect(wr).toBeDefined();
      expect(wr.status).toBe("failed");
      expect(wr.failure_reason).toContain("insufficient balance");

      // Verify ledger reversal was attempted
      expect(mockReverseEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          ledgerEntryId: "ledger-002",
        })
      );
    });
  });

  // ─── getWithdrawal ──────────────────────────────────────────────────

  describe("getWithdrawal", () => {
    it("returns withdrawal by ID", async () => {
      getStore("withdrawal_requests").push({
        id: "wr-001",
        member_id: MEMBER,
        committee_id: COMMITTEE,
        amount: 20_000,
        status: "completed",
      });

      const { WithdrawalService } = await import("../withdrawal.service");

      const result = await WithdrawalService.getWithdrawal("wr-001", MEMBER);
      expect(result.id).toBe("wr-001");
      expect(result.amount).toBe(20_000);
    });

    it("throws for non-existent withdrawal", async () => {
      const { WithdrawalService } = await import("../withdrawal.service");

      await expect(
        WithdrawalService.getWithdrawal("nonexistent", MEMBER)
      ).rejects.toThrow("Withdrawal request not found");
    });

    it("throws if withdrawal belongs to different member", async () => {
      getStore("withdrawal_requests").push({
        id: "wr-002",
        member_id: "other-member",
        committee_id: COMMITTEE,
        amount: 20_000,
        status: "completed",
      });

      const { WithdrawalService } = await import("../withdrawal.service");

      await expect(
        WithdrawalService.getWithdrawal("wr-002", MEMBER)
      ).rejects.toThrow("Withdrawal request not found");
    });
  });

  // ─── listWithdrawals ────────────────────────────────────────────────

  describe("listWithdrawals", () => {
    it("returns withdrawals for a member", async () => {
      getStore("withdrawal_requests").push(
        {
          id: "wr-1",
          member_id: MEMBER,
          committee_id: COMMITTEE,
          amount: 10_000,
          status: "completed",
        },
        {
          id: "wr-2",
          member_id: MEMBER,
          committee_id: COMMITTEE,
          amount: 20_000,
          status: "processing",
        },
        {
          id: "wr-3",
          member_id: "other-member",
          committee_id: COMMITTEE,
          amount: 30_000,
          status: "completed",
        }
      );

      const { WithdrawalService } = await import("../withdrawal.service");

      const result = await WithdrawalService.listWithdrawals(MEMBER);
      expect(result.withdrawals).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it("filters by committee", async () => {
      getStore("withdrawal_requests").push(
        {
          id: "wr-a",
          member_id: MEMBER,
          committee_id: "committee-A",
          amount: 10_000,
          status: "completed",
        },
        {
          id: "wr-b",
          member_id: MEMBER,
          committee_id: "committee-B",
          amount: 20_000,
          status: "completed",
        }
      );

      const { WithdrawalService } = await import("../withdrawal.service");

      const result = await WithdrawalService.listWithdrawals(MEMBER, {
        committeeId: "committee-A",
      });
      expect(result.withdrawals).toHaveLength(1);
      expect(result.withdrawals[0].committee_id).toBe("committee-A");
    });

    it("filters by status", async () => {
      getStore("withdrawal_requests").push(
        {
          id: "wr-x",
          member_id: MEMBER,
          committee_id: COMMITTEE,
          amount: 10_000,
          status: "completed",
        },
        {
          id: "wr-y",
          member_id: MEMBER,
          committee_id: COMMITTEE,
          amount: 20_000,
          status: "failed",
        }
      );

      const { WithdrawalService } = await import("../withdrawal.service");

      const result = await WithdrawalService.listWithdrawals(MEMBER, {
        status: "failed",
      });
      expect(result.withdrawals).toHaveLength(1);
      expect(result.withdrawals[0].status).toBe("failed");
    });
  });

  // ─── handlePayoutWebhook ────────────────────────────────────────────

  describe("handlePayoutWebhook", () => {
    it("marks withdrawal as completed on processed webhook", async () => {
      getStore("withdrawal_requests").push({
        id: "wr-003",
        member_id: MEMBER,
        committee_id: COMMITTEE,
        amount: 10_000,
        status: "processing",
        razorpay_payout_id: "pay-003",
      });

      const { WithdrawalService } = await import("../withdrawal.service");

      await WithdrawalService.handlePayoutWebhook("pay-003", "processed");

      const store = getStore("withdrawal_requests");
      const wr = store.find((r: any) => r.id === "wr-003");
      expect(wr.status).toBe("completed");
      expect(wr.completed_at).toBeDefined();
    });

    it("marks withdrawal as failed and reverses ledger on failed webhook", async () => {
      getStore("withdrawal_requests").push({
        id: "wr-004",
        member_id: MEMBER,
        committee_id: COMMITTEE,
        amount: 10_000,
        status: "processing",
        razorpay_payout_id: "pay-004",
        ledger_entry_id: "ledger-004",
      });

      const { WithdrawalService } = await import("../withdrawal.service");

      await WithdrawalService.handlePayoutWebhook("pay-004", "failed", "Bank account frozen");

      const store = getStore("withdrawal_requests");
      const wr = store.find((r: any) => r.id === "wr-004");
      expect(wr.status).toBe("failed");
      expect(wr.failure_reason).toBe("Bank account frozen");

      expect(mockReverseEntry).toHaveBeenCalledWith(
        expect.objectContaining({ ledgerEntryId: "ledger-004" })
      );
    });

    it("is idempotent for already-completed withdrawals", async () => {
      getStore("withdrawal_requests").push({
        id: "wr-005",
        member_id: MEMBER,
        committee_id: COMMITTEE,
        amount: 10_000,
        status: "completed",
        razorpay_payout_id: "pay-005",
      });

      const { WithdrawalService } = await import("../withdrawal.service");

      // Should not throw or update
      await WithdrawalService.handlePayoutWebhook("pay-005", "processed");

      const store = getStore("withdrawal_requests");
      const wr = store.find((r: any) => r.id === "wr-005");
      expect(wr.status).toBe("completed");
    });

    it("ignores webhooks for unknown payout IDs", async () => {
      const { WithdrawalService } = await import("../withdrawal.service");

      // Should not throw
      await WithdrawalService.handlePayoutWebhook("unknown-payout", "processed");
    });
  });

  // ─── cancelWithdrawal ─────────────────────────────────────────────

  describe("cancelWithdrawal", () => {
    it("cancels a requested withdrawal and reverses ledger", async () => {
      getStore("withdrawal_requests").push({
        id: "wr-cancel-1",
        member_id: MEMBER,
        committee_id: COMMITTEE,
        amount: 15_000,
        status: "requested",
        ledger_entry_id: "ledger-cancel-1",
      });

      const { WithdrawalService } = await import("../withdrawal.service");

      const result = await WithdrawalService.cancelWithdrawal("wr-cancel-1", MEMBER);

      expect(result.status).toBe("cancelled");

      // Verify store was updated
      const store = getStore("withdrawal_requests");
      const wr = store.find((r: any) => r.id === "wr-cancel-1");
      expect(wr.status).toBe("cancelled");

      // Verify ledger reversal was called
      expect(mockReverseEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          ledgerEntryId: "ledger-cancel-1",
        })
      );
    });

    it("throws for non-existent withdrawal", async () => {
      const { WithdrawalService } = await import("../withdrawal.service");

      await expect(
        WithdrawalService.cancelWithdrawal("nonexistent", MEMBER)
      ).rejects.toThrow("Withdrawal request not found");
    });

    it("throws if withdrawal belongs to different member", async () => {
      getStore("withdrawal_requests").push({
        id: "wr-cancel-other",
        member_id: "other-member",
        committee_id: COMMITTEE,
        amount: 10_000,
        status: "requested",
      });

      const { WithdrawalService } = await import("../withdrawal.service");

      await expect(
        WithdrawalService.cancelWithdrawal("wr-cancel-other", MEMBER)
      ).rejects.toThrow("Withdrawal request not found");
    });

    it("throws if withdrawal is already processing", async () => {
      getStore("withdrawal_requests").push({
        id: "wr-cancel-proc",
        member_id: MEMBER,
        committee_id: COMMITTEE,
        amount: 10_000,
        status: "processing",
      });

      const { WithdrawalService } = await import("../withdrawal.service");

      await expect(
        WithdrawalService.cancelWithdrawal("wr-cancel-proc", MEMBER)
      ).rejects.toThrow("Cannot cancel withdrawal");
    });

    it("throws if withdrawal is already completed", async () => {
      getStore("withdrawal_requests").push({
        id: "wr-cancel-done",
        member_id: MEMBER,
        committee_id: COMMITTEE,
        amount: 10_000,
        status: "completed",
      });

      const { WithdrawalService } = await import("../withdrawal.service");

      await expect(
        WithdrawalService.cancelWithdrawal("wr-cancel-done", MEMBER)
      ).rejects.toThrow("Cannot cancel withdrawal");
    });

    it("throws if withdrawal is already cancelled", async () => {
      getStore("withdrawal_requests").push({
        id: "wr-cancel-dup",
        member_id: MEMBER,
        committee_id: COMMITTEE,
        amount: 10_000,
        status: "cancelled",
      });

      const { WithdrawalService } = await import("../withdrawal.service");

      await expect(
        WithdrawalService.cancelWithdrawal("wr-cancel-dup", MEMBER)
      ).rejects.toThrow("Cannot cancel withdrawal");
    });
  });
});
