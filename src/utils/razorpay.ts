// src/utils/razorpay.ts
// Razorpay Checkout script loader and payment opener.

import { Platform, Linking } from "react-native";

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
    // For mobile, open the Razorpay checkout page in the browser
    const checkoutUrl = `https://checkout.razorpay.com/v1/checkout.js`;
    const paymentUrl = `https://api.razorpay.com/v1/orders/${options.order_id}/pay`;
    
    // Create a deep link URL that the backend can handle
    const deepLinkUrl = `kometi://payment?orderId=${options.order_id}&amount=${options.amount}&currency=${options.currency}`;
    
    // Try to open the Razorpay app if installed (for UPI payments)
    const canOpenRazorpay = await Linking.canOpenURL("razorpay://");
    
    if (canOpenRazorpay) {
      // Open Razorpay app with payment details
      await Linking.openURL(`razorpay://pay?orderId=${options.order_id}&amount=${options.amount}&key=${options.key}`);
    } else {
      // Fallback: Open web checkout in browser
      const webCheckoutUrl = `https://checkout.razorpay.com/v1/checkout.html?order_id=${options.order_id}&key=${options.key}&amount=${options.amount}&currency=${options.currency}&name=${encodeURIComponent(options.name)}&description=${encodeURIComponent(options.description || "")}`;
      await Linking.openURL(webCheckoutUrl);
    }
    
    // Note: The handler callback won't be called on mobile
    // The backend should verify the payment via webhooks or when the user returns
    return;
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

/**
 * Open Razorpay checkout in in-app browser for mobile
 * Returns the payment result when user completes or cancels
 */
export async function openRazorpayInBrowser(
  options: Omit<RazorpayOptions, "handler"> & { handler: (response: RazorpayResponse) => void }
): Promise<void> {
  if (Platform.OS === "web") {
    // Use the web checkout
    return openRazorpayCheckout(options);
  }

  // For mobile, use expo-web-browser or Linking
  const webCheckoutUrl = `https://checkout.razorpay.com/v1/checkout.html?order_id=${options.order_id}&key=${options.key}&amount=${options.amount}&currency=${options.currency}&name=${encodeURIComponent(options.name)}&description=${encodeURIComponent(options.description || "")}`;
  
  try {
    await Linking.openURL(webCheckoutUrl);
  } catch (err) {
    throw new Error("Failed to open payment page. Please try again.");
  }
}
