// src/server.ts
// Primary Entry Point for the Kometi Fintech Backend Server.

import express from "express";
import { createServer } from "http";
import cors from "cors";
import env from "./config/env";
import { initSocket } from "./config/socket";
import { errorHandler } from "./middleware/errorHandler";

// Import modules routers
import authRouter from "./modules/auth/auth.router";
import membersRouter from "./modules/members/members.router";
import committeesRouter from "./modules/committees/committees.router";
import installmentsRouter from "./modules/installments/installments.router";
import walletRouter from "./modules/wallet/wallet.router";
import withdrawalRouter from "./modules/wallet/withdrawal.router";
import adminRouter from "./modules/admin/admin.router";
import paymentsRouter from "./modules/payments/payments.router";
import notificationsRouter from "./modules/notifications/notifications.router";
import { startOverdueCheckScheduler } from "./jobs/overdue-check";

const app = express();
const httpServer = createServer(app);

// Initialize real-time Socket.IO
initSocket(httpServer);

app.set("json replacer", (_key: string, value: unknown) => (
  typeof value === "bigint" ? Number(value) : value
));

// Middleware
app.use(cors({ origin: "*" }));
app.use(express.json());

// Routes
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/members", membersRouter);
app.use("/api/v1/committees", committeesRouter);
app.use("/api/v1/installments", installmentsRouter);
app.use("/api/v1/wallet", walletRouter);
app.use("/api/v1/wallet/withdrawals", withdrawalRouter);
app.use("/api/v1/payments", paymentsRouter);
app.use("/api/v1/notifications", notificationsRouter);
app.use("/api/v1/admin", adminRouter);

// Base Health Check
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "OK", timestamp: new Date() });
});

// ─── Razorpay Checkout Page (public — no auth) ─────────────────────────────
// Serves an HTML page that loads Razorpay Checkout.js and opens the payment sheet.
// Used by the mobile app when react-native-razorpay is unavailable (Expo Go).
const CHECKOUT_BASE = "https://kometi-application.onrender.com";

app.get("/payments/checkout", (req, res) => {
  const { key, amount, currency, name, description, order_id, prefill_name, prefill_email, prefill_contact, theme_color } = req.query as Record<string, string>;

  if (!key || !amount || !order_id) {
    res.status(400).send("Missing required parameters");
    return;
  }

  const callbackBase = `${CHECKOUT_BASE}/payments/checkout/callback`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Kometi Payment</title>
  <style>
    body { margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #f5f5f5; font-family: -apple-system, sans-serif; }
    .loader { text-align: center; }
    .spinner { width: 40px; height: 40px; border: 4px solid #e0e0e0; border-top-color: #6f5eff; border-radius: 50%; animation: spin 0.8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    p { color: #666; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="loader">
    <div class="spinner"></div>
    <p>Opening payment...</p>
  </div>
  <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
  <script>
    var options = {
      key: "${key}",
      amount: ${amount},
      currency: "${currency || "INR"}",
      name: "${name || "Kometi"}",
      description: "${(description || "").replace(/"/g, '\\"')}",
      order_id: "${order_id}",
      prefill: {
        name: "${(prefill_name || "").replace(/"/g, '\\"')}",
        email: "${(prefill_email || "").replace(/"/g, '\\"')}",
        contact: "${prefill_contact || ""}"
      },
      theme: { color: "${theme_color || "#6f5eff"}" },
      handler: function (response) {
        window.location.href = "${callbackBase}?status=success&orderId=" + response.razorpay_order_id + "&paymentId=" + response.razorpay_payment_id + "&signature=" + response.razorpay_signature;
      },
      modal: {
        ondismiss: function () {
          window.location.href = "${callbackBase}?status=dismissed";
        }
      }
    };
    var rzp = new Razorpay(options);
    rzp.on('payment.failed', function (response) {
      window.location.href = "${callbackBase}?status=failed&error=" + encodeURIComponent(response.error && response.error.description || "Payment failed");
    });
    rzp.open();
  </script>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html").send(html);
});

// ─── Razorpay Checkout Callback Page (public — no auth) ────────────────────
// Receives payment result from Razorpay and returns a page that the app can read.
app.get("/payments/checkout/callback", (req, res) => {
  const { status, orderId, paymentId, signature, error } = req.query as Record<string, string>;

  if (status === "success" && orderId && paymentId && signature) {
    res.setHeader("Content-Type", "text/html").send(`<!DOCTYPE html>
<html><head><title>Kometi</title>
<style>body{margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#f0fdf4;font-family:-apple-system,sans-serif;text-align:center}
.card{background:#fff;border-radius:16px;padding:40px;box-shadow:0 4px 24px rgba(0,0,0,0.08);max-width:360px}
.icon{font-size:48px;margin-bottom:16px}
h2{color:#16a34a;margin:0 0 8px}
p{color:#666;margin:0 0 24px;font-size:14px}
.btn{display:inline-block;background:#6f5eff;color:#fff;text-decoration:none;padding:12px 32px;border-radius:10px;font-weight:600;font-size:15px}
</style></head><body>
<div class="card"><div class="icon">&#10004;</div><h2>Payment Successful</h2><p>Your wallet will be updated shortly.</p>
<a class="btn" href="kometi://payment-callback?status=success&orderId=${orderId}&paymentId=${paymentId}&signature=${signature}">Return to App</a></div>
</body></html>`);
    return;
  }

  if (status === "failed") {
    res.setHeader("Content-Type", "text/html").send(`<!DOCTYPE html>
<html><head><title>Kometi</title>
<style>body{margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#fef2f2;font-family:-apple-system,sans-serif;text-align:center}
.card{background:#fff;border-radius:16px;padding:40px;box-shadow:0 4px 24px rgba(0,0,0,0.08);max-width:360px}
.icon{font-size:48px;margin-bottom:16px}
h2{color:#dc2626;margin:0 0 8px}
p{color:#666;margin:0 0 24px;font-size:14px}
.btn{display:inline-block;background:#6f5eff;color:#fff;text-decoration:none;padding:12px 32px;border-radius:10px;font-weight:600;font-size:15px}
</style></head><body>
<div class="card"><div class="icon">&#10008;</div><h2>Payment Failed</h2><p>${error || "Something went wrong"}</p>
<a class="btn" href="kometi://payment-callback?status=failed&error=${encodeURIComponent(error || "Payment failed")}">Return to App</a></div>
</body></html>`);
    return;
  }

  // dismissed
  res.setHeader("Content-Type", "text/html").send(`<!DOCTYPE html>
<html><head><title>Kometi</title>
<style>body{margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#f5f5f5;font-family:-apple-system,sans-serif;text-align:center}
.card{background:#fff;border-radius:16px;padding:40px;box-shadow:0 4px 24px rgba(0,0,0,0.08);max-width:360px}
.icon{font-size:48px;margin-bottom:16px}
h2{color:#333;margin:0 0 8px}
p{color:#666;margin:0 0 24px;font-size:14px}
.btn{display:inline-block;background:#6f5eff;color:#fff;text-decoration:none;padding:12px 32px;border-radius:10px;font-weight:600;font-size:15px}
</style></head><body>
<div class="card"><div class="icon">&#9673;</div><h2>Payment Cancelled</h2><p>No amount was charged.</p>
<a class="btn" href="kometi://payment-callback?status=dismissed">Return to App</a></div>
</body></html>`);
});

// Error handling middleware
app.use(errorHandler);

const PORT = env.PORT;
httpServer.listen(PORT, () => {
  console.log(`=============================================`);
  console.log(`🚀 Kometi Server running in ${env.NODE_ENV} mode`);
  console.log(`📍 Endpoint: http://localhost:${PORT}`);
  console.log(`=============================================`);

  // Start daily overdue payment obligations check
  startOverdueCheckScheduler();
});
