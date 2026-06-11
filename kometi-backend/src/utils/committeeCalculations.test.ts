import { describe, it, expect } from "vitest";
import {
  calculateMonthlyInterest,
  calculateMaxBid,
  calculateRemainingBalance,
  calculateOrganiserFee,
  calculateDistribution,
  calculateLateFee,
  calculateMonthSummary,
  calculateLastMemberTotal,
} from "./committeeCalculations";

describe("committeeCalculations utility", () => {
  describe("calculateMonthlyInterest", () => {
    it("should correctly calculate interest based on non-winners", () => {
      // 2% * 1000 * 5 = 100
      expect(calculateMonthlyInterest(10, 5, 1000)).toBe(100);
    });

    it("should handle edge case remainingNonWinners = 1", () => {
      // 2% * 5000 * 1 = 100
      expect(calculateMonthlyInterest(12, 1, 5000)).toBe(100);
    });

    it("should return 0 when remainingNonWinners = 0", () => {
      expect(calculateMonthlyInterest(12, 0, 5000)).toBe(0);
    });
  });

  describe("calculateMaxBid", () => {
    it("should deduct interest amount from total pool", () => {
      expect(calculateMaxBid(12000, 240)).toBe(11760);
    });
  });

  describe("calculateRemainingBalance", () => {
    it("should deduct winning bid from total pool", () => {
      expect(calculateRemainingBalance(12000, 10000)).toBe(2000);
    });

    it("should handle edge case winningBidAmount = 0", () => {
      expect(calculateRemainingBalance(12000, 0)).toBe(12000);
    });
  });

  describe("calculateOrganiserFee", () => {
    it("should calculate fee correctly (default 5%)", () => {
      expect(calculateOrganiserFee(2000)).toBe(100);
    });

    it("should calculate fee using custom percentage", () => {
      expect(calculateOrganiserFee(2000, 8)).toBe(160);
    });

    it("should return 0 if remainingBalance is 0", () => {
      expect(calculateOrganiserFee(0)).toBe(0);
    });
  });

  describe("calculateDistribution", () => {
    it("should divide net pool + interest among members", () => {
      // (2000 - 100 + 240) / 10 = 2140 / 10 = 214
      expect(calculateDistribution(2000, 100, 240, 10)).toBe(214);
    });

    it("should return 0 when totalMembers is 0", () => {
      expect(calculateDistribution(2000, 100, 240, 0)).toBe(0);
    });
  });

  describe("calculateLateFee", () => {
    it("should calculate fee correctly (default 1.5% per week)", () => {
      // 1000 * 1.5% * 4 = 15 * 4 = 60
      expect(calculateLateFee(1000, 4)).toBe(60);
    });

    it("should calculate fee with custom rate", () => {
      // 1000 * 2% * 4 = 80
      expect(calculateLateFee(1000, 4, 2.0)).toBe(80);
    });

    it("should handle edge case weeksLate = 0", () => {
      expect(calculateLateFee(1000, 0)).toBe(0);
    });
  });

  describe("calculateMonthSummary", () => {
    it("should return correct summary values", () => {
      const summary = calculateMonthSummary({
        totalMembers: 10,
        remainingNonWinners: 5,
        contributionPerPerson: 1000,
        totalPool: 10000,
        winningBidAmount: 8000,
        feePercent: 5,
      });

      // Interest: 2% * 1000 * 5 = 100
      expect(summary.interestAmount).toBe(100);

      // Max Bid Allowed: 10000 - 100 = 9900
      expect(summary.maxBidAllowed).toBe(9900);

      // Remaining Balance: 10000 - 8000 = 2000
      expect(summary.remainingBalance).toBe(2000);

      // Organiser Fee: 2000 * 5% = 100
      expect(summary.organiserFee).toBe(100);

      // Distributable: 2000 - 100 + 100 = 2000
      expect(summary.distributableAmount).toBe(2000);

      // Per member: 2000 / 10 = 200
      expect(summary.perMemberDistribution).toBe(200);
    });

    it("should handle edge cases (bid=0, nonWinners=1)", () => {
      const summary = calculateMonthSummary({
        totalMembers: 10,
        remainingNonWinners: 1,
        contributionPerPerson: 1000,
        totalPool: 10000,
        winningBidAmount: 0,
      });

      // Interest: 2% * 1000 * 1 = 20
      expect(summary.interestAmount).toBe(20);

      // Max Bid Allowed: 10000 - 20 = 9980
      expect(summary.maxBidAllowed).toBe(9980);

      // Remaining Balance: 10000 - 0 = 10000
      expect(summary.remainingBalance).toBe(10000);

      // Organiser Fee: 10000 * 5% = 500
      expect(summary.organiserFee).toBe(500);

      // Distributable: 10000 - 500 + 20 = 9520
      expect(summary.distributableAmount).toBe(9520);

      // Per member: 9520 / 10 = 952
      expect(summary.perMemberDistribution).toBe(952);
    });
  });

  describe("calculateLastMemberTotal", () => {
    it("should correctly sum distributions and final payout", () => {
      expect(calculateLastMemberTotal([150, 200, 180], 9500)).toBe(10030);
    });

    it("should return finalPayout if there are no distributions yet", () => {
      expect(calculateLastMemberTotal([], 9500)).toBe(9500);
    });
  });
});
