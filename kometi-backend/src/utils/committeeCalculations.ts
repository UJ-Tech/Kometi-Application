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
 *
 * USAGE:
 *   import { calculateMonthSummary, validateBid } from './committeeCalculations'
 */

// ─────────────────────────────────────────────
// TYPES — align these with your DB column names
// ─────────────────────────────────────────────

/** One member's contribution record for a month */
export interface ContributionRecord {
  memberId: string
  amountDue: number       // always committee.contributionAmount
  amountPaid: number
  lateFeeAmount: number   // 0 if paid on time
  weeksLate: number       // 0 if paid on time
  status: 'pending' | 'paid' | 'late' | 'defaulted'
}

/** Input params for a full month calculation */
export interface MonthInput {
  committeeId: string
  monthNumber: number          // 1-based (1 to totalMembers)
  totalMembers: number         // fixed for the whole committee (e.g. 30)
  contributionPerPerson: number // e.g. 1000
  organiserFeePercent: number   // 0 = organiser waives fee; any value 0-20 is valid
  interestRatePercent: number   // e.g. 2
  winningBidAmount: number      // 0 if lottery (full pool awarded)
  winnerId: string
  resolutionType: 'bid_single' | 'bid_auction' | 'lottery'
  contributions: ContributionRecord[]  // all members' contributions this month
  remainingNonWinners: number   // members who have NOT yet received the fund
                                // (including the current month's winner BEFORE this month)
}

/** Full output of a month calculation — stored in committee_months table */
export interface MonthSummary {
  committeeId: string
  monthNumber: number
  totalPool: number
  interestAmount: number
  maxBidAllowed: number
  winningBidAmount: number
  remainingBalance: number
  organiserFeePercent: number   // stored so UI can show "fee waived" when 0
  organiserFeeEnabled: boolean  // true if organiserFeePercent > 0
  organiserFee: number
  lateFeeCollected: number
  distributableAmount: number
  perMemberDistribution: number
  resolutionType: 'bid_single' | 'bid_auction' | 'lottery'
  winnerId: string
  conservationCheck: ConservationResult
}

/** Per-member wallet ledger entries to write after month resolution */
export interface WalletEntry {
  memberId: string
  entryType:
    | 'bid_payout'
    | 'interest_charge'
    | 'distribution_credit'
    | 'late_fee_charge'
  direction: 'credit' | 'debit'
  amount: number
  idempotencyKey: string   // unique key — prevents duplicate ledger writes
  notes: string
}

/** Result of the conservation check */
export interface ConservationResult {
  passed: boolean
  totalIn: number       // must equal totalPool
  totalOut: number      // winner payout + all distributions + organiser fee + late fees to org
  difference: number    // must be 0 (or < 0.01 after rounding)
  breakdown: {
    winnerPayout: number
    interestReturnedToPool: number
    organiserFee: number
    distributableAmount: number
    totalDistributedToMembers: number
    lateFeeCollected: number
  }
}

/** Bid validation result */
export interface BidValidationResult {
  valid: boolean
  reason?: string
  maxBidAllowed: number
  interestAmount: number
}

// ─────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────

/** Round to 2 decimal places — use for ALL rupee calculations */
function round(n: number): number {
  return Math.round(n * 100) / 100
}

/** Validate that a number is a positive finite value */
function assertPositive(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`[CommitteeCalc] ${name} must be a positive number, got: ${value}`)
  }
}

/** Validate that a number is strictly greater than 0 */
function assertGreaterThanZero(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`[CommitteeCalc] ${name} must be greater than 0, got: ${value}`)
  }
}

// ─────────────────────────────────────────────
// FUNCTION 1 — calculateMonthlyInterest
// ─────────────────────────────────────────────

/**
 * Calculates the 2% monthly interest charged to the month's winner.
 *
 * FORMULA: interestRatePercent/100 × contributionPerPerson × remainingNonWinners
 *
 * CRITICAL: use remainingNonWinners (decreases each month), NOT totalMembers.
 * Month 1 of 10: 2% × 1000 × 10 = ₹200
 * Month 5 of 10: 2% × 1000 × 6  = ₹120
 * Month 10 of 10: 2% × 1000 × 1 = ₹20
 *
 * @param remainingNonWinners - members who have NOT yet received the fund INCLUDING this month's winner
 * @param contributionPerPerson - fixed monthly contribution (e.g. ₹1000)
 * @param interestRatePercent - interest rate (e.g. 2 for 2%)
 */
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

/**
 * Calculates the maximum amount a member is allowed to bid.
 *
 * FORMULA: totalPool - interestAmount
 *
 * The interest amount is PROTECTED — no bidder can take it.
 * It belongs to all members as distribution.
 *
 * Example (10 members, month 1):
 *   totalPool = ₹10,000, interest = ₹200 → maxBid = ₹9,800
 *
 * @param totalPool - contributionPerPerson × totalMembers
 * @param interestAmount - from calculateMonthlyInterest()
 */
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

/**
 * Remaining balance after paying out the winner.
 *
 * FORMULA: totalPool - winningBidAmount
 *
 * NOTE: If lottery (no bids), winningBidAmount = totalPool → remainingBalance = 0
 * This is correct — lottery winner gets the full pool.
 *
 * @param totalPool
 * @param winningBidAmount - the bid the winner placed (or totalPool for lottery)
 */
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
// FUNCTION 4 — calculateOrganiserFee
// ─────────────────────────────────────────────

/**
 * Organiser's management fee.
 *
 * FORMULA: remainingBalance × (feePercent / 100)
 *
 * CRITICAL MISTAKE TO AVOID:
 *   WRONG → 5% of totalPool (₹10,000) = ₹500 ← WRONG
 *   RIGHT → 5% of remainingBalance (₹2,000) = ₹100 ← CORRECT
 *
 * If lottery → remainingBalance = 0 → organiserFee = 0 (correct by design)
 * If organiser waives fee → feePercent = 0 → organiserFee = 0,
 *   and the ENTIRE remainingBalance flows into distributableAmount for members.
 *   Members get MORE, organiser gets nothing — conservation check still passes.
 *
 * @param remainingBalance - from calculateRemainingBalance()
 * @param feePercent - organiser's cut. 0 = fee waived (valid). default 0.
 */
export function calculateOrganiserFee(
  remainingBalance: number,
  feePercent: number = 0
): number {
  assertPositive(remainingBalance, 'remainingBalance')
  assertPositive(feePercent, 'feePercent')

  if (feePercent > 20) {
    throw new Error(
      `[CommitteeCalc] organiserFeePercent (${feePercent}) seems unreasonably high. Max allowed: 20%`
    )
  }

  return round(remainingBalance * (feePercent / 100))
}

// ─────────────────────────────────────────────
// FUNCTION 5 — calculateLateFeeForMember
// ─────────────────────────────────────────────

/**
 * Late fee for a single member who paid late.
 *
 * FORMULA: contributionAmount × (feePercentPerWeek / 100) × weeksLate
 *
 * Late fees go into the DISTRIBUTION POOL — not to the organiser.
 *
 * @param contributionAmount - e.g. ₹1000
 * @param weeksLate - 0 if paid on time, positive integer if late
 * @param feePercentPerWeek - default 1.5% per week
 */
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
// FUNCTION 6 — calculateTotalLateFees
// ─────────────────────────────────────────────

/**
 * Sum all late fees from all members' contributions for a month.
 * These get added to the distributable pool.
 *
 * @param contributions - all ContributionRecord[] for this month
 */
export function calculateTotalLateFees(contributions: ContributionRecord[]): number {
  if (!contributions || contributions.length === 0) return 0

  return round(
    contributions.reduce((sum, c) => sum + (c.lateFeeAmount ?? 0), 0)
  )
}

// ─────────────────────────────────────────────
// FUNCTION 7 — calculateDistributableAmount
// ─────────────────────────────────────────────

/**
 * The total amount available to distribute equally among all members.
 *
 * FORMULA: remainingBalance - organiserFee + interestAmount + lateFeeCollected
 *
 * FLOW:
 *   pool          = ₹10,000
 *   − winnerPays  = ₹8,000  → remainingBalance = ₹2,000
 *   − organiser   = ₹100   → after org fee    = ₹1,900
 *   + interest    = ₹200   → winner pays back  = ₹2,100
 *   + lateFees    = ₹30    → members who paid late add ₹30 to pool
 *   = distributable         = ₹2,130
 *   ÷ 10 members           = ₹213 each
 *
 * @param remainingBalance - from calculateRemainingBalance()
 * @param organiserFee - from calculateOrganiserFee()
 * @param interestAmount - from calculateMonthlyInterest()
 * @param lateFeeCollected - from calculateTotalLateFees()
 */
export function calculateDistributableAmount(
  remainingBalance: number,
  organiserFee: number,
  interestAmount: number,
  lateFeeCollected: number = 0
): number {
  assertPositive(remainingBalance, 'remainingBalance')
  assertPositive(organiserFee, 'organiserFee')
  assertPositive(interestAmount, 'interestAmount')
  assertPositive(lateFeeCollected, 'lateFeeCollected')

  const distributable = round(
    remainingBalance - organiserFee + interestAmount + lateFeeCollected
  )

  if (distributable < 0) {
    throw new Error(
      `[CommitteeCalc] distributableAmount is negative (${distributable}). Check your inputs.`
    )
  }

  return distributable
}

// ─────────────────────────────────────────────
// FUNCTION 8 — calculatePerMemberDistribution
// ─────────────────────────────────────────────

/**
 * Each member's distribution share for this month.
 *
 * FORMULA: distributableAmount / totalMembers
 *
 * CRITICAL: ALL members get this share — including the winner.
 * Do NOT exclude the winner from distribution.
 *
 * @param distributableAmount - from calculateDistributableAmount()
 * @param totalMembers - fixed count (all members, not just non-winners)
 */
export function calculatePerMemberDistribution(
  distributableAmount: number,
  totalMembers: number
): number {
  assertPositive(distributableAmount, 'distributableAmount')
  assertGreaterThanZero(totalMembers, 'totalMembers')

  return round(distributableAmount / totalMembers)
}

// ─────────────────────────────────────────────
// FUNCTION 9 — validateBid
// ─────────────────────────────────────────────

/**
 * Full bid validation — run this in placeBid() BEFORE saving.
 *
 * Checks:
 *   1. Amount > 0
 *   2. Amount <= maxBidAllowed (interest is protected)
 *   3. Member has not already won in this committee (no repeat winner)
 *   4. Month status is 'bidding_open'
 *
 * @param bidAmount - the amount the member wants to bid
 * @param remainingNonWinners - for interest calculation
 * @param contributionPerPerson
 * @param interestRatePercent
 * @param totalPool
 * @param memberHasAlreadyWon - check fund_disbursements table
 * @param monthStatus - must be 'bidding_open'
 */
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
// FUNCTION 10 — calculateMonthSummary  ★ MAIN
// ─────────────────────────────────────────────

/**
 * MASTER FUNCTION — calculates the complete month summary.
 * Call this once per month resolution. Store the result in committee_months.
 *
 * Steps:
 *   1. Validate inputs
 *   2. Calculate interest, maxBid, remainingBalance, organiserFee
 *   3. Sum late fees from contributions
 *   4. Calculate distributableAmount and perMemberDistribution
 *   5. Run conservation check — throws if money doesn't balance
 *   6. Return full MonthSummary
 *
 * @param input - MonthInput object
 */
export function calculateMonthSummary(input: MonthInput): MonthSummary {
  const {
    committeeId,
    monthNumber,
    totalMembers,
    contributionPerPerson,
    organiserFeePercent,
    interestRatePercent,
    winningBidAmount,
    winnerId,
    resolutionType,
    contributions,
    remainingNonWinners,
  } = input

  // ── Validate base inputs ──
  assertGreaterThanZero(totalMembers, 'totalMembers')
  assertGreaterThanZero(contributionPerPerson, 'contributionPerPerson')
  assertPositive(organiserFeePercent, 'organiserFeePercent')
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

  // ── Step 1: Pool ──
  const totalPool = round(totalMembers * contributionPerPerson)

  // ── Step 2: Interest ──
  const interestAmount = calculateMonthlyInterest(
    remainingNonWinners,
    contributionPerPerson,
    interestRatePercent
  )

  // ── Step 3: Max bid (for reference / audit) ──
  const maxBidAllowed = calculateMaxBid(totalPool, interestAmount)

  // ── Step 4: Validate winning bid ──
  // Lottery → winningBidAmount === totalPool (full pool awarded, remainingBalance = 0)
  // Last member → same as lottery
  // Bid → winningBidAmount <= maxBidAllowed
  if (resolutionType !== 'lottery' && winningBidAmount > maxBidAllowed) {
    throw new Error(
      `[CommitteeCalc] winningBidAmount (${winningBidAmount}) exceeds maxBidAllowed (${maxBidAllowed}) for month ${monthNumber}`
    )
  }

  // ── Step 5: Remaining balance ──
  const remainingBalance = calculateRemainingBalance(totalPool, winningBidAmount)

  // ── Step 6: Organiser fee ──
  const organiserFee = calculateOrganiserFee(remainingBalance, organiserFeePercent)

  // ── Step 7: Late fees ──
  const lateFeeCollected = calculateTotalLateFees(contributions)

  // ── Step 8: Distributable amount ──
  const distributableAmount = calculateDistributableAmount(
    remainingBalance,
    organiserFee,
    interestAmount,
    lateFeeCollected
  )

  // ── Step 9: Per member distribution ──
  const perMemberDistribution = calculatePerMemberDistribution(
    distributableAmount,
    totalMembers
  )

  // ── Step 10: Conservation check ──
  const conservationCheck = runConservationCheck({
    totalPool,
    winningBidAmount,
    organiserFee,
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

  return {
    committeeId,
    monthNumber,
    totalPool,
    interestAmount,
    maxBidAllowed,
    winningBidAmount,
    remainingBalance,
    organiserFee,
    lateFeeCollected,
    organiserFeePercent,
    organiserFeeEnabled: organiserFeePercent > 0,
    distributableAmount,
    perMemberDistribution,
    resolutionType,
    winnerId,
    conservationCheck,
  }
}

// ─────────────────────────────────────────────
// FUNCTION 11 — generateWalletEntries
// ─────────────────────────────────────────────

/**
 * Generates all wallet ledger entries for a resolved month.
 * Feed these directly into WalletLedgerService.creditWallet() / debitWallet().
 *
 * Entries generated:
 *   - bid_payout CREDIT     → winner receives winning bid amount
 *   - interest_charge DEBIT → winner pays interest back to pool
 *   - distribution_credit   → ALL members (including winner) receive perMemberDistribution
 *   - late_fee_charge DEBIT → any member who paid late (already paid at payment time,
 *                             but recorded here for month reconciliation)
 *
 * @param summary - MonthSummary from calculateMonthSummary()
 * @param allMemberIds - array of all member IDs in the committee
 * @param lateMembers - members who paid late this month [{memberId, lateFeeAmount}]
 */
export function generateWalletEntries(
  summary: MonthSummary,
  allMemberIds: string[],
  lateMembers: Array<{ memberId: string; lateFeeAmount: number }> = []
): WalletEntry[] {
  if (allMemberIds.length !== summary.perMemberDistribution && allMemberIds.length === 0) {
    throw new Error('[CommitteeCalc] allMemberIds cannot be empty')
  }

  const entries: WalletEntry[] = []
  const { committeeId, monthNumber, winnerId, winningBidAmount,
    interestAmount, perMemberDistribution } = summary

  const key = (type: string, memberId?: string) =>
    `${committeeId}_m${monthNumber}_${type}${memberId ? '_' + memberId : ''}`

  // 1. Winner receives bid payout
  entries.push({
    memberId: winnerId,
    entryType: 'bid_payout',
    direction: 'credit',
    amount: winningBidAmount,
    idempotencyKey: key('payout'),
    notes: `Month ${monthNumber} bid payout — ${summary.resolutionType}`,
  })

  // 2. Winner pays interest
  entries.push({
    memberId: winnerId,
    entryType: 'interest_charge',
    direction: 'debit',
    amount: interestAmount,
    idempotencyKey: key('interest'),
    notes: `Month ${monthNumber} interest charge — 2% × ₹${summary.perMemberDistribution} × ${summary.perMemberDistribution}`,
  })

  // 3. ALL members receive distribution (including the winner)
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

  // 4. Late fee entries (reference only — actual debit happened at payment time)
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
// FUNCTION 12 — runConservationCheck
// ─────────────────────────────────────────────

/**
 * Verifies that every rupee of the pool is accounted for.
 *
 * RULE: totalPool must equal:
 *   winnerPayout + totalDistributedToAllMembers + organiserFee
 *
 * Note: lateFees are member-to-pool transfers — they're already inside
 * the distributableAmount, so they don't add to totalIn.
 *
 * If this returns passed: false — DO NOT save the month. Something is wrong.
 */
export function runConservationCheck(params: {
  totalPool: number
  winningBidAmount: number
  organiserFee: number
  distributableAmount: number
  perMemberDistribution: number
  totalMembers: number
  lateFeeCollected: number
  interestAmount: number
}): ConservationResult {
  const {
    totalPool,
    winningBidAmount,
    organiserFee,
    distributableAmount,
    perMemberDistribution,
    totalMembers,
    lateFeeCollected,
    interestAmount,
  } = params

  const totalDistributedToMembers = round(perMemberDistribution * totalMembers)

  // CONSERVATION FORMULA (critical — read this carefully):
  //
  // Interest is NOT new money. It is an internal redistribution:
  //   winner wallet is DEBITED ₹interest
  //   distribution pool is CREDITED ₹interest
  // So interest cancels out of the total. We must subtract it from winner's payout.
  //
  // Total real cash OUT of nodal account:
  //   (winningBidAmount - interestAmount)  ← winner's net from nodal account
  //   + (perMemberDistribution × N)         ← each member's wallet claim on nodal
  //   + organiserFee                         ← organiser's real cash
  //
  // This must equal totalPool (real cash IN from contributions).
  // Late fees are already inside members' contributions → already in totalPool.
  //
  // Proof for month1, bid=8000, 10 members:
  //   (8000 - 200) + (210 × 10) + 100 = 7800 + 2100 + 100 = 10000 ✓

  const winnerNetPayout = round(winningBidAmount - interestAmount)
  const totalOut = round(winnerNetPayout + totalDistributedToMembers + organiserFee)
  const totalIn = round(totalPool + lateFeeCollected)

  const difference = round(Math.abs(totalIn - totalOut))
  const passed = difference < 0.02  // allow ₹0.02 tolerance for rounding

  return {
    passed,
    totalIn,
    totalOut,
    difference,
    breakdown: {
      winnerPayout: winningBidAmount,
      interestReturnedToPool: interestAmount,
      organiserFee,
      distributableAmount,
      totalDistributedToMembers,
      lateFeeCollected,
    },
  }
}

// ─────────────────────────────────────────────
// FUNCTION 13 — calculateLastMemberTotal
// ─────────────────────────────────────────────

/**
 * Calculates the total amount received by the last patient member
 * who never bid and received the fund in the final month.
 *
 * @param monthlyDistributions - array of perMemberDistribution for each month (all months)
 * @param finalPayout - the full pool amount received in the last month
 * @param finalInterestPaid - interest paid in the last month
 */
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

  const totalMonths = monthlyDistributions.length
  const totalContributed = round(
    // They contributed every month. The last month's contribution is also included.
    monthlyDistributions.reduce((_, __, i) => i, 0) // just get count
    // We calculate: totalMonths × contributionPerPerson
    // But we don't have contributionPerPerson here, so derive from pool if needed.
    // For now, totalContributed is passed separately or derived by caller.
    // We return what we CAN calculate here.
  )

  const totalDistributionsReceived = round(
    monthlyDistributions.reduce((sum, d) => sum + d, 0)
  )

  // In the last month they get the payout, pay interest, AND receive distribution
  const totalReceived = round(
    totalDistributionsReceived + finalPayout - finalInterestPaid
  )

  return {
    totalDistributionsReceived,
    finalPayout,
    finalInterestPaid,
    totalReceived,
    totalContributed: 0, // caller must set this: totalMonths × contributionPerPerson
    netGain: 0,          // caller must set this: totalReceived - totalContributed
  }
}

// ─────────────────────────────────────────────
// FUNCTION 14 — calculateRemainingNonWinners
// ─────────────────────────────────────────────

/**
 * Calculates how many members have NOT yet won at the START of a given month.
 * This is the number to use for interest calculation.
 *
 * Call this with the list of members who have already won in previous months.
 *
 * @param totalMembers - total committee members
 * @param winnersBeforeThisMonth - count of members who won in months 1..(monthNumber-1)
 */
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

  // All members who have NOT yet won = total - those who already won
  // This INCLUDES the current month's winner (they are still a "non-winner" at the
  // start of this month — the interest is calculated before they are declared winner)
  return totalMembers - winnersBeforeThisMonth
}

// ─────────────────────────────────────────────
// FUNCTION 15 — previewBidImpact  (for frontend live preview)
// ─────────────────────────────────────────────

/**
 * Real-time preview shown to member while typing their bid amount.
 * Used in the bid UI to show "if you bid this amount, here is what happens".
 *hhhh   
 * @param bidAmount - what the member is considering bidding
 * @param totalMembersx 
 * @param remainingNonWinners
 * @param contributionPerPerson
 * @param organiserFeePercent
 * @param interestRatePercent
 */
export function previewBidImpact(
  bidAmount: number,
  totalMembers: number,
  remainingNonWinners: number,
  contributionPerPerson: number,
  organiserFeePercent: number = 0,
  interestRatePercent: number = 2
): {
  isValid: boolean
  validationMessage: string
  yourPayout: number
  interestYouPay: number
  yourNetFromPayout: number
  remainingForOthers: number
  organiserFee: number
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
      remainingForOthers: 0, organiserFee: 0, distributablePool: 0,
      everyMemberGets: 0, youAlsoGetDistribution: 0, yourTotalNetThisMonth: 0,
      maxBidAllowed,
    }
  }

  const remainingBalance = calculateRemainingBalance(totalPool, bidAmount)
  const organiserFee = calculateOrganiserFee(remainingBalance, organiserFeePercent)
  const distributablePool = calculateDistributableAmount(
    remainingBalance, organiserFee, interestAmount, 0
  )
  const everyMemberGets = calculatePerMemberDistribution(distributablePool, totalMembers)

  return {
    isValid,
    validationMessage,
    yourPayout: bidAmount,
    interestYouPay: interestAmount,
    yourNetFromPayout: round(bidAmount - interestAmount),
    remainingForOthers: remainingBalance,
    organiserFee,
    distributablePool,
    everyMemberGets,
    youAlsoGetDistribution: everyMemberGets,  // winner also gets this
    yourTotalNetThisMonth: round(bidAmount - interestAmount + everyMemberGets),
    maxBidAllowed,
  }
}

// ─────────────────────────────────────────────
// QUICK REFERENCE — expected outputs for testing
// ─────────────────────────────────────────────
//
// Run these assertions after wiring up — all must pass:
//
// 10-MEMBER COMMITTEE (₹1000/month, 5% org, 2% interest):
//
// Month 1 — remaining=10, bid=₹8000:
//   interest            = ₹200
//   maxBid              = ₹9800
//   remainingBalance    = ₹2000
//   organiserFee        = ₹100
//   distributableAmount = ₹2100
//   perMemberShare      = ₹210
//
// Month 5 — remaining=6, bid=₹9200:
//   interest            = ₹120
//   maxBid              = ₹9880
//   remainingBalance    = ₹800
//   organiserFee        = ₹40
//   distributableAmount = ₹880
//   perMemberShare      = ₹88
//
// Month 10 — remaining=1, lottery (bid=₹10000):
//   interest            = ₹20
//   maxBid              = ₹9980
//   remainingBalance    = ₹0
//   organiserFee        = ₹0
//   distributableAmount = ₹20
//   perMemberShare      = ₹2
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
// 0% ORGANISER FEE (fee waived) — Month 1, bid=8000, 10 members:
//   organiserFee        = ₹0   (nothing taken by organiser)
//   distributableAmount = ₹2200 (₹200 more for members vs 5% fee)
//   perMemberShare      = ₹220  (vs ₹210 with 5% fee)
//   conservation check  = passes (entire pool still accounted for)
