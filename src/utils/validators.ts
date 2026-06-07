// src/utils/validators.ts
// All input validation rules for Kometi fintech fields

/** Indian mobile number: starts with 6-9, 10 digits */
export function isValidPhone(phone: string): boolean {
  return /^[6-9]\d{9}$/.test(phone.trim());
}

/** Aadhaar: exactly 12 digits (Verhoeff checksum skipped for MVP) */
export function isValidAadhaar(aadhaar: string): boolean {
  const cleaned = aadhaar.replace(/\s|-/g, "");
  return /^\d{12}$/.test(cleaned);
}

/** Mask Aadhaar: show only last 4 digits */
export function maskAadhaar(aadhaar: string): string {
  const cleaned = aadhaar.replace(/\s|-/g, "");
  return `XXXX-XXXX-${cleaned.slice(-4)}`;
}

/** PAN: 5 alpha + 4 digit + 1 alpha, all uppercase */
export function isValidPAN(pan: string): boolean {
  return /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan.trim().toUpperCase());
}

/** Mask PAN: show only last 4 characters */
export function maskPAN(pan: string): string {
  return `XXXXXX${pan.slice(-4).toUpperCase()}`;
}

/** MPIN: exactly 6 digits, not sequential, not all-same */
export function isValidMPIN(mpin: string): boolean {
  if (!/^\d{6}$/.test(mpin)) return false;
  // Reject all-same digits
  if (/^(.)\1+$/.test(mpin)) return false;
  // Reject sequential ascending (123456, 234567…)
  const ascending = Array.from({ length: 6 }, (_, i) => (parseInt(mpin[0]) + i) % 10).join("");
  if (mpin === ascending) return false;
  // Reject sequential descending (987654…)
  const descending = Array.from({ length: 6 }, (_, i) => ((parseInt(mpin[0]) - i) + 10) % 10).join("");
  if (mpin === descending) return false;
  return true;
}

/** Name: 2-60 chars, letters, spaces, dots, hyphens */
export function isValidName(name: string): boolean {
  return /^[a-zA-Z][a-zA-Z\s.\-']{1,58}[a-zA-Z]$/.test(name.trim());
}

/** Email: standard RFC-ish check */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/** OTP: exactly 6 digits */
export function isValidOTP(otp: string): boolean {
  return /^\d{6}$/.test(otp);
}

/** Committee name: 3-80 chars */
export function isValidCommitteeName(name: string): boolean {
  return name.trim().length >= 3 && name.trim().length <= 80;
}

/** Amount in rupees string (user input): must be positive number */
export function isValidRupeeInput(value: string): boolean {
  const n = parseFloat(value);
  return !isNaN(n) && n > 0 && value.replace(".", "").length <= 10;
}

/** UPI ID: basic format check */
export function isValidUPIId(upi: string): boolean {
  return /^[\w.\-]{2,256}@[a-zA-Z]{2,64}$/.test(upi.trim());
}

/** IFSC: 11-character bank code */
export function isValidIFSC(ifsc: string): boolean {
  return /^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc.trim().toUpperCase());
}
