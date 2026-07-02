// src/utils/razorpay.ts
// Razorpay Checkout: web popup via Checkout.js, mobile native via react-native-razorpay,
// Expo Go fallback via expo-web-browser + deep link callback.

import { Platform, Linking } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { APP_CONFIG } from "../constants/config";

// react-native-razorpay is a native module — null in Expo Go, real module in APK builds.
let RazorpayCheckout: any = null;
try {
  RazorpayCheckout = require("react-native-razorpay").default;
} catch {
  RazorpayCheckout = null;
}

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

// ─── Expo Go fallback: browser checkout + deep link callback ────────────────

function buildCheckoutUrl(options: RazorpayOptions): string {
  const params = new URLSearchParams({
    key: options.key,
    amount: String(options.amount),
    currency: options.currency,
    name: options.name,
    description: options.description,
    order_id: options.order_id,
    callback_url: "kometi://payment-callback",
  });

  if (options.prefill?.name) params.set("prefill_name", options.prefill.name);
  if (options.prefill?.email) params.set("prefill_email", options.prefill.email);
  if (options.prefill?.contact) params.set("prefill_contact", options.prefill.contact);
  if (options.theme?.color) params.set("theme_color", options.theme.color);

  const baseUrl = APP_CONFIG.API_BASE_URL.replace(/\/api\/v1\/?$/, "");
  return `${baseUrl}/payments/checkout?${params.toString()}`;
}

function openBrowserCheckout(options: RazorpayOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    const url = buildCheckoutUrl(options);
    let listener: any = null;
    let handled = false;

    const cleanup = () => {
      if (listener) {
        listener.remove();
        listener = null;
      }
    };

    listener = Linking.addEventListener("url", ({ url: deepLinkUrl }) => {
      if (handled) return;
      handled = true;

      try {
        const queryStart = deepLinkUrl.indexOf("?");
        const queryString = queryStart >= 0 ? deepLinkUrl.slice(queryStart + 1) : "";
        const params = new URLSearchParams(queryString);

        cleanup();

        if (params.get("dismissed") === "true" || params.get("failed") === "true") {
          options.modal?.ondismiss?.();
          if (params.get("failed") === "true") {
            reject(new Error(decodeURIComponent(params.get("error") || "Payment failed")));
          } else {
            resolve();
          }
          return;
        }

        const orderId = params.get("orderId");
        const paymentId = params.get("paymentId");
        const signature = params.get("signature");

        if (orderId && paymentId && signature) {
          options.handler({
            razorpay_order_id: orderId,
            razorpay_payment_id: paymentId,
            razorpay_signature: signature,
          });
          resolve();
        } else {
          options.modal?.ondismiss?.();
          reject(new Error("Payment cancelled"));
        }
      } catch {
        cleanup();
        options.modal?.ondismiss?.();
        reject(new Error("Payment cancelled"));
      }
    });

    WebBrowser.openBrowserAsync(url).then(({ type }) => {
      if (handled) return;
      handled = true;

      if (type === "cancel" || type === "dismiss") {
        cleanup();
        options.modal?.ondismiss?.();
        resolve();
      }
    }).catch((err) => {
      if (handled) return;
      handled = true;
      cleanup();
      reject(err);
    });
  });
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

  // ── Mobile APK: native Razorpay SDK (react-native-razorpay) ──
  if (RazorpayCheckout && typeof RazorpayCheckout.open === "function") {
    try {
      const params = {
        key: options.key,
        amount: options.amount,
        currency: options.currency,
        name: options.name,
        description: options.description,
        order_id: options.order_id,
        prefill: options.prefill || {},
        theme: options.theme || {},
      };

      const result = await RazorpayCheckout.open(params);
      options.handler({
        razorpay_order_id: result.razorpay_order_id,
        razorpay_payment_id: result.razorpay_payment_id,
        razorpay_signature: result.razorpay_signature,
      });
    } catch (err: any) {
      if (err?.code === 0 || err?.description === "Payment cancelled") {
        options.modal?.ondismiss?.();
      } else {
        options.modal?.ondismiss?.();
        throw err;
      }
    }
    return;
  }

  // ── Expo Go: browser checkout + deep link callback ──
  await openBrowserCheckout(options);
}
