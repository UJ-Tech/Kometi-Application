/**
 * committeeCalculations.ts
 * ========================
 * Single source of truth for ALL committee/chit fund math.
 *
 * RULES this file enforces:
 *  - All rupee amounts are plain numbers (₹, NOT paise)
 *  - All results rounded to 2 decimal places
 *  - No database calls — pure functions only
 *  - Every function has input validation that throws a descriptive error
 *  - A conservation check is run after every month resolution
 *  - NO ORGANISER FEE — the organiser takes ZERO cut. The entire remaining
 *    balance (pool - winning bid) flows to members as distribution.
 *
 * FLOW (bid resolves BEFORE any payment is collected):
 *  1. Organiser opens bidding for the month
 *  2. Members bid (or lottery runs if nobody bids)
 *  3. Distribution is calculated immediately — calculateMonthSummary()
 *  4. Net payment obligations generated — generateMemberPaymentObligations()
 *  5. Non-winners pay (contribution - their distribution share) within 3 days
 *  6. Winner receives (bid - interest - their contribution + their share)
 *  7. If a non-winner misses the deadline, organiser advances on their behalf
 *     — calculateOrganiserAdvance() — tracked as member debt to organiser,
 *     NOT committee money.
 *
 * USAGE:
 *   import { calculateMonthSummary, validateBid } from './committeeCalculations'
 */

// ─────────────────────────────────────────────
// TYPES — align these with your DB column names
// ─────────────────────────────────────────────

export interface ContributionRecord {
  memberId: string
  amountDue: number
  amountPaid: number
  lateFeeAmount: number
  weeksLate: number
  status: 'pending' | 'paid' | 'late' | 'defaulted'
}

export interface MonthInput {
  committeeId: string
  monthNumber: number
  totalMembers: number
  contributionPerPerson: number
  interestRatePercent: number
  winningBidAmount: number
  winnerId: string
  resolutionType: 'bid_single' | 'bid_auction' | 'lottery' | 'organiser_commission'
  contributions: ContributionRecord[]
  remainingNonWinners: number
}

export interface MonthSummary {
  committeeId: string
  monthNumber: number
  totalPool: number
  interestAmount: number
  maxBidAllowed: number
  winningBidAmount: number
  remainingBalance: number
  lateFeeCollected: number
  distributableAmount: number
  perMemberDistribution: number
  resolutionType: 'bid_single' | 'bid_auction' | 'lottery' | 'organiser_commission'
  winnerId: string
  conservationCheck: ConservationResult
  nonWinnerNetPayable: number
  winnerNetReceivable: number
  paymentDeadlineDays: number
}

export interface WalletEntry {
  memberId: string
  entryType:
    | 'bid_payout'
    | 'interest_charge'
    | 'distribution_credit'
    | 'late_fee_charge'
  direction: 'credit' | 'debit'
  amount: number
  idempotencyKey: string
  notes: string
}

export interface ConservationResult {
  passed: boolean
  totalIn: number
  totalOut: number
  difference: number
  breakdown: {
    winnerPayout: number
    interestReturnedToPool: number
    distributableAmount: number
    totalDistributedToMembers: number
    lateFeeCollected: number
  }
}

export interface BidValidationResult {
  valid: boolean
  reason?: string
  maxBidAllowed: number
  interestAmount: number
}

export interface MemberPaymentObligation {
  memberId: string
  role: 'winner' | 'non_winner'
  contributionAmount: number
  distributionShare: number
  netAmount: number
  direction: 'pay' | 'receive'
  interestCharged: number
  dueDate: string
  status: 'pending' | 'paid' | 'overdue' | 'organiser_advanced'
}

export interface OrganiserAdvanceResult {
  memberId: string
  committeeId: string
  monthNumber: number
  originalAmountOwed: number
  latePenalty: number
  totalOwedToOrganiser: number
  advancedAt: string
  organiserId: string
}

// ─────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────

function round(n: number): number {
  return Math.round(n * 100) / 100
}

function assertPositive(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`[CommitteeCalc] ${name} must be a positive number, got: ${value}`)
  }
}

function assertGreaterThanZero(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`[CommitteeCalc] ${name} must be greater than 0, got: ${value}`)
  }
}

// ─────────────────────────────────────────────
// FUNCTION 1 — calculateMonthlyInterest
// ─────────────────────────────────────────────

export function calculateMonthlyInterest(
  remainingNonWinners: number,
  contributionPerPerson: number,
  interestRatePercent: number = 2
): number {
  assertGreaterThanZero(remainingNonWinners, 'remainingNonWinners')
  assertGreaterThanZero(contributionPerPerson, 'contributionPerPerson')
  assertPositive(interestRatePercent, 'interestRatePercent')

  return round((interestRatePercent / 100) * contributionPerPerson * remainingNonWinners)
}

// ─────────────────────────────────────────────
// FUNCTION 2 — calculateMaxBid
// ─────────────────────────────────────────────

export function calculateMaxBid(
  totalPool: number,
  interestAmount: number
): number {
  assertGreaterThanZero(totalPool, 'totalPool')
  assertPositive(interestAmount, 'interestAmount')

  const maxBid = round(totalPool - interestAmount)

  if (maxBid <= 0) {
    throw new Error(
      `[CommitteeCalc] maxBid is ${maxBid} — interestAmount (${interestAmount}) >= totalPool (${totalPool}). Check your interest rate.`
    )
  }

  return maxBid
}

// ─────────────────────────────────────────────
// FUNCTION 3 — calculateRemainingBalance
// ─────────────────────────────────────────────

export function calculateRemainingBalance(
  totalPool: number,
  winningBidAmount: number
): number {
  assertGreaterThanZero(totalPool, 'totalPool')
  assertPositive(winningBidAmount, 'winningBidAmount')

  if (winningBidAmount > totalPool) {
    throw new Error(
      `[CommitteeCalc] winningBidAmount (${winningBidAmount}) cannot exceed totalPool (${totalPool})`
    )
  }

  return round(totalPool - winningBidAmount)
}

// ─────────────────────────────────────────────
// FUNCTION 4 — calculateLateFeeForMember
// ─────────────────────────────────────────────

export function calculateLateFeeForMember(
  contributionAmount: number,
  weeksLate: number,
  feePercentPerWeek: number = 1.5
): number {
  assertGreaterThanZero(contributionAmount, 'contributionAmount')
  assertPositive(weeksLate, 'weeksLate')
  assertPositive(feePercentPerWeek, 'feePercentPerWeek')

  if (weeksLate === 0) return 0

  return round(contributionAmount * (feePercentPerWeek / 100) * weeksLate)
}

// ─────────────────────────────────────────────
// FUNCTION 5 — calculateTotalLateFees
// ─────────────────────────────────────────────

export function calculateTotalLateFees(contributions: ContributionRecord[]): number {
  if (!contributions || contributions.length === 0) return 0

  return round(
    contributions.reduce((sum, c) => sum + (c.lateFeeAmount ?? 0), 0)
  )
}

// ─────────────────────────────────────────────
// FUNCTION 6 — calculateDistributableAmount
// ─────────────────────────────────────────────

/**
 * NO ORGANISER FEE IS DEDUCTED — the organiser takes zero cut. The entire
 * remaining balance flows straight to members.
 * FORMULA: remainingBalance + interestAmount + lateFeeCollected
 */
export function calculateDistributableAmount(
  remainingBalance: number,
  interestAmount: number,
  lateFeeCollected: number = 0
): number {
  assertPositive(remainingBalance, 'remainingBalance')
  assertPositive(interestAmount, 'interestAmount')
  assertPositive(lateFeeCollected, 'lateFeeCollected')

  const distributable = round(remainingBalance + interestAmount + lateFeeCollected)

  if (distributable < 0) {
    throw new Error(
      `[CommitteeCalc] distributableAmount is negative (${distributable}). Check your inputs.`
    )
  }

  return distributable
}

// ─────────────────────────────────────────────
// FUNCTION 7 — calculatePerMemberDistribution
// ─────────────────────────────────────────────

export function calculatePerMemberDistribution(
  distributableAmount: number,
  totalMembers: number
): number {
  assertPositive(distributableAmount, 'distributableAmount')
  assertGreaterThanZero(totalMembers, 'totalMembers')

  return round(distributableAmount / totalMembers)
}

// ─────────────────────────────────────────────
// FUNCTION 8 — validateBid
// ─────────────────────────────────────────────

export function validateBid(
  bidAmount: number,
  remainingNonWinners: number,
  contributionPerPerson: number,
  interestRatePercent: number,
  totalPool: number,
  memberHasAlreadyWon: boolean,
  monthStatus: string
): BidValidationResult {
  const interestAmount = calculateMonthlyInterest(
    remainingNonWinners,
    contributionPerPerson,
    interestRatePercent
  )
  const maxBidAllowed = calculateMaxBid(totalPool, interestAmount)

  if (monthStatus !== 'bidding_open') {
    return {
      valid: false,
      reason: `Bidding is not open for this month. Current status: ${monthStatus}`,
      maxBidAllowed,
      interestAmount,
    }
  }

  if (memberHasAlreadyWon) {
    return {
      valid: false,
      reason: 'You have already received the fund in a previous month. You cannot bid again.',
      maxBidAllowed,
      interestAmount,
    }
  }

  if (!Number.isFinite(bidAmount) || bidAmount <= 0) {
    return {
      valid: false,
      reason: 'Bid amount must be greater than ₹0.',
      maxBidAllowed,
      interestAmount,
    }
  }

  if (bidAmount > maxBidAllowed) {
    return {
      valid: false,
      reason: `Bid of ₹${bidAmount} exceeds the maximum allowed bid of ₹${maxBidAllowed}. The interest amount of ₹${interestAmount} is reserved for all members.`,
      maxBidAllowed,
      interestAmount,
    }
  }

  return { valid: true, maxBidAllowed, interestAmount }
}

// ─────────────────────────────────────────────
// FUNCTION 9 — calculateMonthSummary  ★ MAIN
// ─────────────────────────────────────────────

export function calculateMonthSummary(input: MonthInput): MonthSummary {
  const {
    committeeId,
    monthNumber,
    totalMembers,
    contributionPerPerson,
    interestRatePercent,
    winningBidAmount,
    winnerId,
    resolutionType,
    contributions,
    remainingNonWinners,
  } = input

  assertGreaterThanZero(totalMembers, 'totalMembers')
  assertGreaterThanZero(contributionPerPerson, 'contributionPerPerson')
  assertPositive(interestRatePercent, 'interestRatePercent')
  assertGreaterThanZero(remainingNonWinners, 'remainingNonWinners')
  assertGreaterThanZero(monthNumber, 'monthNumber')

  if (remainingNonWinners > totalMembers) {
    throw new Error(
      `[CommitteeCalc] remainingNonWinners (${remainingNonWinners}) cannot exceed totalMembers (${totalMembers})`
    )
  }

  if (contributions.length !== totalMembers) {
    throw new Error(
      `[CommitteeCalc] contributions array has ${contributions.length} entries but totalMembers is ${totalMembers}. Every member must have a contribution record.`
    )
  }

  const totalPool = round(totalMembers * contributionPerPerson)

  // ── ORGANISER COMMISSION MONTH ──
  // Real bidding never happens this month. Instead of charging a % commission,
  // the organiser's entire compensation for running the committee is the full
  // pool of ONE month — by convention, the first month. No interest is charged
  // (it isn't a loan being repaid, it's the organiser's earned fee) and nothing
  // is left over to distribute — every other member effectively pays their full
  // contribution with nothing back this month. From the NEXT month onward this
  // committee behaves exactly like every other no-fee month (see Function 6).
  const isOrganiserCommissionMonth = resolutionType === 'organiser_commission'

  const interestAmount = isOrganiserCommissionMonth
    ? 0
    : calculateMonthlyInterest(remainingNonWinners, contributionPerPerson, interestRatePercent)

  const maxBidAllowed = calculateMaxBid(totalPool, interestAmount)

  // The organiser is forced to receive the ENTIRE pool — no partial bid, no
  // commission percentage. We override whatever winningBidAmount was passed in.
  const effectiveWinningBid = isOrganiserCommissionMonth ? totalPool : winningBidAmount

  if (
    resolutionType !== 'lottery' &&
    resolutionType !== 'organiser_commission' &&
    effectiveWinningBid > maxBidAllowed
  ) {
    throw new Error(
      `[CommitteeCalc] winningBidAmount (${effectiveWinningBid}) exceeds maxBidAllowed (${maxBidAllowed}) for month ${monthNumber}`
    )
  }

  const remainingBalance = calculateRemainingBalance(totalPool, effectiveWinningBid)

  const lateFeeCollected = calculateTotalLateFees(contributions)

  const distributableAmount = calculateDistributableAmount(
    remainingBalance,
    interestAmount,
    lateFeeCollected
  )

  const perMemberDistribution = calculatePerMemberDistribution(
    distributableAmount,
    totalMembers
  )

  const conservationCheck = runConservationCheck({
    totalPool,
    winningBidAmount: effectiveWinningBid,
    distributableAmount,
    perMemberDistribution,
    totalMembers,
    lateFeeCollected,
    interestAmount,
  })

  if (!conservationCheck.passed) {
    throw new Error(
      `[CommitteeCalc] CONSERVATION CHECK FAILED for month ${monthNumber}. ` +
      `Total in: ₹${conservationCheck.totalIn}, ` +
      `Total out: ₹${conservationCheck.totalOut}, ` +
      `Difference: ₹${conservationCheck.difference}. ` +
      `DO NOT save this month — there is a calculation error.`
    )
  }

  const nonWinnerNetPayable = round(contributionPerPerson - perMemberDistribution)
  const winnerNetReceivable = round(
    effectiveWinningBid - interestAmount - contributionPerPerson + perMemberDistribution
  )

  const paymentDeadlineDays = 3

  return {
    committeeId,
    monthNumber,
    totalPool,
    interestAmount,
    maxBidAllowed,
    winningBidAmount: effectiveWinningBid,
    remainingBalance,
    lateFeeCollected,
    distributableAmount,
    perMemberDistribution,
    resolutionType,
    winnerId,
    conservationCheck,
    nonWinnerNetPayable,
    winnerNetReceivable,
    paymentDeadlineDays,
  }
}

// ─────────────────────────────────────────────
// FUNCTION 10 — generateWalletEntries
// ─────────────────────────────────────────────

export function generateWalletEntries(
  summary: MonthSummary,
  allMemberIds: string[],
  lateMembers: Array<{ memberId: string; lateFeeAmount: number }> = []
): WalletEntry[] {
  if (!allMemberIds || allMemberIds.length === 0) {
    throw new Error('[CommitteeCalc] allMemberIds cannot be empty')
  }

  const entries: WalletEntry[] = []
  const { committeeId, monthNumber, winnerId, winningBidAmount,
    interestAmount, perMemberDistribution } = summary

  const key = (type: string, memberId?: string) =>
    `${committeeId}_m${monthNumber}_${type}${memberId ? '_' + memberId : ''}`

  entries.push({
    memberId: winnerId,
    entryType: 'bid_payout',
    direction: 'credit',
    amount: winningBidAmount,
    idempotencyKey: key('payout'),
    notes: `Month ${monthNumber} bid payout — ${summary.resolutionType}`,
  })

  entries.push({
    memberId: winnerId,
    entryType: 'interest_charge',
    direction: 'debit',
    amount: interestAmount,
    idempotencyKey: key('interest'),
    notes: `Month ${monthNumber} interest charge`,
  })

  for (const memberId of allMemberIds) {
    entries.push({
      memberId,
      entryType: 'distribution_credit',
      direction: 'credit',
      amount: perMemberDistribution,
      idempotencyKey: key('dist', memberId),
      notes: `Month ${monthNumber} distribution — ₹${perMemberDistribution} per member`,
    })
  }

  for (const lm of lateMembers) {
    if (lm.lateFeeAmount > 0) {
      entries.push({
        memberId: lm.memberId,
        entryType: 'late_fee_charge',
        direction: 'debit',
        amount: lm.lateFeeAmount,
        idempotencyKey: key('latefee', lm.memberId),
        notes: `Month ${monthNumber} late fee`,
      })
    }
  }

  return entries
}

// ─────────────────────────────────────────────
// FUNCTION 11 — runConservationCheck
// ─────────────────────────────────────────────

export function runConservationCheck(params: {
  totalPool: number
  winningBidAmount: number
  distributableAmount: number
  perMemberDistribution: number
  totalMembers: number
  lateFeeCollected: number
  interestAmount: number
}): ConservationResult {
  const {
    totalPool,
    winningBidAmount,
    distributableAmount,
    perMemberDistribution,
    totalMembers,
    lateFeeCollected,
    interestAmount,
  } = params

  const totalDistributedToMembers = round(perMemberDistribution * totalMembers)
  const winnerNetPayout = round(winningBidAmount - interestAmount)
  const totalOut = round(winnerNetPayout + totalDistributedToMembers)
  const totalIn = round(totalPool + lateFeeCollected)

  const difference = round(Math.abs(totalIn - totalOut))
  const passed = difference < 0.02

  return {
    passed,
    totalIn,
    totalOut,
    difference,
    breakdown: {
      winnerPayout: winningBidAmount,
      interestReturnedToPool: interestAmount,
      distributableAmount,
      totalDistributedToMembers,
      lateFeeCollected,
    },
  }
}

// ─────────────────────────────────────────────
// FUNCTION 12 — calculateLastMemberTotal
// ─────────────────────────────────────────────

export function calculateLastMemberTotal(
  monthlyDistributions: number[],
  finalPayout: number,
  finalInterestPaid: number
): {
  totalDistributionsReceived: number
  finalPayout: number
  finalInterestPaid: number
  totalReceived: number
  totalContributed: number
  netGain: number
} {
  if (!monthlyDistributions || monthlyDistributions.length === 0) {
    throw new Error('[CommitteeCalc] monthlyDistributions array cannot be empty')
  }
  assertGreaterThanZero(finalPayout, 'finalPayout')
  assertPositive(finalInterestPaid, 'finalInterestPaid')

  const totalDistributionsReceived = round(
    monthlyDistributions.reduce((sum, d) => sum + d, 0)
  )

  const totalReceived = round(
    totalDistributionsReceived + finalPayout - finalInterestPaid
  )

  return {
    totalDistributionsReceived,
    finalPayout,
    finalInterestPaid,
    totalReceived,
    totalContributed: 0,
    netGain: 0,
  }
}

// ─────────────────────────────────────────────
// FUNCTION 13 — calculateRemainingNonWinners
// ─────────────────────────────────────────────

export function calculateRemainingNonWinners(
  totalMembers: number,
  winnersBeforeThisMonth: number
): number {
  assertGreaterThanZero(totalMembers, 'totalMembers')
  assertPositive(winnersBeforeThisMonth, 'winnersBeforeThisMonth')

  if (winnersBeforeThisMonth >= totalMembers) {
    throw new Error(
      `[CommitteeCalc] winnersBeforeThisMonth (${winnersBeforeThisMonth}) >= totalMembers (${totalMembers}). The committee cycle is already complete.`
    )
  }

  return totalMembers - winnersBeforeThisMonth
}

// ─────────────────────────────────────────────
// FUNCTION 14 — previewBidImpact
// ─────────────────────────────────────────────

export function previewBidImpact(
  bidAmount: number,
  totalMembers: number,
  remainingNonWinners: number,
  contributionPerPerson: number,
  interestRatePercent: number = 2
): {
  isValid: boolean
  validationMessage: string
  yourPayout: number
  interestYouPay: number
  yourNetFromPayout: number
  remainingForOthers: number
  distributablePool: number
  everyMemberGets: number
  youAlsoGetDistribution: number
  yourTotalNetThisMonth: number
  maxBidAllowed: number
} {
  const totalPool = round(totalMembers * contributionPerPerson)
  const interestAmount = calculateMonthlyInterest(
    remainingNonWinners, contributionPerPerson, interestRatePercent
  )
  const maxBidAllowed = calculateMaxBid(totalPool, interestAmount)

  const isValid = bidAmount > 0 && bidAmount <= maxBidAllowed
  const validationMessage = !isValid
    ? bidAmount <= 0
      ? 'Bid must be greater than ₹0'
      : `Bid exceeds maximum of ₹${maxBidAllowed}. Reduce by ₹${round(bidAmount - maxBidAllowed)}.`
    : 'Bid is valid'

  if (!isValid || bidAmount <= 0) {
    return {
      isValid, validationMessage,
      yourPayout: 0, interestYouPay: 0, yourNetFromPayout: 0,
      remainingForOthers: 0, distributablePool: 0,
      everyMemberGets: 0, youAlsoGetDistribution: 0, yourTotalNetThisMonth: 0,
      maxBidAllowed,
    }
  }

  const remainingBalance = calculateRemainingBalance(totalPool, bidAmount)
  const distributablePool = calculateDistributableAmount(remainingBalance, interestAmount, 0)
  const everyMemberGets = calculatePerMemberDistribution(distributablePool, totalMembers)

  return {
    isValid,
    validationMessage,
    yourPayout: bidAmount,
    interestYouPay: interestAmount,
    yourNetFromPayout: round(bidAmount - interestAmount),
    remainingForOthers: remainingBalance,
    distributablePool,
    everyMemberGets,
    youAlsoGetDistribution: everyMemberGets,
    yourTotalNetThisMonth: round(bidAmount - interestAmount + everyMemberGets),
    maxBidAllowed,
  }
}

// ─────────────────────────────────────────────
// FUNCTION 15 — calculatePaymentDeadline
// ─────────────────────────────────────────────

export function calculatePaymentDeadline(
  resolvedAt: string | Date,
  deadlineDays: number = 3
): string {
  const resolved = typeof resolvedAt === 'string' ? new Date(resolvedAt) : resolvedAt
  if (isNaN(resolved.getTime())) {
    throw new Error(`[CommitteeCalc] Invalid resolvedAt date: ${resolvedAt}`)
  }
  const deadline = new Date(resolved.getTime() + deadlineDays * 24 * 60 * 60 * 1000)
  return deadline.toISOString()
}

// ─────────────────────────────────────────────
// FUNCTION 16 — generateMemberPaymentObligations  ★ KEY FOR NEW FLOW
// ─────────────────────────────────────────────

export function generateMemberPaymentObligations(
  summary: MonthSummary,
  allMemberIds: string[],
  resolvedAt: string | Date
): MemberPaymentObligation[] {
  if (!allMemberIds || allMemberIds.length === 0) {
    throw new Error('[CommitteeCalc] allMemberIds cannot be empty')
  }

  const dueDate = calculatePaymentDeadline(resolvedAt, summary.paymentDeadlineDays)
  const contributionPerPerson = round(summary.totalPool / allMemberIds.length)

  return allMemberIds.map((memberId): MemberPaymentObligation => {
    if (memberId === summary.winnerId) {
      const net = summary.winnerNetReceivable
      return {
        memberId,
        role: 'winner',
        contributionAmount: contributionPerPerson,
        distributionShare: summary.perMemberDistribution,
        netAmount: net,
        direction: net >= 0 ? 'receive' : 'pay',
        interestCharged: summary.interestAmount,
        dueDate,
        status: 'pending',
      }
    }

    const net = summary.nonWinnerNetPayable
    return {
      memberId,
      role: 'non_winner',
      contributionAmount: contributionPerPerson,
      distributionShare: summary.perMemberDistribution,
      netAmount: net,
      direction: net >= 0 ? 'pay' : 'receive',
      interestCharged: 0,
      dueDate,
      status: 'pending',
    }
  })
}

// ─────────────────────────────────────────────
// FUNCTION 17 — calculateOrganiserAdvance
// ─────────────────────────────────────────────

export function calculateOrganiserAdvance(
  memberId: string,
  committeeId: string,
  monthNumber: number,
  amountOwed: number,
  organiserId: string,
  latePenaltyPercent: number = 0
): OrganiserAdvanceResult {
  assertGreaterThanZero(amountOwed, 'amountOwed')
  assertPositive(latePenaltyPercent, 'latePenaltyPercent')

  const latePenalty = round(amountOwed * (latePenaltyPercent / 100))
  const totalOwedToOrganiser = round(amountOwed + latePenalty)

  return {
    memberId,
    committeeId,
    monthNumber,
    originalAmountOwed: amountOwed,
    latePenalty,
    totalOwedToOrganiser,
    advancedAt: new Date().toISOString(),
    organiserId,
  }
}

// ─────────────────────────────────────────────
// FUNCTION 18 — runNettedConservationCheck
// ─────────────────────────────────────────────

export function runNettedConservationCheck(
  summary: MonthSummary,
  totalMembers: number
): { passed: boolean; totalCollected: number; totalPaidOut: number; difference: number } {
  const totalCollected = round((totalMembers - 1) * summary.nonWinnerNetPayable)
  const totalPaidOut = round(summary.winnerNetReceivable)
  const difference = round(Math.abs(totalCollected - totalPaidOut))

  return {
    passed: difference < 0.02,
    totalCollected,
    totalPaidOut,
    difference,
  }
}

// ─────────────────────────────────────────────
// FUNCTION 19 — isOrganiserCommissionMonth
// ─────────────────────────────────────────────

/**
 * Convention: month 1 is always reserved for the organiser. Use this helper
 * when building the MonthInput so resolutionType is set correctly.
 *
 * @param monthNumber
 */
export function isOrganiserCommissionMonth(monthNumber: number): boolean {
  return monthNumber === 1
}

// ─────────────────────────────────────────────
// QUICK REFERENCE — expected outputs for testing
// ─────────────────────────────────────────────
//
// 10-MEMBER COMMITTEE (₹1000/month, NO organiser fee, 2% interest):
//
// Month 1 — remaining=10, bid=₹8000:
//   interest            = ₹200
//   maxBid              = ₹9800
//   remainingBalance    = ₹2000
//   distributableAmount = ₹2200   (was ₹2100 with 5% fee — members get ₹100 more)
//   perMemberShare      = ₹220    (was ₹210 with 5% fee)
//   nonWinnerNetPayable = ₹780    (1000 - 220)
//   winnerNetReceivable = ₹7020   (8000 - 200 - 1000 + 220)
//
// CONSERVATION (no organiser fee — collected from non-winners EXACTLY equals
// what the winner receives, no third party takes anything):
//   (totalMembers - 1) × nonWinnerNetPayable === winnerNetReceivable
//
// EDGE CASES:
//   calculateLateFeeForMember(1000, 0)     = ₹0
//   calculateLateFeeForMember(1000, 2)     = ₹30
//   calculateRemainingNonWinners(10, 0)    = 10
//   calculateRemainingNonWinners(10, 9)    = 1
//   validateBid(0, ...)                    = invalid (bid > 0 required)
//   validateBid(9801, 10, 1000, 2, 10000) = invalid (exceeds max ₹9800)
//   validateBid(9800, 10, 1000, 2, 10000) = valid (exactly at max)
//
// ORGANISER COMMISSION MONTH (month 1, resolutionType='organiser_commission'):
//   No bidding happens. interestAmount forced to 0. winningBidAmount forced
//   to totalPool regardless of what's passed in. Organiser takes 100% —
//   nothing distributed to any member that month.
//   10-member example (₹1000/month, no fee elsewhere):
//     totalPool = ₹10,000, interest = ₹0, distributable = ₹0, perMember = ₹0
//     nonWinnerNetPayable (every other member) = ₹1000 (full, nothing back)
//     winnerNetReceivable (organiser) = ₹10000 - 0 - 1000 + 0 = ₹9000
//     (organiser's own ₹1000 contribution nets out of their own ₹10,000 take —
//      net gain to organiser = ₹9000, exactly the other 9 members' contributions)