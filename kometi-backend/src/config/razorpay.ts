// src/config/razorpay.ts
// Configured Razorpay client instance — reuse across all payment services.

import Razorpay from "razorpay";
import env from "./env";

export const razorpay = new Razorpay({
  key_id:     env.RAZORPAY_KEY_ID,
  key_secret: env.RAZORPAY_KEY_SECRET,
});

export default razorpay;
