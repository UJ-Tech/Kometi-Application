// src/utils/razorpay.ts
// Razorpay Checkout: web popup via Checkout.js, mobile native via react-native-razorpay,
// Expo Go fallback via expo-web-browser + backend callback page.

import { Platform, Linking } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { APP_CONFIG } from "../constants/config";

declare global {
  interface Window {
    Razorpay: any;
  }
}

export interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  handler: (response: RazorpayResponse) => void;
  modal?: {
    ondismiss?: () => void;
  };
  theme?: {
    color?: string;
  };
}

export interface RazorpayResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

const DEEP_LINK_SCHEME = "kometi://payment-callback";

// ─── Web: Checkout.js script ───────────────────────────────────────────────

let scriptLoaded = false;
let scriptLoading = false;

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (Platform.OS !== "web") {
      resolve(false);
      return;
    }

    if (scriptLoaded && window.Razorpay) {
      resolve(true);
      return;
    }

    if (scriptLoading) {
      const check = setInterval(() => {
        if (scriptLoaded && window.Razorpay) {
          clearInterval(check);
          resolve(true);
        }
      }, 100);
      return;
    }

    scriptLoading = true;

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => {
      scriptLoaded = true;
      scriptLoading = false;
      resolve(true);
    };
    script.onerror = () => {
      scriptLoading = false;
      resolve(false);
    };

    document.body.appendChild(script);
  });
}

// ─── Expo Go fallback: browser checkout + deep link + polling fallback ──────

function buildCheckoutUrl(options: RazorpayOptions): string {
  const params = new URLSearchParams({
    key: options.key,
    amount: String(options.amount),
    currency: options.currency,
    name: options.name,
    description: options.description,
    order_id: options.order_id,
  });

  if (options.prefill?.name) params.set("prefill_name", options.prefill.name);
  if (options.prefill?.email) params.set("prefill_email", options.prefill.email);
  if (options.prefill?.contact) params.set("prefill_contact", options.prefill.contact);
  if (options.theme?.color) params.set("theme_color", options.theme.color);

  const baseUrl = APP_CONFIG.API_BASE_URL.replace(/\/api\/v1\/?$/, "");
  return `${baseUrl}/payments/checkout?${params.toString()}`;
}

function parseQueryString(qs: string): Record<string, string> {
  const result: Record<string, string> = {};
  new URLSearchParams(qs).forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

async function openBrowserCheckout(options: RazorpayOptions): Promise<void> {
  const url = buildCheckoutUrl(options);
  let handled = false;

  const finish = (fn: () => void) => {
    if (handled) return;
    handled = true;
    fn();
  };

  return new Promise<void>((resolve, reject) => {
    // Listen for deep link from "Return to App" button on callback page
    const sub = Linking.addEventListener("url", ({ url: deepLinkUrl }) => {
      if (handled) return;

      try {
        const queryStart = deepLinkUrl.indexOf("?");
        const qs = queryStart >= 0 ? deepLinkUrl.slice(queryStart + 1) : "";
        const params = parseQueryString(qs);

        finish(() => {
          sub.remove();

          if (params.status === "success" && params.orderId && params.paymentId && params.signature) {
            options.handler({
              razorpay_order_id: params.orderId,
              razorpay_payment_id: params.paymentId,
              razorpay_signature: params.signature,
            });
            resolve();
          } else if (params.status === "failed") {
            options.modal?.ondismiss?.();
            reject(new Error(decodeURIComponent(params.error || "Payment failed")));
          } else {
            options.modal?.ondismiss?.();
            resolve();
          }
        });
      } catch {
        finish(() => {
          sub.remove();
          options.modal?.ondismiss?.();
          reject(new Error("Payment cancelled"));
        });
      }
    });

    WebBrowser.openBrowserAsync(url).then(({ type }) => {
      finish(() => {
        sub.remove();

        if (type === "cancel" || type === "dismiss") {
          options.modal?.ondismiss?.();
          resolve();
        }
      });
    }).catch((err) => {
      finish(() => {
        sub.remove();
        reject(err);
      });
    });
  });
}

// ─── Try native Razorpay SDK ───────────────────────────────────────────────

async function tryNativeCheckout(options: RazorpayOptions): Promise<boolean> {
  try {
    const RazorpayCheckout = require("react-native-razorpay").default;
    if (!RazorpayCheckout || typeof RazorpayCheckout.open !== "function") {
      return false;
    }

    const result = await RazorpayCheckout.open({
      key: options.key,
      amount: options.amount,
      currency: options.currency,
      name: options.name,
      description: options.description,
      order_id: options.order_id,
      prefill: options.prefill || {},
      theme: options.theme || {},
    });

    options.handler({
      razorpay_order_id: result.razorpay_order_id,
      razorpay_payment_id: result.razorpay_payment_id,
      razorpay_signature: result.razorpay_signature,
    });
    return true;
  } catch (err: any) {
    if (err?.code === 0 || err?.description === "Payment cancelled") {
      options.modal?.ondismiss?.();
      return true;
    }
    console.log("[Razorpay] Native SDK failed, falling back to browser:", err?.message);
    return false;
  }
}

// ─── Main entry point ──────────────────────────────────────────────────────

/**
 * Open Razorpay Checkout.
 * - Web: popup via Checkout.js
 * - Mobile APK: native checkout via react-native-razorpay
 * - Expo Go: browser checkout via expo-web-browser + deep link callback
 */
export async function openRazorpayCheckout(
  options: RazorpayOptions
): Promise<void> {
  // ── Web ──
  if (Platform.OS === "web") {
    const loaded = await loadRazorpayScript();
    if (!loaded || !window.Razorpay) {
      throw new Error(
        "Failed to load Razorpay Checkout. Check your network connection."
      );
    }

    const rzp = new window.Razorpay(options);
    rzp.on("payment.failed", () => {
      options.modal?.ondismiss?.();
    });
    rzp.open();
    return;
  }

  // ── Mobile: try native SDK first, fall back to browser ──
  const nativeResult = await tryNativeCheckout(options);
  if (nativeResult) return;

  // ── Expo Go: browser checkout ──
  await openBrowserCheckout(options);
}
