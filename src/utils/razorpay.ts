// src/utils/razorpay.ts
// Razorpay Checkout: web popup via Checkout.js, mobile native via react-native-razorpay,
// Expo Go fallback via expo-web-browser openAuthSessionAsync.

import { Platform } from "react-native";
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

// ─── Expo Go fallback: browser checkout via openAuthSessionAsync ────────────

function buildCheckoutUrl(options: RazorpayOptions): string {
  const params = new URLSearchParams({
    key: options.key,
    amount: String(options.amount),
    currency: options.currency,
    name: options.name,
    description: options.description,
    order_id: options.order_id,
    callback_url: DEEP_LINK_SCHEME,
  });

  if (options.prefill?.name) params.set("prefill_name", options.prefill.name);
  if (options.prefill?.email) params.set("prefill_email", options.prefill.email);
  if (options.prefill?.contact) params.set("prefill_contact", options.prefill.contact);
  if (options.theme?.color) params.set("theme_color", options.theme.color);

  const baseUrl = APP_CONFIG.API_BASE_URL.replace(/\/api\/v1\/?$/, "");
  return `${baseUrl}/payments/checkout?${params.toString()}`;
}

function parseRedirectUrl(redirectUrl: string): Record<string, string> {
  const queryStart = redirectUrl.indexOf("?");
  if (queryStart < 0) return {};
  const queryString = redirectUrl.slice(queryStart + 1);
  const params = new URLSearchParams(queryString);
  const result: Record<string, string> = {};
  params.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

async function openBrowserCheckout(options: RazorpayOptions): Promise<void> {
  const url = buildCheckoutUrl(options);

  try {
    const result = await WebBrowser.openAuthSessionAsync(url, DEEP_LINK_SCHEME);

    if (result.type === "success" && result.url) {
      const params = parseRedirectUrl(result.url);

      if (params.failed === "true") {
        options.modal?.ondismiss?.();
        throw new Error(decodeURIComponent(params.error || "Payment failed"));
      }

      if (params.dismissed === "true") {
        options.modal?.ondismiss?.();
        return;
      }

      const { orderId, paymentId, signature } = params;
      if (orderId && paymentId && signature) {
        options.handler({
          razorpay_order_id: orderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: signature,
        });
        return;
      }

      options.modal?.ondismiss?.();
      throw new Error("Payment cancelled");
    }

    // result.type === 'cancel' or 'dismiss' — user closed browser
    options.modal?.ondismiss?.();
  } catch (err: any) {
    if (err?.message === "Payment cancelled" || err?.message?.startsWith("Payment failed")) {
      throw err;
    }
    options.modal?.ondismiss?.();
    throw new Error("Payment was interrupted. Please try again.");
  }
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
    // Native module exists but broken (Expo Go) — fall through to browser
    console.log("[Razorpay] Native SDK failed, falling back to browser:", err?.message);
    return false;
  }
}

// ─── Main entry point ──────────────────────────────────────────────────────

/**
 * Open Razorpay Checkout.
 * - Web: popup via Checkout.js
 * - Mobile APK: native checkout via react-native-razorpay
 * - Expo Go: browser checkout via expo-web-browser openAuthSessionAsync
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
