// src/utils/currency.ts
// ALL monetary values in the app are stored/transmitted in PAISE (BigInt).
// These helpers handle conversion and formatting — never use floats for money.

/**
 * Format paise to a human-readable ₹ string.
 * e.g. 250000n → "₹2,500.00"
 */
export function formatINR(paise: bigint | number): string {
  const rupees = Number(paise) / 100;
  return new Intl.NumberFormat("en-IN", {
    style:                 "currency",
    currency:              "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rupees);
}

/**
 * Format paise to compact short form.
 * e.g. 500000n → "₹5K"  |  5000000n → "₹50K"  |  10000000n → "₹1L"
 */
export function formatINRCompact(paise: bigint | number): string {
  const rupees = Number(paise) / 100;
  if (rupees >= 10_00_000) return `₹${(rupees / 10_00_000).toFixed(1)}L`;
  if (rupees >= 1_000)     return `₹${(rupees / 1_000).toFixed(1)}K`;
  return `₹${rupees.toFixed(0)}`;
}

/**
 * Convert rupees (user-facing number) to paise (storage).
 * Rounds to nearest paisa to avoid float drift.
 */
export function toPaise(rupees: number | string): bigint {
  const n = typeof rupees === "string" ? parseFloat(rupees) : rupees;
  if (isNaN(n) || n < 0) return 0n;
  return BigInt(Math.round(n * 100));
}

/**
 * Convert paise to rupees as a number (only for display, never for storage).
 */
export function toRupees(paise: bigint | number): number {
  return Number(paise) / 100;
}

/**
 * Convert paise to rupees as a string (for input fields).
 */
export function paiseToRupeesString(paise: bigint | number): string {
  return (Number(paise) / 100).toFixed(2);
}

/**
 * Calculate penalty amount in paise.
 * penaltyRatePct is a percentage like 2.5 (meaning 2.5% per day late).
 */
export function calculatePenalty(
  amountPaise: bigint,
  penaltyRatePct: number,
  daysLate: number,
): bigint {
  // Simple interest penalty: amount * rate/100 * days/30 (monthly rate)
  const penaltyFraction = (penaltyRatePct / 100) * (daysLate / 30);
  return BigInt(Math.round(Number(amountPaise) * penaltyFraction));
}

/**
 * Validate that paise value is within allowed committee installment bounds.
 */
export function isValidInstallmentAmount(paise: bigint): boolean {
  return paise >= 10_000n && paise <= 100_000_00n;
}
