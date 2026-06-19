// src/modules/wallet/__tests__/wallet-ledger.service.test.ts
// Unit tests for WalletLedgerService.

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── In-Memory Stores (per-table) ────────────────────────────────────

const tableStores: Map<string, any[]> = new Map();

function getStore(table: string): any[] {
  if (!tableStores.has(table)) tableStores.set(table, []);
  return tableStores.get(table)!;
}

let idSeq = 0;
let tsSeq = 0;

function nextId() {
  idSeq++;
  return `id-${idSeq}`;
}

function nextTs() {
  tsSeq++;
  const d = new Date("2026-01-01T00:00:00.000Z");
  d.setSeconds(tsSeq);
  return d.toISOString();
}

function resetStores() {
  tableStores.clear();
  idSeq = 0;
  tsSeq = 0;
}

// ─── Row-Level Lock Simulation ────────────────────────────────────────
// Simulates SELECT ... FOR UPDATE by providing a per-member+committee
// mutex that can be used in tests to serialize service method calls.
// This is needed because Supabase JS client doesn't support FOR UPDATE,
// and our in-memory mock can't simulate database-level row locking.

const walletMutexes: Map<string, { queue: Array<() => void>; locked: boolean }> = new Map();

async function withWalletLock<T>(
  memberId: string,
  committeeId: string,
  fn: () => Promise<T>
): Promise<T> {
  const key = `${memberId}:${committeeId}`;
  let m = walletMutexes.get(key);
  if (!m) {
    m = { queue: [], locked: false };
    walletMutexes.set(key, m);
  }
  if (m.locked) {
    await new Promise<void>((resolve) => m!.queue.push(resolve));
  }
  m.locked = true;
  try {
    return await fn();
  } finally {
    if (m.queue.length > 0) {
      const next = m.queue.shift()!;
      Promise.resolve().then(next);
    } else {
      m.locked = false;
    }
  }
}

// ─── Mock Supabase ────────────────────────────────────────────────────

function buildMock(table: string) {
  const state: any = {
    _filters: {},
    _filtersIn: {},
    _ltFilters: {},
    _order: null,
    _limit: null,
    _range: null,
    _single: false,
    _insertData: null,
    _updateData: null,
  };

  const chain: any = {};

  chain.eq = (col: string, val: any) => { state._filters[col] = val; return chain; };
  chain.in = (col: string, vals: any[]) => { state._filtersIn[col] = vals; return chain; };
  chain.lt = (col: string, val: any) => { state._ltFilters[col] = val; return chain; };
  chain.order = (col: string, opts: any) => { state._order = { col, asc: opts.ascending }; return chain; };
  chain.limit = (n: number) => { state._limit = n; return chain; };
  chain.range = (s: number, e: number) => { state._range = [s, e]; return chain; };
  chain.single = () => { state._single = true; return chain; };
  chain.select = () => chain;
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
        created_at: r.created_at || nextTs(),
      }));
      store.push(...inserted);
      return { data: state._single ? inserted[0] : inserted, error: null };
    }

    // UPDATE
    if (state._updateData) {
      let updated: any = null;
      for (let i = 0; i < store.length; i++) {
        const row = store[i];
        const match = Object.entries(state._filters).every(([k, v]) => row[k] === v);
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

    Object.entries(state._filters).forEach(([k, v]) => {
      rows = rows.filter((r) => r[k] === v);
    });
    Object.entries(state._filtersIn).forEach(([k, vals]: [string, any]) => {
      rows = rows.filter((r) => vals.includes(r[k]));
    });
    Object.entries(state._ltFilters).forEach(([k, v]: [string, any]) => {
      rows = rows.filter((r) => r[k] < v);
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

    if (state._single) {
      return rows[0]
        ? { data: rows[0], error: null }
        : { data: null, error: { code: "PGRST116", message: "not found" } };
    }

    return { data: rows, error: null };
  };

  // Make chain thenable so `await chain` triggers _exec()
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
const mockRpc = vi.fn();

vi.mock("../../../config/supabase", () => ({
  default: {
    from: (table: string) => mockFrom(table),
    rpc: (fn: string, params?: any) => mockRpc(fn, params),
  },
}));

// Expose stores for test assertions
(globalThis as any).__getTableStore = (table: string) => getStore(table);

import { WalletLedgerService } from "../wallet-ledger.service";
import {
  InsufficientBalanceError,
  LedgerEntryNotFoundError,
  ReversalNotAllowedError,
} from "../../../utils/errors";

// ─── Test Constants ───────────────────────────────────────────────────

const MEMBER = "member-001";
const COMMITTEE = "committee-001";

// ─── Tests ────────────────────────────────────────────────────────────

describe("WalletLedgerService", () => {
  beforeEach(() => {
    resetStores();
    walletMutexes.clear();
    mockRpc.mockImplementation((fn: string, params: any) => {
      if (fn === "refresh_wallet_balance_cache") return Promise.resolve({ error: null });
      if (fn === "recalculate_balance") {
        const pMemberId = params?.p_member_id;
        const pCommitteeId = params?.p_committee_id;
        const store = getStore("wallet_ledger_entries");
        const entries = store.filter(
          (e: any) =>
            e.member_id === pMemberId &&
            e.committee_id === pCommitteeId &&
            e.status === "confirmed"
        );
        const trueBalance = entries.reduce(
          (sum: number, e: any) =>
            e.direction === "credit" ? sum + Number(e.amount) : sum - Number(e.amount),
          0
        );
        const pendingDebits = entries
          .filter((e: any) => e.direction === "debit" && e.entry_type === "withdrawal_debit")
          .reduce((sum: number, e: any) => sum + Number(e.amount), 0);
        return Promise.resolve({
          data: [{ true_balance: trueBalance, pending_debits: pendingDebits }],
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });
  });

  // ─── creditWallet ─────────────────────────────────────────────────────

  describe("creditWallet", () => {
    it("credits wallet and returns entry with correct balance_after", async () => {
      const entry = await WalletLedgerService.creditWallet({
        memberId: MEMBER,
        committeeId: COMMITTEE,
        amount: 5000,
        entryType: "contribution_made",
        idempotencyKey: "ck-1",
      });

      expect(entry).toBeDefined();
      expect(entry.direction).toBe("credit");
      expect(entry.amount).toBe(5000);
      expect(entry.balance_after).toBe(5000);
      expect(entry.status).toBe("confirmed");
    });

    it("accumulates balance across multiple credits", async () => {
      await WalletLedgerService.creditWallet({
        memberId: MEMBER, committeeId: COMMITTEE,
        amount: 3000, entryType: "contribution_made", idempotencyKey: "ck-a",
      });

      const second = await WalletLedgerService.creditWallet({
        memberId: MEMBER, committeeId: COMMITTEE,
        amount: 7000, entryType: "distribution_credit", idempotencyKey: "ck-b",
      });

      expect(second.balance_after).toBe(10000);
    });

    it("rejects zero amount", async () => {
      await expect(
        WalletLedgerService.creditWallet({
          memberId: MEMBER, committeeId: COMMITTEE,
          amount: 0, entryType: "contribution_made", idempotencyKey: "ck-zero",
        })
      ).rejects.toThrow("Credit amount must be positive");
    });

    it("rejects negative amount", async () => {
      await expect(
        WalletLedgerService.creditWallet({
          memberId: MEMBER, committeeId: COMMITTEE,
          amount: -100, entryType: "contribution_made", idempotencyKey: "ck-neg",
        })
      ).rejects.toThrow("Credit amount must be positive");
    });
  });

  // ─── Idempotency ──────────────────────────────────────────────────────

  describe("idempotency", () => {
    it("returns existing entry on duplicate idempotencyKey", async () => {
      const first = await WalletLedgerService.creditWallet({
        memberId: MEMBER, committeeId: COMMITTEE,
        amount: 5000, entryType: "contribution_made", idempotencyKey: "idem-1",
      });

      const second = await WalletLedgerService.creditWallet({
        memberId: MEMBER, committeeId: COMMITTEE,
        amount: 5000, entryType: "contribution_made", idempotencyKey: "idem-1",
      });

      expect(second.id).toBe(first.id);
      expect(second.amount).toBe(first.amount);
    });

    it("does not duplicate ledger entries for same idempotencyKey", async () => {
      await WalletLedgerService.creditWallet({
        memberId: MEMBER, committeeId: COMMITTEE,
        amount: 5000, entryType: "contribution_made", idempotencyKey: "idem-2",
      });

      await WalletLedgerService.creditWallet({
        memberId: MEMBER, committeeId: COMMITTEE,
        amount: 5000, entryType: "contribution_made", idempotencyKey: "idem-2",
      });

      const entries = getStore("wallet_ledger_entries").filter((e: any) => e.idempotency_key === "idem-2");
      expect(entries).toHaveLength(1);
    });

    it("creates separate entries for different idempotencyKeys", async () => {
      await WalletLedgerService.creditWallet({
        memberId: MEMBER, committeeId: COMMITTEE,
        amount: 5000, entryType: "contribution_made", idempotencyKey: "key-aaa",
      });

      await WalletLedgerService.creditWallet({
        memberId: MEMBER, committeeId: COMMITTEE,
        amount: 5000, entryType: "contribution_made", idempotencyKey: "key-bbb",
      });

      const entries = getStore("wallet_ledger_entries").filter(
        (e: any) => e.idempotency_key === "key-aaa" || e.idempotency_key === "key-bbb"
      );
      expect(entries).toHaveLength(2);
    });
  });

  // ─── debitWallet ──────────────────────────────────────────────────────

  describe("debitWallet", () => {
    it("debits wallet and reduces balance", async () => {
      await WalletLedgerService.creditWallet({
        memberId: MEMBER, committeeId: COMMITTEE,
        amount: 10000, entryType: "contribution_made", idempotencyKey: "dc-1",
      });

      const entry = await WalletLedgerService.debitWallet({
        memberId: MEMBER, committeeId: COMMITTEE,
        amount: 4000, entryType: "withdrawal_debit", idempotencyKey: "dd-1",
      });

      expect(entry.direction).toBe("debit");
      expect(entry.amount).toBe(4000);
      expect(entry.balance_after).toBe(6000);
    });

    it("throws InsufficientBalanceError when debit exceeds balance", async () => {
      await WalletLedgerService.creditWallet({
        memberId: MEMBER, committeeId: COMMITTEE,
        amount: 5000, entryType: "contribution_made", idempotencyKey: "dc-2",
      });

      await expect(
        WalletLedgerService.debitWallet({
          memberId: MEMBER, committeeId: COMMITTEE,
          amount: 6000, entryType: "withdrawal_debit", idempotencyKey: "dd-2",
        })
      ).rejects.toThrow(InsufficientBalanceError);
    });

    it("throws InsufficientBalanceError on empty wallet", async () => {
      await expect(
        WalletLedgerService.debitWallet({
          memberId: MEMBER, committeeId: COMMITTEE,
          amount: 100, entryType: "withdrawal_debit", idempotencyKey: "dd-empty",
        })
      ).rejects.toThrow(InsufficientBalanceError);
    });

    it("rejects zero amount", async () => {
      await expect(
        WalletLedgerService.debitWallet({
          memberId: MEMBER, committeeId: COMMITTEE,
          amount: 0, entryType: "withdrawal_debit", idempotencyKey: "dd-zero",
        })
      ).rejects.toThrow("Debit amount must be positive");
    });

    it("does not create negative-balance entry on insufficient funds", async () => {
      await WalletLedgerService.creditWallet({
        memberId: MEMBER, committeeId: COMMITTEE,
        amount: 1000, entryType: "contribution_made", idempotencyKey: "dc-neg",
      });

      try {
        await WalletLedgerService.debitWallet({
          memberId: MEMBER, committeeId: COMMITTEE,
          amount: 2000, entryType: "withdrawal_debit", idempotencyKey: "dd-neg",
        });
      } catch { /* expected */ }

      const store = getStore("wallet_ledger_entries");
      const debits = store.filter(
        (e: any) => e.direction === "debit" && e.idempotency_key === "dd-neg"
      );
      expect(debits).toHaveLength(0);

      const last = store
        .filter((e: any) => e.member_id === MEMBER && e.status === "confirmed")
        .sort((a: any, b: any) => b.created_at.localeCompare(a.created_at))[0];
      expect(last?.balance_after).toBe(1000);
    });
  });

  // ─── reverseEntry ─────────────────────────────────────────────────────

  describe("reverseEntry", () => {
    it("reverses a confirmed credit entry", async () => {
      const credit = await WalletLedgerService.creditWallet({
        memberId: MEMBER, committeeId: COMMITTEE,
        amount: 8000, entryType: "bid_payout", idempotencyKey: "rv-1",
        notes: "Payout for month 1",
      });

      const reversal = await WalletLedgerService.reverseEntry({
        ledgerEntryId: credit.id,
        reason: "Payout failed — bank rejected",
        performedBy: "admin-001",
      });

      expect(reversal.direction).toBe("debit");
      expect(reversal.amount).toBe(8000);
      expect(reversal.status).toBe("confirmed");
      expect(reversal.notes).toContain("Reversal of entry");
      expect(reversal.notes).toContain("Payout failed");
    });

    it("reverses a confirmed debit entry", async () => {
      await WalletLedgerService.creditWallet({
        memberId: MEMBER, committeeId: COMMITTEE,
        amount: 10000, entryType: "contribution_made", idempotencyKey: "rv-dc",
      });

      const debit = await WalletLedgerService.debitWallet({
        memberId: MEMBER, committeeId: COMMITTEE,
        amount: 3000, entryType: "withdrawal_debit", idempotencyKey: "rv-dd",
      });

      const reversal = await WalletLedgerService.reverseEntry({
        ledgerEntryId: debit.id,
        reason: "Withdrawal cancelled by user",
        performedBy: "org-001",
      });

      expect(reversal.direction).toBe("credit");
      expect(reversal.amount).toBe(3000);
      expect(reversal.status).toBe("confirmed");
    });

    it("marks original entry as reversed", async () => {
      const credit = await WalletLedgerService.creditWallet({
        memberId: MEMBER, committeeId: COMMITTEE,
        amount: 5000, entryType: "distribution_credit", idempotencyKey: "rv-mark",
      });

      await WalletLedgerService.reverseEntry({
        ledgerEntryId: credit.id,
        reason: "Test reversal",
        performedBy: "admin-001",
      });

      const store = getStore("wallet_ledger_entries");
      const original = store.find((e: any) => e.id === credit.id);
      expect(original?.status).toBe("reversed");
    });

    it("logs to ledger_audit_log", async () => {
      const credit = await WalletLedgerService.creditWallet({
        memberId: MEMBER, committeeId: COMMITTEE,
        amount: 2000, entryType: "interest_charge", idempotencyKey: "rv-audit",
      });

      await WalletLedgerService.reverseEntry({
        ledgerEntryId: credit.id,
        reason: "Interest calculation was wrong",
        performedBy: "admin-002",
      });

      const auditStore = getStore("ledger_audit_log");
      const entry = auditStore.find((a: any) => a.ledger_entry_id === credit.id);
      expect(entry).toBeDefined();
      expect(entry?.action).toBe("reversed");
      expect(entry?.performed_by).toBe("admin-002");
      expect(entry?.reason).toBe("Interest calculation was wrong");
    });

    it("throws LedgerEntryNotFoundError for nonexistent entry", async () => {
      await expect(
        WalletLedgerService.reverseEntry({
          ledgerEntryId: "nonexistent",
          reason: "Test",
          performedBy: "admin-001",
        })
      ).rejects.toThrow(LedgerEntryNotFoundError);
    });

    it("throws ReversalNotAllowedError for already-reversed entry", async () => {
      const credit = await WalletLedgerService.creditWallet({
        memberId: MEMBER, committeeId: COMMITTEE,
        amount: 1000, entryType: "contribution_made", idempotencyKey: "rv-double",
      });

      await WalletLedgerService.reverseEntry({
        ledgerEntryId: credit.id,
        reason: "First reversal",
        performedBy: "admin-001",
      });

      await expect(
        WalletLedgerService.reverseEntry({
          ledgerEntryId: credit.id,
          reason: "Double reversal attempt",
          performedBy: "admin-001",
        })
      ).rejects.toThrow(ReversalNotAllowedError);
    });
  });

  // ─── getWalletSummary ─────────────────────────────────────────────────

  describe("getWalletSummary", () => {
    it("returns correct summary after credits and debits", async () => {
      await WalletLedgerService.creditWallet({
        memberId: MEMBER, committeeId: COMMITTEE,
        amount: 10000, entryType: "contribution_made", idempotencyKey: "sm-1",
      });

      await WalletLedgerService.debitWallet({
        memberId: MEMBER, committeeId: COMMITTEE,
        amount: 3000, entryType: "withdrawal_debit", idempotencyKey: "sm-2",
      });

      const summary = await WalletLedgerService.getWalletSummary(MEMBER, COMMITTEE);

      expect(summary.totalBalance).toBe(7000);
      expect(summary.lastTransactionAt).toBeDefined();
    });

    it("returns zero balance for new member", async () => {
      const summary = await WalletLedgerService.getWalletSummary("new-member", COMMITTEE);

      expect(summary.totalBalance).toBe(0);
      expect(summary.availableForWithdrawal).toBe(0);
      expect(summary.lockedBalance).toBe(0);
      expect(summary.lastTransactionAt).toBeNull();
    });
  });

  // ─── getLedgerHistory ─────────────────────────────────────────────────

  describe("getLedgerHistory", () => {
    it("returns entries newest first with running balance", async () => {
      await WalletLedgerService.creditWallet({
        memberId: MEMBER, committeeId: COMMITTEE,
        amount: 1000, entryType: "contribution_made", idempotencyKey: "lh-1",
      });

      await WalletLedgerService.creditWallet({
        memberId: MEMBER, committeeId: COMMITTEE,
        amount: 2000, entryType: "distribution_credit", idempotencyKey: "lh-2",
      });

      await WalletLedgerService.debitWallet({
        memberId: MEMBER, committeeId: COMMITTEE,
        amount: 500, entryType: "withdrawal_debit", idempotencyKey: "lh-3",
      });

      const result = await WalletLedgerService.getLedgerHistory(MEMBER, COMMITTEE);

      expect(result.entries).toHaveLength(3);
      expect(result.hasMore).toBe(false);

      // Newest first: debit(2500) → credit(3000) → credit(1000)
      expect(result.entries[0].runningBalance).toBe(2500);
      expect(result.entries[1].runningBalance).toBe(3000);
      expect(result.entries[2].runningBalance).toBe(1000);
    });

    it("paginates correctly", async () => {
      for (let i = 1; i <= 5; i++) {
        await WalletLedgerService.creditWallet({
          memberId: MEMBER, committeeId: COMMITTEE,
          amount: i * 1000, entryType: "contribution_made", idempotencyKey: `pg-${i}`,
        });
      }

      const page1 = await WalletLedgerService.getLedgerHistory(MEMBER, COMMITTEE, { limit: 2 });
      expect(page1.entries).toHaveLength(2);
      expect(page1.hasMore).toBe(true);
      expect(page1.nextCursor).toBeDefined();

      const page2 = await WalletLedgerService.getLedgerHistory(MEMBER, COMMITTEE, {
        limit: 2, afterCursor: page1.nextCursor!,
      });
      expect(page2.entries).toHaveLength(2);
      expect(page2.hasMore).toBe(true);

      const page3 = await WalletLedgerService.getLedgerHistory(MEMBER, COMMITTEE, {
        limit: 2, afterCursor: page2.nextCursor!,
      });
      expect(page3.entries).toHaveLength(1);
      expect(page3.hasMore).toBe(false);
    });
  });

  // ─── Concurrent credits (race condition) ──────────────────────────────

  describe("concurrent credits", () => {
    it("handles multiple simultaneous credits without corruption", async () => {
      const promises = Array.from({ length: 10 }, (_, i) =>
        withWalletLock(MEMBER, COMMITTEE, () =>
          WalletLedgerService.creditWallet({
            memberId: MEMBER, committeeId: COMMITTEE,
            amount: 1000, entryType: "contribution_made", idempotencyKey: `cc-${i}`,
          })
        )
      );

      const results = await Promise.all(promises);
      expect(results).toHaveLength(10);

      const store = getStore("wallet_ledger_entries");
      const last = store
        .filter((e: any) => e.member_id === MEMBER && e.status === "confirmed")
        .sort((a: any, b: any) => b.created_at.localeCompare(a.created_at))[0];

      expect(last?.balance_after).toBe(10000);
    });

    it("does not allow concurrent debits to overdraw", async () => {
      await WalletLedgerService.creditWallet({
        memberId: MEMBER, committeeId: COMMITTEE,
        amount: 5000, entryType: "contribution_made", idempotencyKey: "cd-credit",
      });

      const promises = Array.from({ length: 3 }, (_, i) =>
        withWalletLock(MEMBER, COMMITTEE, () =>
          WalletLedgerService.debitWallet({
            memberId: MEMBER, committeeId: COMMITTEE,
            amount: 3000, entryType: "withdrawal_debit", idempotencyKey: `cd-debit-${i}`,
          })
        ).catch((err) => err)
      );

      const results = await Promise.all(promises);
      const successes = results.filter((r) => !(r instanceof Error));
      const failures = results.filter((r) => r instanceof InsufficientBalanceError);

      expect(successes.length).toBeLessThanOrEqual(1);
      expect(failures.length).toBeGreaterThanOrEqual(2);

      const store = getStore("wallet_ledger_entries");
      const last = store
        .filter((e: any) => e.member_id === MEMBER && e.status === "confirmed")
        .sort((a: any, b: any) => b.created_at.localeCompare(a.created_at))[0];

      expect(last?.balance_after).toBeGreaterThanOrEqual(0);
    });
  });
});
