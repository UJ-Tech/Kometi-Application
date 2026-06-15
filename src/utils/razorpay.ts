// src/utils/razorpay.ts
// Razorpay Checkout script loader and payment opener.

import { Platform } from "react-native";

declare global {
  interface Window {
    Razorpay: any;
  }
}

interface RazorpayOptions {
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

/**
 * Load the Razorpay Checkout.js script (web only).
 * Returns a promise that resolves when the script is ready.
 */
let scriptLoaded = false;
let scriptLoading = false;

export function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    // Only works on web platform
    if (Platform.OS !== "web") {
      resolve(false);
      return;
    }

    // Already loaded
    if (scriptLoaded && window.Razorpay) {
      resolve(true);
      return;
    }

    // Already loading — wait
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

/**
 * Open Razorpay Checkout popup.
 * Returns a promise with the payment response.
 */
export async function openRazorpayCheckout(
  options: Omit<RazorpayOptions, "handler"> & { handler: (response: RazorpayResponse) => void }
): Promise<void> {
  if (Platform.OS !== "web") {
    throw new Error("Razorpay Checkout is only supported on web. Use react-native-razorpay for mobile.");
  }

  const loaded = await loadRazorpayScript();
  if (!loaded || !window.Razorpay) {
    throw new Error("Failed to load Razorpay Checkout. Check your network connection.");
  }

  const rzp = new window.Razorpay(options);

  rzp.on("payment.failed", (response: any) => {
    // User dismissed or payment failed
    options.modal?.ondismiss?.();
  });

  rzp.open();
}
