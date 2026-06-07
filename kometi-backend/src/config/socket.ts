// src/config/socket.ts
// Socket.IO server initialization and event emitters.

import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import env from "./env";

export let io: Server;

interface CustomSocket extends Socket {
  userId?: string;
}

export function initSocket(server: HttpServer) {
  io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST", "PUT", "DELETE"],
    },
  });

  // Authentication Middleware for WebSocket
  io.use((socket: CustomSocket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error("UNAUTHORIZED"));
    }

    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as { id: string };
      socket.userId = decoded.id;
      next();
    } catch {
      next(new Error("UNAUTHORIZED"));
    }
  });

  io.on("connection", (socket: CustomSocket) => {
    console.log(`[Socket] User connected: ${socket.userId} (${socket.id})`);

    // Join user-specific private room
    if (socket.userId) {
      socket.join(socket.userId);
    }

    socket.on("disconnect", () => {
      console.log(`[Socket] User disconnected: ${socket.id}`);
    });
  });

  return io;
}

// Global emitter helper functions
export function emitToUser(userId: string, event: string, data: any) {
  if (io) {
    io.to(userId).emit(event, data);
  }
}

export function emitToAll(event: string, data: any) {
  if (io) {
    io.emit(event, data);
  }
}
