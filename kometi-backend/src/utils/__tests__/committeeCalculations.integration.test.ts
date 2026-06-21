// src/utils/__tests__/committeeCalculations.integration.test.ts
// STEP 6: Comprehensive tests for the new netted flow.
//
// Tests:
// 1. Month 1 organiser commission — organiser receives totalPool, every member pays full contribution
// 2. Month 2+ normal bid — both runConservationCheck and runNettedConservationCheck pass
// 3. Missed deadline — organiser advance record created correctly
// 4. Full cycle — sum of all members' net positions = 0

import { describe, it, expect } from "vitest";
import {
  calculateMonthSummary,
  generateMemberPaymentObligations,
  runNettedConservationCheck,
  calculateOrganiserAdvance,
  isOrganiserCommissionMonth,
  calculateDistributableAmount,
  calculatePerMemberDistribution,
  calculateMonthlyInterest,
  calculateMaxBid,
  calculateRemainingBalance,
} from "../committeeCalculations";

// ─── Constants ───────────────────────────────────────────────────────
const TOTAL_MEMBERS = 10;
const CONTRIBUTION = 1000; // ₹1000 per member
const INTEREST_RATE = 2; // 2%

function makeContributions(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    memberId: `member-${i + 1}`,
    amountDue: CONTRIBUTION,
    amountPaid: CONTRIBUTION,
    lateFeeAmount: 0,
    weeksLate: 0,
    status: "paid" as const,
  }));
}

// ─── TEST 1: Month 1 — Organiser Commission ─────────────────────────

describe("Month 1 — Organiser Commission", () => {
  it("organiser receives totalPool, every member pays full contribution, distributableAmount is 0", () => {
    const summary = calculateMonthSummary({
      committeeId: "c1",
      monthNumber: 1,
      totalMembers: TOTAL_MEMBERS,
      contributionPerPerson: CONTRIBUTION,
      interestRatePercent: INTEREST_RATE,
      winningBidAmount: 0, // ignored for organiser_commission
      winnerId: "organiser",
      resolutionType: "organiser_commission",
      contributions: makeContributions(TOTAL_MEMBERS),
      remainingNonWinners: TOTAL_MEMBERS,
    });

    const totalPool = TOTAL_MEMBERS * CONTRIBUTION;

    // Interest is 0 for organiser commission month
    expect(summary.interestAmount).toBe(0);

    // Winning bid forced to totalPool
    expect(summary.winningBidAmount).toBe(totalPool);

    // Remaining balance = totalPool - totalPool = 0
    expect(summary.remainingBalance).toBe(0);

    // Distributable = 0 + 0 + 0 = 0 (no interest, no remaining, no late fees)
    expect(summary.distributableAmount).toBe(0);

    // Per-member distribution = 0
    expect(summary.perMemberDistribution).toBe(0);

    // Every non-winner pays their full contribution (nothing back)
    expect(summary.nonWinnerNetPayable).toBe(CONTRIBUTION);

    // Organiser (winner) receives totalPool - own contribution + 0 distribution
    // = 10000 - 1000 + 0 = 9000
    expect(summary.winnerNetReceivable).toBe(totalPool - CONTRIBUTION);

    // Conservation check passes internally
    expect(summary.conservationCheck.passed).toBe(true);

    // Netted conservation check: (TOTAL_MEMBERS - 1) * nonWinnerNetPayable === winnerNetReceivable
    const nettedCheck = runNettedConservationCheck(summary, TOTAL_MEMBERS);
    expect(nettedCheck.passed).toBe(true);
    expect(nettedCheck.totalCollected).toBe(nettedCheck.totalPaidOut);
  });

  it("isOrganiserCommissionMonth returns true for month 1", () => {
    expect(isOrganiserCommissionMonth(1)).toBe(true);
  });

  it("isOrganiserCommissionMonth returns false for month 2+", () => {
    expect(isOrganiserCommissionMonth(2)).toBe(false);
    expect(isOrganiserCommissionMonth(5)).toBe(false);
  });

  it("generates correct payment obligations for month 1", () => {
    const summary = calculateMonthSummary({
      committeeId: "c1",
      monthNumber: 1,
      totalMembers: TOTAL_MEMBERS,
      contributionPerPerson: CONTRIBUTION,
      interestRatePercent: INTEREST_RATE,
      winningBidAmount: 0,
      winnerId: "organiser",
      resolutionType: "organiser_commission",
      contributions: makeContributions(TOTAL_MEMBERS),
      remainingNonWinners: TOTAL_MEMBERS,
    });

    const memberIds = Array.from({ length: TOTAL_MEMBERS }, (_, i) =>
      i === 0 ? "organiser" : `member-${i + 1}`
    );

    const obligations = generateMemberPaymentObligations(summary, memberIds, new Date());

    expect(obligations.length).toBe(TOTAL_MEMBERS);

    // Organiser obligation
    const orgObl = obligations.find(o => o.memberId === "organiser");
    expect(orgObl).toBeDefined();
    expect(orgObl!.role).toBe("winner");
    expect(orgObl!.direction).toBe("receive");
    expect(orgObl!.netAmount).toBe(summary.winnerNetReceivable);

    // Non-winner obligations — each pays full contribution
    const nonWinners = obligations.filter(o => o.memberId !== "organiser");
    expect(nonWinners.length).toBe(TOTAL_MEMBERS - 1);
    for (const nw of nonWinners) {
      expect(nw.role).toBe("non_winner");
      expect(nw.direction).toBe("pay");
      expect(nw.netAmount).toBe(CONTRIBUTION);
    }
  });
});

// ─── TEST 2: Month 2+ Normal Bid — Conservation Checks ──────────────

describe("Month 2+ — Normal Bid with Conservation Checks", () => {
  it("runConservationCheck passes for a valid bid", () => {
    const winningBid = 7000; // ₹7000 bid
    const summary = calculateMonthSummary({
      committeeId: "c1",
      monthNumber: 3,
      totalMembers: TOTAL_MEMBERS,
      contributionPerPerson: CONTRIBUTION,
      interestRatePercent: INTEREST_RATE,
      winningBidAmount: winningBid,
      winnerId: "winner",
      resolutionType: "bid_auction",
      contributions: makeContributions(TOTAL_MEMBERS),
      remainingNonWinners: TOTAL_MEMBERS - 2, // 2 members already won
    });

    // Conservation check inside calculateMonthSummary
    expect(summary.conservationCheck.passed).toBe(true);
    expect(summary.conservationCheck.difference).toBeLessThan(0.02);
  });

  it("runNettedConservationCheck passes for a valid bid", () => {
    const winningBid = 7000;
    const summary = calculateMonthSummary({
      committeeId: "c1",
      monthNumber: 3,
      totalMembers: TOTAL_MEMBERS,
      contributionPerPerson: CONTRIBUTION,
      interestRatePercent: INTEREST_RATE,
      winningBidAmount: winningBid,
      winnerId: "winner",
      resolutionType: "bid_auction",
      contributions: makeContributions(TOTAL_MEMBERS),
      remainingNonWinners: TOTAL_MEMBERS - 2,
    });

    const nettedCheck = runNettedConservationCheck(summary, TOTAL_MEMBERS);
    expect(nettedCheck.passed).toBe(true);
    expect(nettedCheck.totalCollected).toBe(nettedCheck.totalPaidOut);
  });

  it("both checks pass simultaneously for a valid month", () => {
    const winningBid = 6500;
    const summary = calculateMonthSummary({
      committeeId: "c1",
      monthNumber: 5,
      totalMembers: TOTAL_MEMBERS,
      contributionPerPerson: CONTRIBUTION,
      interestRatePercent: INTEREST_RATE,
      winningBidAmount: winningBid,
      winnerId: "winner",
      resolutionType: "bid_single",
      contributions: makeContributions(TOTAL_MEMBERS),
      remainingNonWinners: TOTAL_MEMBERS - 4,
    });

    expect(summary.conservationCheck.passed).toBe(true);

    const nettedCheck = runNettedConservationCheck(summary, TOTAL_MEMBERS);
    expect(nettedCheck.passed).toBe(true);
  });

  it("nonWinnerNetPayable + perMemberDistribution = contributionPerPerson", () => {
    const winningBid = 7000;
    const summary = calculateMonthSummary({
      committeeId: "c1",
      monthNumber: 3,
      totalMembers: TOTAL_MEMBERS,
      contributionPerPerson: CONTRIBUTION,
      interestRatePercent: INTEREST_RATE,
      winningBidAmount: winningBid,
      winnerId: "winner",
      resolutionType: "bid_auction",
      contributions: makeContributions(TOTAL_MEMBERS),
      remainingNonWinners: TOTAL_MEMBERS - 2,
    });

    // Each non-winner pays: contribution - their distribution share
    expect(summary.nonWinnerNetPayable + summary.perMemberDistribution).toBe(CONTRIBUTION);
  });

  it("winnerNetReceivable = bid - interest - contribution + distribution", () => {
    const winningBid = 7000;
    const summary = calculateMonthSummary({
      committeeId: "c1",
      monthNumber: 3,
      totalMembers: TOTAL_MEMBERS,
      contributionPerPerson: CONTRIBUTION,
      interestRatePercent: INTEREST_RATE,
      winningBidAmount: winningBid,
      winnerId: "winner",
      resolutionType: "bid_auction",
      contributions: makeContributions(TOTAL_MEMBERS),
      remainingNonWinners: TOTAL_MEMBERS - 2,
    });

    const expected = winningBid - summary.interestAmount - CONTRIBUTION + summary.perMemberDistribution;
    expect(summary.winnerNetReceivable).toBe(expected);
  });
});

// ─── TEST 3: Missed Deadline — Organiser Advance ────────────────────

describe("Missed Deadline — Organiser Advance", () => {
  it("calculateOrganiserAdvance returns correct amounts with no penalty", () => {
    const result = calculateOrganiserAdvance(
      "member-1",
      "c1",
      3,
      800, // ₹800 owed
      "organiser",
      0 // 0% penalty (within grace period)
    );

    expect(result.memberId).toBe("member-1");
    expect(result.committeeId).toBe("c1");
    expect(result.monthNumber).toBe(3);
    expect(result.originalAmountOwed).toBe(800);
    expect(result.latePenalty).toBe(0);
    expect(result.totalOwedToOrganiser).toBe(800);
    expect(result.organiserId).toBe("organiser");
  });

  it("calculateOrganiserAdvance adds 3% penalty per extra day after 2 days", () => {
    const result = calculateOrganiserAdvance(
      "member-1",
      "c1",
      3,
      1000, // ₹1000 owed
      "organiser",
      6 // 6% penalty (2 extra days at 3% each)
    );

    expect(result.originalAmountOwed).toBe(1000);
    expect(result.latePenalty).toBe(60); // 1000 * 6% = 60
    expect(result.totalOwedToOrganiser).toBe(1060);
  });

  it("calculateOrganiserAdvance requires positive amountOwed", () => {
    expect(() =>
      calculateOrganiserAdvance("m1", "c1", 1, 0, "org1")
    ).toThrow("amountOwed must be greater than 0");
  });
});

// ─── TEST 4: Full Cycle — Net Positions Sum to Zero ─────────────────

describe("Full Cycle — Sum of Net Positions = Zero", () => {
  it("after all months, sum of all members' net positions is exactly zero", () => {
    const memberIds = Array.from({ length: TOTAL_MEMBERS - 1 }, (_, i) => `member-${i + 1}`);
    const organiserId = "organiser";
    const allIds = [organiserId, ...memberIds];

    // Track net position for each member (positive = receives money, negative = pays money)
    const netPositions = new Map<string, number>();
    allIds.forEach(id => netPositions.set(id, 0));

    // Month 1: Organiser commission
    const month1Summary = calculateMonthSummary({
      committeeId: "c1",
      monthNumber: 1,
      totalMembers: TOTAL_MEMBERS,
      contributionPerPerson: CONTRIBUTION,
      interestRatePercent: INTEREST_RATE,
      winningBidAmount: 0,
      winnerId: organiserId,
      resolutionType: "organiser_commission",
      contributions: makeContributions(TOTAL_MEMBERS),
      remainingNonWinners: TOTAL_MEMBERS,
    });

    // Month 1: organiser receives winnerNetReceivable, non-winners pay nonWinnerNetPayable
    netPositions.set(organiserId, month1Summary.winnerNetReceivable);
    for (const id of memberIds) {
      netPositions.set(id, -month1Summary.nonWinnerNetPayable);
    }

    // Months 2-10: Normal bids
    for (let month = 2; month <= TOTAL_MEMBERS; month++) {
      const remainingNonWinners = TOTAL_MEMBERS - (month - 1);
      // Bid decreases each month
      const bidAmount = Math.round(TOTAL_MEMBERS * CONTRIBUTION * 0.7 * (1 - (month - 2) * 0.05));
      const winnerId = memberIds[month - 2]; // Different winner each month

      const summary = calculateMonthSummary({
        committeeId: "c1",
        monthNumber: month,
        totalMembers: TOTAL_MEMBERS,
        contributionPerPerson: CONTRIBUTION,
        interestRatePercent: INTEREST_RATE,
        winningBidAmount: bidAmount,
        winnerId,
        resolutionType: "bid_auction",
        contributions: makeContributions(TOTAL_MEMBERS),
        remainingNonWinners,
      });

      // Conservation checks
      expect(summary.conservationCheck.passed).toBe(true);
      const nettedCheck = runNettedConservationCheck(summary, TOTAL_MEMBERS);
      expect(nettedCheck.passed).toBe(true);

      // Winner receives (positive), non-winners pay (negative)
      // winnerNetReceivable and nonWinnerNetPayable already account for contributions
      netPositions.set(winnerId, (netPositions.get(winnerId) || 0) + summary.winnerNetReceivable);
      for (const id of allIds) {
        if (id !== winnerId) {
          netPositions.set(id, (netPositions.get(id) || 0) - summary.nonWinnerNetPayable);
        }
      }
    }

    // Sum all net positions — should be 0
    // In a closed system with no external fees, total received = total paid
    let totalNet = 0;
    for (const [, net] of netPositions) {
      totalNet += net;
    }

    // The system is closed: total money received by winners = total money paid by non-winners
    // Allow tiny floating point error
    expect(Math.abs(totalNet)).toBeLessThan(0.02 * TOTAL_MEMBERS);
  });
});

// ─── TEST 5: Edge Cases ─────────────────────────────────────────────

describe("Edge Cases", () => {
  it("max bid = totalPool - interestAmount", () => {
    const totalPool = TOTAL_MEMBERS * CONTRIBUTION;
    const interest = calculateMonthlyInterest(TOTAL_MEMBERS, CONTRIBUTION, INTEREST_RATE);
    const maxBid = calculateMaxBid(totalPool, interest);
    expect(maxBid).toBe(totalPool - interest);
  });

  it("distributableAmount = remainingBalance + interest + lateFees (no organiser fee)", () => {
    const remaining = 3000;
    const interest = 200;
    const lateFees = 50;
    const distributable = calculateDistributableAmount(remaining, interest, lateFees);
    expect(distributable).toBe(remaining + interest + lateFees);
  });

  it("perMemberDistribution = distributable / totalMembers", () => {
    const distributable = 3250;
    const perMember = calculatePerMemberDistribution(distributable, TOTAL_MEMBERS);
    expect(perMember).toBe(distributable / TOTAL_MEMBERS);
  });

  it("remainingBalance = totalPool - winningBid", () => {
    const totalPool = 10000;
    const bid = 7000;
    const remaining = calculateRemainingBalance(totalPool, bid);
    expect(remaining).toBe(3000);
  });
});
