// src/hooks/useSocket.ts
// Manages the Socket.IO connection lifecycle tied to auth state.
// Auto-reconnects, handles auth errors, joins user-specific rooms.

import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { APP_CONFIG } from "../constants/config";
import { useAuthStore } from "../stores/auth.store";
import { useWalletStore } from "../stores/wallet.store";
import { useInstallmentStore } from "../stores/installment.store";
import { useCommitteeStore } from "../stores/committee.store";

export function useSocket(): Socket | null {
  const socketRef      = useRef<Socket | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const accessToken    = useAuthStore((s) => s.accessToken);
  const isAuthenticated= useAuthStore((s) => s.isAuthenticated);
  const logout         = useAuthStore((s) => s.logout);

  // Store actions for real-time updates
  const updateBalance       = useWalletStore((s) => s.updateBalance);
  const prependTransaction  = useWalletStore((s) => s.prependTransaction);
  const markPaid            = useInstallmentStore((s) => s.markPaid);
  const updateCommitteeStatus = useCommitteeStore((s) => s.updateCommitteeStatus);

  useEffect(() => {
    if (!isAuthenticated || !accessToken) return;

    const socket = io(APP_CONFIG.SOCKET_URL, {
      auth:                { token: accessToken },
      transports:          ["websocket"],
      reconnection:        true,
      reconnectionDelay:   1000,
      reconnectionAttempts: 5,
    });

    socketRef.current = socket;
    setSocket(socket);

    // ── Connection events ──────────────────────────────────────────────────
    socket.on("connect",       () => console.log("[Socket] Connected:", socket.id));
    socket.on("disconnect",    (reason) => console.log("[Socket] Disconnected:", reason));
    socket.on("connect_error", (err) => {
      if (err.message === "UNAUTHORIZED") logout();
    });

    // ── Wallet events ──────────────────────────────────────────────────────
    socket.on("wallet:credited", (data: { amountPaise: number; newBalance: number; transaction: any }) => {
      updateBalance(data.newBalance);
      prependTransaction(data.transaction);
    });

    socket.on("wallet:debited", (data: { amountPaise: number; newBalance: number; transaction: any }) => {
      updateBalance(data.newBalance);
      prependTransaction(data.transaction);
    });

    // ── Installment events ─────────────────────────────────────────────────
    socket.on("installment:paid", (data: { installmentId: string }) => {
      markPaid(data.installmentId);
    });

    // ── Committee events ───────────────────────────────────────────────────
    socket.on("committee:started", (data: { committeeId: string }) => {
      updateCommitteeStatus(data.committeeId, "ACTIVE");
    });

    socket.on("committee:completed", (data: { committeeId: string }) => {
      updateCommitteeStatus(data.committeeId, "COMPLETED");
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setSocket(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, accessToken]);

  return socket;
}
