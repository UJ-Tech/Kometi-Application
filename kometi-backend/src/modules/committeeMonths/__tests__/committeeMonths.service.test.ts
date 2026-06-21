// src/modules/committeeMonths/__tests__/committeeMonths.service.test.ts
// Unit tests for resolveMonth wallet ledger integration + conservation verification.

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoisted Mock Objects (available before vi.mock hoisting) ─────────

const { ledgerStore, mockFrom, mockRpc, mockPrisma } = vi.hoisted(() => {
  const ledgerStore: any[] = [];

  // Registry of pre-configured table responses keyed by `${table}:${op}`.
  // setupMocks() populates this; mockFrom._exec reads from it.
  const tableData: Record<string, any> = {};

  const mockFrom = vi.fn((table: string) => {
    const state: any = {
      _filters: {},
      _filtersIn: {},
      _insertData: null,
      _updateData: null,
      _upsertData: null,
      _single: false,
      _op: "select",
    };

    const chain: any = {};

    chain.eq = (col: string, val: any) => { state._filters[col] = val; return chain; };
    chain.in = (col: string, vals: any[]) => { state._filtersIn[col] = vals; return chain; };
    chain.single = () => { state._single = true; return chain; };
    chain.select = () => { state._op = "select"; return chain; };
    chain.insert = (data: any) => { state._op = "insert"; state._insertData = data; return chain; };
    chain.update = (data: any) => { state._op = "update"; state._updateData = data; return chain; };
    chain.upsert = (data: any, _opts?: any) => { state._op = "upsert"; state._upsertData = data; return chain; };

    chain._exec = () => {
      // wallet_ledger_entries: managed by ledgerStore
      if (table === "wallet_ledger_entries" && state._op === "insert") {
        const row = {
          id: `ledger-${ledgerStore.length + 1}`,
          ...state._insertData,
          created_at: new Date().toISOString(),
        };
        ledgerStore.push(row);
        return { data: state._single ? row : [row], error: null };
      }

      // wallet_balances_cache
      if (table === "wallet_balances_cache") {
        return { data: null, error: null };
      }

      // Read from ledgerStore for wallet queries
      if (!state._insertData && !state._updateData && !state._upsertData) {
        let rows = [...ledgerStore];
        Object.entries(state._filters).forEach(([k, v]) => {
          rows = rows.filter((r) => r[k] === v);
        });
        Object.entries(state._filtersIn).forEach(([k, vals]: [string, any]) => {
          rows = rows.filter((r) => vals.includes(r[k]));
        });
        if (state._single) {
          return rows[0]
            ? { data: rows[0], error: null }
            : { data: null, error: { code: "PGRST116", message: "not found" } };
        }
        return { data: rows, error: null };
      }

      // For inserts/updates/upserts on non-ledger tables, return from tableData
      if (state._op === "insert" || state._op === "update" || state._op === "upsert") {
        return { data: null, error: null };
      }

      return { data: null, error: null };
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
  });

  const mockRpc = vi.fn().mockResolvedValue({ data: null, error: null });

  const mockPrisma = {
    $transaction: vi.fn(async (fn: any) => fn(mockPrisma)),
  };

  return { ledgerStore, mockFrom, mockRpc, tableData, mockPrisma };
});

vi.mock("../../../config/supabase", () => ({
  default: {
    from: (table: string) => mockFrom(table),
    rpc: (fn: string, params?: any) => mockRpc(fn, params),
  },
}));

vi.mock("../../../config/database", () => ({
  default: mockPrisma,
}));

// ─── Import After Mocks ──────────────────────────────────────────────

import { CommitteeMonthsService } from "../committeeMonths.service";
import {
  calculateMonthSummary,
} from "../../../utils/committeeCalculations";

// ─── Test Constants ──────────────────────────────────────────────────

const COMMITTEE_ID = "committee-1";
const MONTH_ID = "month-1";
const MONTH_NUMBER = 3;
const WINNER_ID = "member-winner";
const TOTAL_MEMBERS = 30;
const INSTALLMENT = 10_000;

// ─── Helpers ─────────────────────────────────────────────────────────

function makeMonth(overrides: any = {}) {
  return {
    id: MONTH_ID,
    committee_id: COMMITTEE_ID,
    month_number: MONTH_NUMBER,
    total_pool: TOTAL_MEMBERS * INSTALLMENT,
    status: "bidding_open",
    resolution_type: "bid_auction",
    ...overrides,
  };
}

function makeCommittee(overrides: any = {}) {
  return {
    id: COMMITTEE_ID,
    totalSlots: TOTAL_MEMBERS,
    installmentAmountPaise: INSTALLMENT,
    organizerId: "organiser-1",
    ...overrides,
  };
}

function makeBid(memberId: string, bidAmount: number, overrides: any = {}) {
  return {
    id: `bid-${memberId}`,
    member_id: memberId,
    bid_amount: bidAmount,
    status: "pending",
    month_id: MONTH_ID,
    ...overrides,
  };
}

function makeActiveMember(id: string, overrides: any = {}) {
  return {
    id,
    userId: `user-${id}`,
    committeeId: COMMITTEE_ID,
    isActive: true,
    hasReceivedPayout: false,
    ...overrides,
  };
}

/** Create TOTAL_MEMBERS active members with the given winner. */
function makeFullMemberList(winnerId = WINNER_ID) {
  const members = [];
  for (let i = 0; i < TOTAL_MEMBERS; i++) {
    const id = i === 0 ? winnerId : `member-${i}`;
    members.push(makeActiveMember(id, { hasReceivedPayout: id === winnerId }));
  }
  return members;
}

/**
 * Configure mockFrom chainable API to return proper Supabase-style responses.
 * The resolveMonth function makes ~15 sequential supabase.from() calls.
 * We intercept them by tracking call order and returning the right data per call.
 */
function setupMocks(members: any[], winningBid = 50_000) {
  const month = makeMonth();
  const committee = makeCommittee();
  const bids = [makeBid(WINNER_ID, winningBid)];

  // Track calls to mockFrom so we can return context-appropriate responses
  mockFrom.mockImplementation((table: string) => {
    const state: any = {
      _filters: {},
      _filtersIn: {},
      _insertData: null,
      _updateData: null,
      _upsertData: null,
      _single: false,
      _op: "select",
    };

    const chain: any = {};
    chain.eq = (col: string, val: any) => { state._filters[col] = val; return chain; };
    chain.in = (col: string, vals: any[]) => { state._filtersIn[col] = vals; return chain; };
    chain.single = () => { state._single = true; return chain; };
    chain.select = () => { state._op = "select"; return chain; };
    chain.insert = (data: any) => { state._op = "insert"; state._insertData = data; return chain; };
    chain.update = (data: any) => { state._op = "update"; state._updateData = data; return chain; };
    chain.upsert = (data: any, _opts?: any) => { state._op = "upsert"; state._upsertData = data; return chain; };

    chain._exec = () => {

      // Wallet ledger entries — insert
      if (table === "wallet_ledger_entries" && state._op === "insert") {
        const row = {
          id: `ledger-${ledgerStore.length + 1}`,
          ...state._insertData,
          created_at: new Date().toISOString(),
        };
        ledgerStore.push(row);
        return { data: state._single ? row : [row], error: null };
      }

      // Wallet ledger entries — select (used by verifyMonthLedgerIntegrity)
      if (table === "wallet_ledger_entries" && state._op === "select") {
        let rows = [...ledgerStore];
        Object.entries(state._filters).forEach(([k, v]) => {
          rows = rows.filter((r) => r[k] === v);
        });
        Object.entries(state._filtersIn).forEach(([k, vals]: [string, any]) => {
          rows = rows.filter((r) => vals.includes(r[k]));
        });
        if (state._single) {
          return rows[0]
            ? { data: rows[0], error: null }
            : { data: null, error: { code: "PGRST116", message: "not found" } };
        }
        return { data: rows, error: null };
      }

      // Wallet balances cache
      if (table === "wallet_balances_cache") {
        return { data: null, error: null };
      }

      // Updates / upserts — no-op
      if (state._op === "update" || state._op === "upsert") {
        return { data: null, error: null };
      }

      // SELECT queries — return data based on table and call context
      if (table === "committee_months") {
        return { data: month, error: null };
      }
      if (table === "committees") {
        return { data: committee, error: null };
      }
      if (table === "bids") {
        return { data: bids, error: null };
      }
      if (table === "committee_members") {
        // If filtering by isActive, return member list
        if (state._filters["isActive"] === true || state._filters["isActive"] === "true" || state._filters["isActive"] === "true") {
          return { data: members, error: null };
        }
        // If filtering by id (single member lookup)
        if (state._filters["id"]) {
          const found = members.find((m) => m.id === state._filters["id"]);
          return { data: found || null, error: found ? null : { code: "PGRST116", message: "not found" } };
        }
        return { data: members, error: null };
      }
      if (table === "fund_disbursements") {
        return { data: null, error: null };
      }
      if (table === "member_distributions") {
        return { data: null, error: null };
      }
      if (table === "member_payment_obligations") {
        return { data: null, error: null };
      }

      // Fallback for any other table
      return { data: null, error: null };
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
  });
}

/** Spy on WalletLedgerService so that mock implementations also insert into ledgerStore. */
async function setupLedgerSpies() {
  const { WalletLedgerService } = await import("../../wallet/wallet-ledger.service");

  const creditSpy = vi.spyOn(WalletLedgerService, "creditWallet");
  creditSpy.mockImplementation(async (params: any) => {
    const entry = {
      id: `ledger-${ledgerStore.length + 1}`,
      member_id: params.memberId,
      committee_id: params.committeeId,
      entry_type: params.entryType,
      amount: params.amount,
      direction: "credit",
      reference_type: params.referenceType || null,
      reference_id: params.referenceId || null,
      status: "confirmed",
      idempotency_key: params.idempotencyKey,
      created_by: params.createdBy || "system",
      created_at: new Date().toISOString(),
      notes: params.notes || null,
    };
    ledgerStore.push(entry);
    return entry as any;
  });

  const debitSpy = vi.spyOn(WalletLedgerService, "debitWallet");
  debitSpy.mockImplementation(async (params: any) => {
    const entry = {
      id: `ledger-${ledgerStore.length + 1}`,
      member_id: params.memberId,
      committee_id: params.committeeId,
      entry_type: params.entryType,
      amount: params.amount,
      direction: "debit",
      reference_type: params.referenceType || null,
      reference_id: params.referenceId || null,
      status: "confirmed",
      idempotency_key: params.idempotencyKey,
      created_by: params.createdBy || "system",
      created_at: new Date().toISOString(),
      notes: params.notes || null,
    };
    ledgerStore.push(entry);
    return entry as any;
  });

  return { creditSpy, debitSpy };
}

/** Expected summary for the test constants. */
function expectedSummary(winningBid: number) {
  const remainingNonWinners = Math.max(TOTAL_MEMBERS - (MONTH_NUMBER - 1), 1);
  return calculateMonthSummary({
    committeeId: COMMITTEE_ID,
    monthNumber: MONTH_NUMBER,
    totalMembers: TOTAL_MEMBERS,
    contributionPerPerson: INSTALLMENT,
    interestRatePercent: 2,
    winningBidAmount: winningBid,
    winnerId: WINNER_ID,
    resolutionType: "bid_auction",
    contributions: Array.from({ length: TOTAL_MEMBERS }, (_, i) => ({
      memberId: `_placeholder_${i + 1}`,
      amountDue: INSTALLMENT,
      amountPaid: INSTALLMENT,
      lateFeeAmount: 0,
      weeksLate: 0,
      status: "paid" as const,
    })),
    remainingNonWinners,
  });
}

// ─── Tests ───────────────────────────────────────────────────────────

describe("resolveMonth — Wallet Ledger Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ledgerStore.length = 0;
  });

  it("does NOT credit winner with bid_payout on resolution (deferred payout)", async () => {
    const members = makeFullMemberList();
    setupMocks(members);
    const { creditSpy } = await setupLedgerSpies();

    await CommitteeMonthsService.resolveMonth(COMMITTEE_ID, MONTH_ID);

    const winnerUserId = `user-${WINNER_ID}`;

    // No bid_payout credit on resolution — payout is deferred until all obligations settled
    const payoutCredit = creditSpy.mock.calls.find(
      (c) => c[0].entryType === "bid_payout" && c[0].memberId === winnerUserId
    );
    expect(payoutCredit).toBeUndefined();
  });

  it("interest is embedded in winnerNetReceivable (no separate interest_charge ledger entry)", async () => {
    const members = makeFullMemberList();
    setupMocks(members);
    const { debitSpy } = await setupLedgerSpies();

    await CommitteeMonthsService.resolveMonth(COMMITTEE_ID, MONTH_ID);

    const summary = expectedSummary(50_000);

    // In the netted flow, interest is NOT a separate debit — it's baked into winnerNetReceivable
    const interestCharges = debitSpy.mock.calls.filter(
      (c) => c[0].entryType === "interest_charge"
    );
    expect(interestCharges).toHaveLength(0);

    // Verify the interest is reflected in the summary
    expect(summary.interestAmount).toBeGreaterThan(0);
    // The winnerNetReceivable already accounts for interest deduction
    expect(summary.winnerNetReceivable).toBeLessThan(50_000);
  });

  it("creates payment obligations for all members", async () => {
    const members = makeFullMemberList();
    setupMocks(members);
    await setupLedgerSpies();

    const result = await CommitteeMonthsService.resolveMonth(COMMITTEE_ID, MONTH_ID);

    expect(result.obligations).toBeDefined();
    expect(result.obligations.length).toBe(TOTAL_MEMBERS);

    // Winner should have a "receive" obligation
    const winnerObl = result.obligations.find((o: any) => o.role === "winner");
    expect(winnerObl).toBeDefined();
    expect(winnerObl!.direction).toBe("receive");

    // Non-winners should have "pay" obligations
    const nonWinnerObls = result.obligations.filter((o: any) => o.role === "non_winner");
    expect(nonWinnerObls.length).toBe(TOTAL_MEMBERS - 1);
    for (const obl of nonWinnerObls) {
      expect(obl.direction).toBe("pay");
    }
  });

  it("passes correct idempotency keys for all ledger operations", async () => {
    const members = makeFullMemberList();
    setupMocks(members);
    const { creditSpy, debitSpy } = await setupLedgerSpies();

    await CommitteeMonthsService.resolveMonth(COMMITTEE_ID, MONTH_ID);

    for (const call of creditSpy.mock.calls) {
      expect(call[0].idempotencyKey).toBeTruthy();
      expect(call[0].createdBy).toBe("system");
    }
    for (const call of debitSpy.mock.calls) {
      expect(call[0].idempotencyKey).toBeTruthy();
      expect(call[0].createdBy).toBe("system");
    }
  });
});

describe("resolveMonth — Conservation Verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ledgerStore.length = 0;
  });

  it("verifies total credits equals total debits (conservation check)", async () => {
    const members = makeFullMemberList();
    setupMocks(members);
    const { creditSpy, debitSpy } = await setupLedgerSpies();

    await CommitteeMonthsService.resolveMonth(COMMITTEE_ID, MONTH_ID);

    let totalCredits = 0;
    let totalDebits = 0;
    for (const call of creditSpy.mock.calls) totalCredits += call[0].amount;
    for (const call of debitSpy.mock.calls) totalDebits += call[0].amount;

    // No wallet credits on resolution — winner gets paid only after all obligations settled
    // Non-winners pay later via payment obligations, not through wallet ledger
    expect(totalCredits).toBe(0);
    expect(totalDebits).toBe(0);
  });

  it("winner wallet has zero net change on resolution (deferred payout)", async () => {
    const members = makeFullMemberList();
    setupMocks(members);
    const { creditSpy, debitSpy } = await setupLedgerSpies();

    await CommitteeMonthsService.resolveMonth(COMMITTEE_ID, MONTH_ID);

    const winnerUserId = `user-${WINNER_ID}`;

    const winnerCredits = creditSpy.mock.calls
      .filter((c) => c[0].memberId === winnerUserId)
      .reduce((sum, c) => sum + c[0].amount, 0);

    const winnerDebits = debitSpy.mock.calls
      .filter((c) => c[0].memberId === winnerUserId)
      .reduce((sum, c) => sum + c[0].amount, 0);

    // Winner is NOT credited on resolution — payout is deferred until all obligations settled
    expect(winnerCredits).toBe(0);
    expect(winnerDebits).toBe(0);
  });

  it("non-winner members have zero net wallet change (they pay later)", async () => {
    const members = makeFullMemberList();
    setupMocks(members);
    const { creditSpy, debitSpy } = await setupLedgerSpies();

    await CommitteeMonthsService.resolveMonth(COMMITTEE_ID, MONTH_ID);

    for (const member of members) {
      if (member.id === WINNER_ID) continue;

      const memberCredits = creditSpy.mock.calls
        .filter((c) => c[0].memberId === member.userId)
        .reduce((sum, c) => sum + c[0].amount, 0);

      const memberDebits = debitSpy.mock.calls
        .filter((c) => c[0].memberId === member.userId)
        .reduce((sum, c) => sum + c[0].amount, 0);

      // Non-winners don't get wallet entries at resolution — they pay via obligations
      expect(memberCredits).toBe(0);
      expect(memberDebits).toBe(0);
    }
  });

  it("verifyMonthLedgerIntegrity detects imbalance", async () => {
    ledgerStore.push(
      { id: "l1", committee_id: COMMITTEE_ID, reference_type: "committee_months", reference_id: MONTH_ID, direction: "credit", amount: 100_000, status: "confirmed" },
      { id: "l2", committee_id: COMMITTEE_ID, reference_type: "committee_months", reference_id: MONTH_ID, direction: "debit", amount: 80_000, status: "confirmed" }
    );

    const result = await CommitteeMonthsService.verifyMonthLedgerIntegrity(COMMITTEE_ID, MONTH_ID);
    expect(result.imbalance).toBe(20_000);
    expect(result.totalCredits).toBe(100_000);
    expect(result.totalDebits).toBe(80_000);
    expect(result.entryCount).toBe(2);
  });

  it("verifyMonthLedgerIntegrity passes when balanced", async () => {
    ledgerStore.push(
      { id: "l1", committee_id: COMMITTEE_ID, reference_type: "committee_months", reference_id: MONTH_ID, direction: "credit", amount: 100_000, status: "confirmed" },
      { id: "l2", committee_id: COMMITTEE_ID, reference_type: "committee_months", reference_id: MONTH_ID, direction: "debit", amount: 100_000, status: "confirmed" }
    );

    const result = await CommitteeMonthsService.verifyMonthLedgerIntegrity(COMMITTEE_ID, MONTH_ID);
    expect(result.imbalance).toBe(0);
    expect(result.totalCredits).toBe(100_000);
    expect(result.totalDebits).toBe(100_000);
    expect(result.entryCount).toBe(2);
  });

  it("verifyMonthLedgerIntegrity returns zero when no entries found", async () => {
    const result = await CommitteeMonthsService.verifyMonthLedgerIntegrity(COMMITTEE_ID, MONTH_ID);
    expect(result.imbalance).toBe(0);
    expect(result.totalCredits).toBe(0);
    expect(result.totalDebits).toBe(0);
    expect(result.entryCount).toBe(0);
  });
});
