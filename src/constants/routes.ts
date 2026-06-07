// src/constants/routes.ts
// Typed route constants — keeps navigation calls refactor-safe

export const ROUTES = {
  // Auth group
  AUTH: {
    WELCOME:         "/(auth)/welcome",
    LOGIN:           "/(auth)/login",
    OTP_VERIFY:      "/(auth)/otp-verify",
    REGISTER:        "/(auth)/register",
    MPIN_SETUP:      "/(auth)/mpin-setup",
    MPIN_ENTER:      "/(auth)/mpin-enter",
    ROLE_SELECT:     "/(auth)/role-select",
    JOIN_COMMITTEE:  "/(auth)/join-committee",
    JOIN_PENDING:    "/(auth)/join-pending",
  },

  // App group
  APP: {
    DASHBOARD:   "/(app)/dashboard",

    // Members
    MEMBERS:             "/(app)/members",
    MEMBER_DETAIL:       (id: string) => `/(app)/members/${id}` as const,
    MEMBER_ADD:          "/(app)/members/add",
    MEMBER_KYC:          (id: string) => `/(app)/members/kyc/${id}` as const,

    // Committees
    COMMITTEES:          "/(app)/committees",
    COMMITTEE_DETAIL:    (id: string) => `/(app)/committees/${id}` as const,
    COMMITTEE_CREATE:    "/(app)/committees/create",
    COMMITTEE_MEMBERS:   (id: string) => `/(app)/committees/${id}/members` as const,
    COMMITTEE_SCHEDULE:  (id: string) => `/(app)/committees/${id}/schedule` as const,
    COMMITTEE_BID:       (id: string) => `/(app)/committees/${id}/bid` as const,

    // Installments
    INSTALLMENTS:        "/(app)/installments",
    INSTALLMENT_COLLECT: "/(app)/installments/collect",
    INSTALLMENT_HISTORY: "/(app)/installments/history",

    // Wallet
    WALLET:              "/(app)/wallet",
    WALLET_TOPUP:        "/(app)/wallet/topup",
    WALLET_TRANSFER:     "/(app)/wallet/transfer",
    WALLET_LEDGER:       "/(app)/wallet/ledger",

    // Profile
    PROFILE:             "/(app)/profile",
  },
} as const;
