// src/utils/razorpay.ts
// Razorpay Checkout: web popup via Checkout.js, mobile native via react-native-razorpay.

import { Platform } from "react-native";
import RazorpayCheckout from "react-native-razorpay";

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

// ─── Main entry point ──────────────────────────────────────────────────────

/**
 * Open Razorpay Checkout.
 * - Web: popup via Checkout.js
 * - Mobile: native checkout via react-native-razorpay
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

  // ── Mobile: native Razorpay SDK ──
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
}
