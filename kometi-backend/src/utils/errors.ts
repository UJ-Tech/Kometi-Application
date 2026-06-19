// src/utils/errors.ts
// Custom error classes for domain-specific error handling.

export class InsufficientBalanceError extends Error {
  public readonly availableBalance: number;
  public readonly requestedAmount: number;
  
  constructor(availableBalance: number, requestedAmount: number) {
    super(
      `Insufficient balance: requested ${requestedAmount} paise but only ${availableBalance} paise available.`
    );
    this.name = "InsufficientBalanceError";
    this.availableBalance = availableBalance;
    this.requestedAmount = requestedAmount;
  }
}

export class IdempotencyConflictError extends Error {
  public readonly existingEntryId: string;

  constructor(existingEntryId: string) {
    super(`Duplicate request: ledger entry already exists (id=${existingEntryId}).`);
    this.name = "IdempotencyConflictError";
    this.existingEntryId = existingEntryId;
  }
}

export class LedgerEntryNotFoundError extends Error {
  constructor(entryId: string) {
    super(`Ledger entry not found: ${entryId}`);
    this.name = "LedgerEntryNotFoundError";
  }
}

export class ReversalNotAllowedError extends Error {
  constructor(entryId: string, currentStatus: string) {
    super(
      `Cannot reverse entry ${entryId}: current status is '${currentStatus}'. Only 'confirmed' entries can be reversed.`
    );
    this.name = "ReversalNotAllowedError";
  }
}

// ─── Withdrawal Errors ───────────────────────────────────────────────

export class KycNotVerifiedError extends Error {
  constructor() {
    super("Complete KYC verification before withdrawing");
    this.name = "KycNotVerifiedError";
  }
}

export class MinimumWithdrawalError extends Error {
  constructor(amountPaise: number) {
    super(`Minimum withdrawal is ₹100. Requested: ₹${amountPaise / 100}`);
    this.name = "MinimumWithdrawalError";
  }
}

export class DailyWithdrawalLimitError extends Error {
  constructor(count: number) {
    super(`Daily withdrawal limit reached, try again tomorrow. Recent withdrawals: ${count}`);
    this.name = "DailyWithdrawalLimitError";
  }
}

export class DailyAmountLimitError extends Error {
  constructor(sumPaise: number, requestedPaise: number) {
    super(
      `Daily withdrawal amount limit exceeded. Today's total: ₹${(sumPaise + requestedPaise) / 100}, limit: ₹50,000`
    );
    this.name = "DailyAmountLimitError";
  }
}

export class InactiveMemberError extends Error {
  constructor(memberId: string, committeeId: string) {
    super(
      `Member ${memberId} is not active in committee ${committeeId}`
    );
    this.name = "InactiveMemberError";
  }
}

export class WithdrawalNotFoundError extends Error {
  constructor(withdrawalId: string) {
    super(`Withdrawal request not found: ${withdrawalId}`);
    this.name = "WithdrawalNotFoundError";
  }
}

export class WithdrawalFailedError extends Error {
  constructor(withdrawalId: string, reason: string) {
    super(`Withdrawal ${withdrawalId} failed: ${reason}`);
    this.name = "WithdrawalFailedError";
  }
}

export class WithdrawalNotCancellableError extends Error {
  constructor(withdrawalId: string, currentStatus: string) {
    super(
      `Cannot cancel withdrawal ${withdrawalId}: current status is '${currentStatus}'. Only 'requested' withdrawals can be cancelled.`
    );
    this.name = "WithdrawalNotCancellableError";
  }
}

export class LedgerIntegrityError extends Error {
  public readonly committeeId: string;
  public readonly monthId: string;
  public readonly totalCredits: number;
  public readonly totalDebits: number;
  public readonly imbalance: number;

  constructor(
    committeeId: string,
    monthId: string,
    totalCredits: number,
    totalDebits: number
  ) {
    super(
      `Ledger integrity violation for committee ${committeeId}, month ${monthId}: ` +
      `total credits (${totalCredits}) != total debits (${totalDebits}), imbalance: ${totalCredits - totalDebits} paise`
    );
    this.name = "LedgerIntegrityError";
    this.committeeId = committeeId;
    this.monthId = monthId;
    this.totalCredits = totalCredits;
    this.totalDebits = totalDebits;
    this.imbalance = totalCredits - totalDebits;
  }
}
