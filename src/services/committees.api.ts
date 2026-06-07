// src/services/committees.api.ts
import apiClient from "./api.client";
import type {
  ApiResponse, Committee, CommitteeDetail, CommitteeMember,
  CommitteeStatus, CommitteeType, PaginationMeta, JoinRequest,
} from "../types";

export interface CreateCommitteePayload {
  name:                   string;
  description?:           string;
  type:                   CommitteeType;
  totalSlots:             number;
  installmentAmountPaise: number;
  cycleDurationDays:      number;
  startDate:              string;
  penaltyRatePct?:        number;
  gracePeriodDays?:       number;
  includeOrganizerAsMember?: boolean;
}

export interface CommitteeListParams {
  status?: CommitteeStatus;
  type?:   CommitteeType;
  page?:   number;
  limit?:  number;
}

export const committeesApi = {
  list: (params?: CommitteeListParams) =>
    apiClient.get<ApiResponse<Committee[]> & { meta: PaginationMeta }>("/committees", { params }),

  getById: (id: string) =>
    apiClient.get<ApiResponse<CommitteeDetail>>(`/committees/${id}`),

  create: (payload: CreateCommitteePayload) =>
    apiClient.post<ApiResponse<Committee>>("/committees", payload),

  update: (id: string, payload: Partial<CreateCommitteePayload>) =>
    apiClient.put<ApiResponse<Committee>>(`/committees/${id}`, payload),

  start: (id: string) =>
    apiClient.post<ApiResponse<Committee>>(`/committees/${id}/start`),

  cancel: (id: string) =>
    apiClient.delete<ApiResponse<null>>(`/committees/${id}`),

  getMembers: (id: string) =>
    apiClient.get<ApiResponse<CommitteeMember[]>>(`/committees/${id}/members`),

  addMember: (id: string, userId: string, slotNumber?: number) =>
    apiClient.post<ApiResponse<CommitteeMember>>(`/committees/${id}/members`, { userId, slotNumber }),

  removeMember: (id: string, memberId: string) =>
    apiClient.delete<ApiResponse<null>>(`/committees/${id}/members/${memberId}`),

  getSchedule: (id: string) =>
    apiClient.get<ApiResponse<{ cycles: Array<{ cycleNo: number; dueDate: string; status: string }> }>>(`/committees/${id}/schedule`),

  drawWinner: (id: string) =>
    apiClient.post<ApiResponse<{ winnerId: string; cycleNo: number }>>(`/committees/${id}/draw-winner`),

  submitBid: (id: string, amountPaise: number) =>
    apiClient.post<ApiResponse<{ bid: unknown }>>(`/committees/${id}/bid`, { amountPaise }),

  releasePayout: (id: string, cycleNo: number) =>
    apiClient.post<ApiResponse<null>>(`/committees/${id}/payout`, { cycleNo }),

  resolveAuction: (id: string, cycleNo: number) =>
    apiClient.post<ApiResponse<{ winnerId: string; payoutAmtPaise: number; dividendPerMemberPaise: number; isDraw: boolean }>>(`/committees/${id}/resolve-auction`, { cycleNo }),

  // ─── Join by Invite Code ─────────────────────────────────────────────────
  joinByCode: (inviteCode: string) =>
    apiClient.post<ApiResponse<{
      committee: { id: string; name: string };
      joinRequest: JoinRequest;
      isRetry: boolean;
    }>>("/committees/join-by-code", { inviteCode }),

  // ─── Join Request Management ─────────────────────────────────────────────
  getJoinRequests: (committeeId: string) =>
    apiClient.get<ApiResponse<JoinRequest[]>>(`/committees/${committeeId}/join-requests`),

  getMyJoinRequestStatus: (committeeId: string) =>
    apiClient.get<ApiResponse<JoinRequest | null>>(`/committees/${committeeId}/join-requests/my-status`),

  approveJoinRequest: (committeeId: string, requestId: string) =>
    apiClient.post<ApiResponse<{ success: boolean; slotNumber?: number }>>(
      `/committees/${committeeId}/join-requests/${requestId}/approve`
    ),

  rejectJoinRequest: (committeeId: string, requestId: string) =>
    apiClient.post<ApiResponse<{ success: boolean }>>(
      `/committees/${committeeId}/join-requests/${requestId}/reject`
    ),

  // ─── LOTTERY (FIXED_WINNER) FLOW ─────────────────────────────────────
  getLotteryStatus: (committeeId: string) =>
    apiClient.get<ApiResponse<{
      committeeId: string;
      cycleNo: number;
      totalSlots: number;
      installmentAmountPaise: number;
      members: Array<{
        memberId: string;
        userId: string;
        slotNumber: number;
        name: string;
        phone: string;
        hasReceivedPayout: boolean;
        installmentStatus: string;
        amountPaidPaise: number;
        amountDuePaise: number;
      }>;
      paidCount: number;
      unpaidCount: number;
      alreadyWonCount: number;
      paidMembers: Array<any>;
      unpaidMembers: Array<any>;
      alreadyWon: Array<any>;
      existingPayout: any;
    }>>(`/committees/${committeeId}/lottery/status`),

  lockLotteryMembers: (committeeId: string) =>
    apiClient.post<ApiResponse<{
      lockedCount: number;
      lockedMembers: Array<{ memberId: string; userId: string; slotNumber: number }>;
    }>>(`/committees/${committeeId}/lottery/lock`),

  drawLotteryWinner: (committeeId: string) =>
    apiClient.post<ApiResponse<{
      winnerId: string;
      winnerName: string;
      winnerPhone: string;
      winnerSlot: number;
      payoutAmtPaise: number;
      commissionPaise: number;
      totalPot: number;
      lockedCount: number;
    }>>(`/committees/${committeeId}/lottery/draw`),

  confirmLotteryPayout: (committeeId: string) =>
    apiClient.post<ApiResponse<{
      winnerId: string;
      winnerName: string;
      winnerSlot: number;
      payoutAmtPaise: number;
      commissionPaise: number;
      receiptNumber: string;
      nextCycleNo: number | null;
      isCompleted: boolean;
    }>>(`/committees/${committeeId}/lottery/confirm`),

  getLotteryReceipt: (committeeId: string, cycleNo: number) =>
    apiClient.get<ApiResponse<{
      receiptNumber: string;
      committeeName: string;
      committeeId: string;
      cycleNo: number;
      totalSlots: number;
      installmentAmountPaise: number;
      totalPotPaise: number;
      winner: { name: string; phone: string; slot: number };
      payoutAmtPaise: number;
      commissionPaise: number;
      payoutDate: string;
      createdAt: string;
      lockedMembers: string[];
    }>>(`/committees/${committeeId}/lottery/receipt/${cycleNo}`),
};
