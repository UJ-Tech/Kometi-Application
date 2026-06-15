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
import adminRouter from "./modules/admin/admin.router";
import paymentsRouter from "./modules/payments/payments.router";

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
app.use("/api/v1/payments", paymentsRouter);
app.use("/api/v1/admin", adminRouter);

// Base Health Check
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "OK", timestamp: new Date() });
});

// Error handling middleware
app.use(errorHandler);

const PORT = env.PORT;
httpServer.listen(PORT, () => {
  console.log(`=============================================`);
  console.log(`🚀 Kometi Server running in ${env.NODE_ENV} mode`);
  console.log(`📍 Endpoint: http://localhost:${PORT}`);
  console.log(`=============================================`);
});
