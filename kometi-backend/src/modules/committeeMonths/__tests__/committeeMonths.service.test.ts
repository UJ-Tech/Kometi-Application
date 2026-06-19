// src/modules/committeeMonths/__tests__/committeeMonths.service.test.ts
// Unit tests for resolveMonth wallet ledger integration + conservation verification.

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoisted Mock Objects (available before vi.mock hoisting) ─────────

const { ledgerStore, mockFrom, mockRpc, mockPrisma } = vi.hoisted(() => {
  const ledgerStore: any[] = [];

  const mockFrom = vi.fn((table: string) => {
    const state: any = {
      _filters: {},
      _filtersIn: {},
      _insertData: null,
      _single: false,
    };

    const chain: any = {};

    chain.eq = (col: string, val: any) => { state._filters[col] = val; return chain; };
    chain.in = (col: string, vals: any[]) => { state._filtersIn[col] = vals; return chain; };
    chain.single = () => { state._single = true; return chain; };
    chain.select = () => chain;
    chain.insert = (data: any) => { state._insertData = data; return chain; };

    chain._exec = () => {
      if (table === "wallet_ledger_entries" && state._insertData) {
        const row = {
          id: `ledger-${ledgerStore.length + 1}`,
          ...state._insertData,
          created_at: new Date().toISOString(),
        };
        ledgerStore.push(row);
        return { data: state._single ? row : [row], error: null };
      }

      if (table === "wallet_balances_cache") {
        return { data: null, error: null };
      }

      if (!state._insertData) {
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
    committeeMonth: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    bid: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
      upsert: vi.fn(),
    },
    committeeMember: {
      findMany: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    monthlyContribution: {
      findMany: vi.fn(),
    },
    fundDisbursement: {
      create: vi.fn(),
    },
    memberDistribution: {
      upsert: vi.fn(),
    },
  };

  return { ledgerStore, mockFrom, mockRpc, mockPrisma };
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
import { InsufficientBalanceError, LedgerIntegrityError } from "../../../utils/errors";
import {
  calculateMonthlyInterest,
  calculateMaxBid,
  calculateMonthSummary,
} from "../../../utils/committeeCalculations";

// ─── Test Constants ──────────────────────────────────────────────────

const COMMITTEE_ID = "committee-1";
const MONTH_ID = "month-1";
const MONTH_NUMBER = 3;
const WINNER_ID = "member-winner";
const TOTAL_MEMBERS = 30;
const INSTALLMENT = 10_000;
const FEE_PCT = 5;

// ─── Helpers ─────────────────────────────────────────────────────────

function makeMonth(overrides: any = {}) {
  return {
    id: MONTH_ID,
    committeeId: COMMITTEE_ID,
    monthNumber: MONTH_NUMBER,
    totalPool: BigInt(TOTAL_MEMBERS * INSTALLMENT),
    status: "bidding_open",
    resolutionType: "bid_auction",
    committee: {
      totalSlots: TOTAL_MEMBERS,
      installmentAmountPaise: BigInt(INSTALLMENT),
      commissionRatePct: FEE_PCT,
    },
    ...overrides,
  };
}

function makeActiveMember(id: string, overrides: any = {}) {
  return {
    id,
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

function setupMocks(members: any[], winningBid = 50_000) {
  mockPrisma.committeeMonth.findUnique.mockResolvedValue(makeMonth());
  mockPrisma.bid.findMany.mockResolvedValue([
    { memberId: WINNER_ID, bidAmount: BigInt(winningBid), status: "pending" },
  ]);
  mockPrisma.committeeMember.findMany
    .mockResolvedValueOnce(members)
    .mockResolvedValueOnce(members);
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
  const totalPool = TOTAL_MEMBERS * INSTALLMENT;
  const remainingNonWinners = Math.max(TOTAL_MEMBERS - (MONTH_NUMBER - 1), 1);
  const interestAmount = calculateMonthlyInterest(TOTAL_MEMBERS, remainingNonWinners, INSTALLMENT);
  return {
    totalPool,
    remainingNonWinners,
    interestAmount,
    ...calculateMonthSummary({
      totalMembers: TOTAL_MEMBERS,
      remainingNonWinners,
      contributionPerPerson: INSTALLMENT,
      totalPool,
      winningBidAmount: winningBid,
      feePercent: FEE_PCT,
    }),
  };
}

// ─── Tests ───────────────────────────────────────────────────────────

describe("resolveMonth — Wallet Ledger Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ledgerStore.length = 0;
  });

  it("credits winner with bid_payout", async () => {
    const members = makeFullMemberList();
    setupMocks(members);
    const { creditSpy } = await setupLedgerSpies();

    await CommitteeMonthsService.resolveMonth(COMMITTEE_ID, MONTH_ID);

    const payoutCredit = creditSpy.mock.calls.find(
      (c) => c[0].entryType === "bid_payout" && c[0].memberId === WINNER_ID
    );
    expect(payoutCredit).toBeDefined();
    expect(payoutCredit![0].amount).toBe(50_000);
    expect(payoutCredit![0].idempotencyKey).toBe(`payout_${COMMITTEE_ID}_${MONTH_ID}`);
  });

  it("debts winner with interest_charge", async () => {
    const members = makeFullMemberList();
    setupMocks(members);
    const { debitSpy } = await setupLedgerSpies();

    await CommitteeMonthsService.resolveMonth(COMMITTEE_ID, MONTH_ID);

    const interestDebit = debitSpy.mock.calls.find(
      (c) => c[0].entryType === "interest_charge" && c[0].memberId === WINNER_ID
    );
    expect(interestDebit).toBeDefined();
    expect(interestDebit![0].idempotencyKey).toBe(`interest_${COMMITTEE_ID}_${MONTH_ID}`);
  });

  it("credits each active member with distribution_credit", async () => {
    const members = makeFullMemberList();
    setupMocks(members);
    const { creditSpy } = await setupLedgerSpies();

    await CommitteeMonthsService.resolveMonth(COMMITTEE_ID, MONTH_ID);

    const distCredits = creditSpy.mock.calls.filter(
      (c) => c[0].entryType === "distribution_credit"
    );
    expect(distCredits).toHaveLength(TOTAL_MEMBERS);

    for (const member of members) {
      const credit = distCredits.find((c) => c[0].memberId === member.id);
      expect(credit).toBeDefined();
      expect(credit![0].idempotencyKey).toBe(`dist_${COMMITTEE_ID}_${MONTH_ID}_${member.id}`);
    }
  });

  it("rolls back if interest debit throws InsufficientBalanceError", async () => {
    const members = makeFullMemberList();
    setupMocks(members);

    const { WalletLedgerService } = await import("../../wallet/wallet-ledger.service");
    vi.spyOn(WalletLedgerService, "creditWallet").mockImplementation(async (params: any) => {
      const entry = {
        id: `ledger-${ledgerStore.length + 1}`,
        member_id: params.memberId,
        committee_id: params.committeeId,
        entry_type: params.entryType,
        amount: params.amount,
        direction: "credit",
        reference_type: null,
        reference_id: null,
        status: "confirmed",
        idempotency_key: params.idempotencyKey,
        created_by: "system",
        created_at: new Date().toISOString(),
        notes: null,
      };
      ledgerStore.push(entry);
      return entry as any;
    });

    vi.spyOn(WalletLedgerService, "debitWallet").mockRejectedValue(
      new InsufficientBalanceError(0, 5600)
    );

    await expect(
      CommitteeMonthsService.resolveMonth(COMMITTEE_ID, MONTH_ID)
    ).rejects.toThrow("CRITICAL: Winner wallet cannot cover interest charge");
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

    const summary = expectedSummary(50_000);

    let totalCredits = 0;
    let totalDebits = 0;
    for (const call of creditSpy.mock.calls) totalCredits += call[0].amount;
    for (const call of debitSpy.mock.calls) totalDebits += call[0].amount;

    expect(totalCredits).toBe(totalDebits);

    const expectedCredits = 50_000 + TOTAL_MEMBERS * summary.perMemberDistribution;
    const expectedDebits = summary.interestAmount;

    expect(totalCredits).toBe(expectedCredits);
    expect(totalDebits).toBe(expectedDebits);
  });

  it("winner wallet increases by exactly (winningBid - interest + perMemberShare)", async () => {
    const members = makeFullMemberList();
    setupMocks(members);
    const { creditSpy, debitSpy } = await setupLedgerSpies();

    await CommitteeMonthsService.resolveMonth(COMMITTEE_ID, MONTH_ID);

    const summary = expectedSummary(50_000);

    const winnerCredits = creditSpy.mock.calls
      .filter((c) => c[0].memberId === WINNER_ID)
      .reduce((sum, c) => sum + c[0].amount, 0);

    const winnerDebits = debitSpy.mock.calls
      .filter((c) => c[0].memberId === WINNER_ID)
      .reduce((sum, c) => sum + c[0].amount, 0);

    const winnerNetChange = winnerCredits - winnerDebits;
    const expectedWinnerNet = 50_000 - summary.interestAmount + summary.perMemberDistribution;

    expect(winnerNetChange).toBe(expectedWinnerNet);
  });

  it("each non-winner member wallet increases by exactly perMemberShare", async () => {
    const members = makeFullMemberList();
    setupMocks(members);
    const { creditSpy, debitSpy } = await setupLedgerSpies();

    await CommitteeMonthsService.resolveMonth(COMMITTEE_ID, MONTH_ID);

    const summary = expectedSummary(50_000);

    for (const member of members) {
      if (member.id === WINNER_ID) continue;

      const memberCredits = creditSpy.mock.calls
        .filter((c) => c[0].memberId === member.id)
        .reduce((sum, c) => sum + c[0].amount, 0);

      const memberDebits = debitSpy.mock.calls
        .filter((c) => c[0].memberId === member.id)
        .reduce((sum, c) => sum + c[0].amount, 0);

      const netChange = memberCredits - memberDebits;
      expect(netChange).toBe(summary.perMemberDistribution);
    }
  });

  it("sum of all member wallet changes equals zero (conservation)", async () => {
    const members = makeFullMemberList();
    setupMocks(members);
    const { creditSpy, debitSpy } = await setupLedgerSpies();

    await CommitteeMonthsService.resolveMonth(COMMITTEE_ID, MONTH_ID);

    let totalNetChange = 0;
    for (const member of members) {
      const memberCredits = creditSpy.mock.calls
        .filter((c) => c[0].memberId === member.id)
        .reduce((sum, c) => sum + c[0].amount, 0);
      const memberDebits = debitSpy.mock.calls
        .filter((c) => c[0].memberId === member.id)
        .reduce((sum, c) => sum + c[0].amount, 0);
      totalNetChange += memberCredits - memberDebits;
    }

    expect(totalNetChange).toBe(0);
  });

  it("verifyMonthLedgerIntegrity detects imbalance", async () => {
    ledgerStore.push(
      { id: "l1", committee_id: COMMITTEE_ID, reference_type: "committee_months", reference_id: MONTH_ID, direction: "credit", amount: 100_000, status: "confirmed" },
      { id: "l2", committee_id: COMMITTEE_ID, reference_type: "committee_months", reference_id: MONTH_ID, direction: "debit", amount: 80_000, status: "confirmed" }
    );

    await expect(
      CommitteeMonthsService.verifyMonthLedgerIntegrity(COMMITTEE_ID, MONTH_ID)
    ).rejects.toThrow(LedgerIntegrityError);
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

  it("verifyMonthLedgerIntegrity throws if no entries found", async () => {
    await expect(
      CommitteeMonthsService.verifyMonthLedgerIntegrity(COMMITTEE_ID, MONTH_ID)
    ).rejects.toThrow(LedgerIntegrityError);
  });
});
