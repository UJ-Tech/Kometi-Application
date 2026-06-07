// src/types/index.ts
// Shared domain types matching the Prisma schema / API response shapes

export type UserRole    = "ADMIN" | "MANAGER" | "ACCOUNTANT" | "AGENT" | "ORGANIZER" | "MEMBER";
export type KYCStatus   = "PENDING" | "SUBMITTED" | "VERIFIED" | "REJECTED";
export type CommitteeStatus = "DRAFT" | "ACTIVE" | "COMPLETED" | "CANCELLED";
export type CommitteeType   = "FIXED_WINNER" | "AUCTION" | "FIXED_ORDER";
export type InstallmentStatus = "PENDING" | "PAID" | "OVERDUE" | "PARTIAL" | "WAIVED";
export type PaymentMethod    = "CASH" | "UPI" | "BANK_TRANSFER" | "WALLET";
export type TransactionType  = "CREDIT" | "DEBIT";
export type TransactionCategory =
  | "INSTALLMENT_PAYMENT"
  | "COMMITTEE_PAYOUT"
  | "WALLET_TOPUP"
  | "WALLET_TRANSFER"
  | "PENALTY"
  | "REFUND"
  | "ADJUSTMENT"
  | "COMMISSION";
export type TransactionStatus  = "PENDING" | "COMPLETED" | "FAILED" | "REVERSED";
export type NotificationType =
  | "INSTALLMENT_DUE"
  | "INSTALLMENT_PAID"
  | "COMMITTEE_PAYOUT"
  | "COMMITTEE_START"
  | "KYC_UPDATE"
  | "WALLET_CREDIT"
  | "WALLET_DEBIT";

export type JoinRequestStatus = "PENDING" | "APPROVED" | "REJECTED";

// ─── User ────────────────────────────────────────────────────────────────────
export interface User {
  id:             string;
  phone:          string;
  name:           string;
  email?:         string;
  role:           UserRole;
  isActive:       boolean;
  kycStatus:      KYCStatus;
  profileImageUrl?: string;
  lastLoginAt?:   string;
  createdAt:      string;
  updatedAt:      string;
}

export interface KYCDocument {
  id:            string;
  userId:        string;
  aadhaarNum?:   string;   // masked
  panNum?:       string;   // masked
  aadhaarUrl?:   string;
  panUrl?:       string;
  selfieUrl?:    string;
  status:        KYCStatus;
  rejectedReason?: string;
  verifiedAt?:   string;
}

// ─── Committee ───────────────────────────────────────────────────────────────
export interface Committee {
  id:                    string;
  name:                  string;
  description?:          string;
  organizerId:           string;
  organizer?:            User;
  inviteCode:            string;
  type:                  CommitteeType;
  status:                CommitteeStatus;
  totalSlots:            number;
  filledSlots:           number;
  installmentAmountPaise: number;   // Returned as number from API (paise)
  cycleDurationDays:     number;
  startDate?:            string;
  endDate?:              string;
  nextDueDate?:          string;
  currentCycleNo:        number;
  penaltyRatePct:        number;
  gracePeriodDays:       number;
  commissionRatePct:     number;
  maxDiscountPct:        number;
  createdAt:             string;
  updatedAt:             string;
}

export interface CommitteeMember {
  id:               string;
  committeeId:      string;
  userId:           string;
  user?:            User;
  slotNumber:       number;
  joinedAt:         string;
  isActive:         boolean;
  hasReceivedPayout: boolean;
  payoutOrder?:     number;
}

export interface CommitteeDetail extends Committee {
  members:      CommitteeMember[];
  myMembership: CommitteeMember | null;
}

// ─── Installment ─────────────────────────────────────────────────────────────
export interface Installment {
  id:               string;
  committeeId:      string;
  committee?:       Pick<Committee, "id" | "name" | "penaltyRatePct" | "gracePeriodDays">;
  memberId:         string;
  userId:           string;
  user?:            Pick<User, "id" | "name" | "phone" | "profileImageUrl">;
  cycleNo:          number;
  amountDuePaise:   number;
  amountPaidPaise:  number;
  penaltyPaise:     number;
  status:           InstallmentStatus;
  dueDate:          string;
  paidAt?:          string;
  paymentMethod?:   PaymentMethod;
  paymentReference?: string;
  collectedById?:   string;
  notes?:           string;
  createdAt:        string;
  updatedAt:        string;
}

// ─── Wallet & Transactions ───────────────────────────────────────────────────
export interface Wallet {
  id:            string;
  userId:        string;
  balancePaise:  number;
  reservedPaise: number;
  currency:      string;
  isActive:      boolean;
  createdAt:     string;
  updatedAt:     string;
}

export interface Transaction {
  id:              string;
  walletId:        string;
  userId:          string;
  type:            TransactionType;
  category:        TransactionCategory;
  status:          TransactionStatus;
  amountPaise:     number;
  balanceBefore:   number;
  balanceAfter:    number;
  description:     string;
  referenceId?:    string;
  referenceType?:  string;
  paymentMethod?:  PaymentMethod;
  externalTxnId?:  string;
  installmentId?:  string;
  failureReason?:  string;
  metadata?:       Record<string, unknown>;
  idempotencyKey:  string;
  createdAt:       string;
  updatedAt:       string;
}

// ─── Notifications ──────────────────────────────────────────────────────────
export interface AppNotification {
  id:        string;
  userId:    string;
  type:      NotificationType;
  title:     string;
  body:      string;
  isRead:    boolean;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

// ─── API Envelope ────────────────────────────────────────────────────────────
export interface ApiResponse<T> {
  success: boolean;
  data:    T;
  error?:  string;
  meta?:   PaginationMeta;
}

export interface PaginationMeta {
  total:   number;
  page:    number;
  limit:   number;
  hasMore: boolean;
  cursor?: string;
}

// ─── Collect Payload ─────────────────────────────────────────────────────────
export interface CollectInstallmentPayload {
  amountPaidPaise:   number;
  paymentMethod:     PaymentMethod;
  paymentReference?: string;
  notes?:            string;
}

// ─── Bid ────────────────────────────────────────────────────────────────────
export interface Bid {
  id:             string;
  committeeId:    string;
  cycleNo:        number;
  memberId:       string;
  userId:         string;
  bidAmountPaise: number;
  createdAt:      string;
}

// ─── Join Request ─────────────────────────────────────────────────────────────
export interface JoinRequest {
  id:             string;
  committeeId:    string;
  userId:         string;
  status:         JoinRequestStatus;
  reviewedById?:  string;
  reviewedAt?:    string;
  user?:          Pick<User, "id" | "name" | "phone" | "email" | "kycStatus">;
  committee?:     Pick<Committee, "id" | "name">;
  createdAt:      string;
  updatedAt:      string;
}
