// src/constants/config.ts
// App-wide configuration constants


const apiBaseUrl = "https://kometi-application.onrender.com/api/v1";
const socketUrl  = "https://kometi-application.onrender.com";

export const APP_CONFIG = {
  name:    "Kometi",
  version: "1.0.0",
  scheme:  "kometi",

  // API
  API_BASE_URL:    apiBaseUrl,
  SOCKET_URL:      socketUrl,
  API_TIMEOUT_MS:  30_000,

  // Auth
  OTP_LENGTH:             6,
  OTP_EXPIRY_SECONDS:     300,  // 5 min
  OTP_MAX_ATTEMPTS:       3,
  MPIN_LENGTH:            6,
  ACCESS_TOKEN_KEY:       "kometi_access_token",
  REFRESH_TOKEN_KEY:      "kometi_refresh_token",
  USER_KEY:               "kometi_user",

  // Pagination
  PAGE_SIZE: 20,

  // Finance
  MIN_INSTALLMENT_PAISE:  10_000,    // ₹100
  MAX_INSTALLMENT_PAISE:  100_000_00, // ₹1,00,000
  MIN_COMMITTEE_SLOTS:    2,
  MAX_COMMITTEE_SLOTS:    50,
  VALID_CYCLE_DAYS:       [7, 14, 30] as number[],

  // Wallet
  WALLET_LOW_BALANCE_THRESHOLD_PAISE: 50_000, // ₹500 warning

  // Cache TTL (ms)
  CACHE_TTL: {
    wallet:      30_000,   // 30 sec
    committees:  60_000,   // 1 min
    members:     120_000,  // 2 min
    installments: 30_000,
  },
} as const;

export type AppConfig = typeof APP_CONFIG;
