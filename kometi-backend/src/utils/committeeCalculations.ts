/**
 * Utility functions for Chit Fund / Committee calculations.
 * All functions are pure, performing standard math operations without DB calls.
 */

/**
 * 1. Calculates monthly interest amount.
 * Formula: 2% * contributionPerPerson * remainingNonWinners
 */
export function calculateMonthlyInterest(
  totalMembers: number,
  remainingNonWinners: number,
  contributionPerPerson: number
): number {
  if (totalMembers <= 0) return 0;
  return 0.02 * contributionPerPerson * remainingNonWinners;
}

/**
 * 2. Calculates maximum bid allowed.
 * Formula: totalPool - interestAmount
 */
export function calculateMaxBid(
  totalPool: number,
  interestAmount: number
): number {
  return totalPool - interestAmount;
}

/**
 * 3. Calculates remaining balance after winning bid.
 * Formula: totalPool - winningBidAmount
 */
export function calculateRemainingBalance(
  totalPool: number,
  winningBidAmount: number
): number {
  return totalPool - winningBidAmount;
}

/**
 * 4. Calculates organiser fee based on remaining balance.
 * Formula: remainingBalance * (feePercent / 100)
 */
export function calculateOrganiserFee(
  remainingBalance: number,
  feePercent: number = 5
): number {
  return remainingBalance * (feePercent / 100);
}

/**
 * 5. Calculates per member dividend distribution.
 * Formula: (remainingBalance - organiserFee + interestAmount) / totalMembers
 */
export function calculateDistribution(
  remainingBalance: number,
  organiserFee: number,
  interestAmount: number,
  totalMembers: number
): number {
  if (totalMembers <= 0) return 0;
  return (remainingBalance - organiserFee + interestAmount) / totalMembers;
}

/**
 * 6. Calculates late fee based on contributions.
 * Formula: contributionAmount * (feePercentPerWeek / 100) * weeksLate
 */
export function calculateLateFee(
  contributionAmount: number,
  weeksLate: number,
  feePercentPerWeek: number = 1.5
): number {
  return contributionAmount * (feePercentPerWeek / 100) * weeksLate;
}

/**
 * 7. Calculates a complete summary for a committee month.
 * Returns a summary object with calculated values.
 */
export function calculateMonthSummary(params: {
  totalMembers: number;
  remainingNonWinners: number;
  contributionPerPerson: number;
  totalPool: number;
  winningBidAmount: number;
  feePercent?: number;
}): {
  interestAmount: number;
  maxBidAllowed: number;
  remainingBalance: number;
  organiserFee: number;
  distributableAmount: number;
  perMemberDistribution: number;
} {
  const {
    totalMembers,
    remainingNonWinners,
    contributionPerPerson,
    totalPool,
    winningBidAmount,
    feePercent = 5,
  } = params;

  const interestAmount = calculateMonthlyInterest(
    totalMembers,
    remainingNonWinners,
    contributionPerPerson
  );

  const maxBidAllowed = calculateMaxBid(totalPool, interestAmount);

  const remainingBalance = calculateRemainingBalance(
    totalPool,
    winningBidAmount
  );

  const organiserFee = calculateOrganiserFee(remainingBalance, feePercent);

  const distributableAmount = remainingBalance - organiserFee + interestAmount;

  const perMemberDistribution = calculateDistribution(
    remainingBalance,
    organiserFee,
    interestAmount,
    totalMembers
  );

  return {
    interestAmount,
    maxBidAllowed,
    remainingBalance,
    organiserFee,
    distributableAmount,
    perMemberDistribution,
  };
}

/**
 * 8. Calculates total earnings for the last member.
 * Formula: Sum of monthly distributions + final payout
 */
export function calculateLastMemberTotal(
  monthlyDistributions: number[],
  finalPayout: number
): number {
  const sumDistributions = monthlyDistributions.reduce((sum, val) => sum + val, 0);
  return sumDistributions + finalPayout;
}
