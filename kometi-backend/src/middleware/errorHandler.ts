// src/middleware/errorHandler.ts
// Global JSON error response handler.

import { Request, Response, NextFunction } from "express";

export interface CustomError extends Error {
  statusCode?: number;
  errors?: any;
}

export function errorHandler(
  err: CustomError,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  console.error(`[Error] ${req.method} ${req.url}:`, err);

  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  res.status(statusCode).json({
    success: false,
    error: message,
    errors: err.errors || undefined,
    stack: process.env.NODE_ENV === "production" ? undefined : err.stack,
  });
}
