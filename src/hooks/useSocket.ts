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
  const bumpWalletUpdated   = useWalletStore((s) => s.bumpWalletUpdated);
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
    socket.on("wallet:credited", (data: { amountPaise: number; newBalance: number; transaction?: any }) => {
      if (data.newBalance) updateBalance(data.newBalance);
      if (data.transaction) prependTransaction(data.transaction);
      bumpWalletUpdated();
    });

    socket.on("wallet:debited", (data: { amountPaise: number; newBalance: number; transaction?: any }) => {
      if (data.newBalance) updateBalance(data.newBalance);
      if (data.transaction) prependTransaction(data.transaction);
      bumpWalletUpdated();
    });

    // ── Installment events ─────────────────────────────────────────────────
    socket.on("installment:paid", (data: { installmentId: string }) => {
      markPaid(data.installmentId);
    });

    socket.on("installment:waived", (data: { installmentId: string }) => {
      markPaid(data.installmentId); // Mark as paid (waived = no longer pending)
    });

    // ── Committee events ───────────────────────────────────────────────────
    socket.on("committee:started", (data: { committeeId: string }) => {
      updateCommitteeStatus(data.committeeId, "ACTIVE");
    });

    // Backend emits "committee:resolved" when a cycle is resolved
    socket.on("committee:resolved", (data: { committeeId: string; cycleNo: number }) => {
      useCommitteeStore.getState().markMonthResolved(data.committeeId, String(data.cycleNo));
    });

    socket.on("committee:bidding_opened", (data: { committeeId: string; monthId: string; monthNumber: number }) => {
      useCommitteeStore.getState().markBiddingOpened(data.committeeId, data.monthId);
    });

    socket.on("committee:bid_placed", (data: { committeeId: string; monthId: string }) => {
      useCommitteeStore.getState().markBidPlaced(data.committeeId, data.monthId);
    });

    socket.on("committee:bid_submitted", (data: { committeeId: string; cycleNo: number; userId: string; bidAmountPaise: number }) => {
      useCommitteeStore.getState().markBidPlaced(data.committeeId, String(data.cycleNo));
    });

    // ── Contribution events ────────────────────────────────────────────────
    socket.on("contribution:paid", (data: { committeeId: string; memberId: string }) => {
      useCommitteeStore.getState().markContributionUpdated(data.committeeId);
    });

    socket.on("contribution:member-paid", (data: { committeeId: string; memberId: string }) => {
      useCommitteeStore.getState().markContributionUpdated(data.committeeId);
    });

    socket.on("committee:contribution-updated", (data: { committeeId: string }) => {
      useCommitteeStore.getState().markContributionUpdated(data.committeeId);
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
