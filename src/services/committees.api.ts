// src/services/committees.api.ts
import apiClient from "./api.client";
import type {
  ApiResponse, Committee, CommitteeDetail, CommitteeMember,
  CommitteeStatus, PaginationMeta, JoinRequest,
} from "../types";

export interface CreateCommitteePayload {
  name:                   string;
  description?:           string;
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

  adjustCommitteeSize: (id: string, newTotalSlots: number) =>
    apiClient.post<ApiResponse<{
      success: boolean;
      previousTotalSlots: number;
      newTotalSlots: number;
      filledSlots: number;
      isNowFull: boolean;
    }>>(`/committees/${id}/adjust-size`, { newTotalSlots }),

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

  // ─── Committee Months (Phase 2) ─────────────────────────────────────────
  createMonth: (committeeId: string, payload: {
    monthNumber: number;
    monthDate: string;
    resolutionType: "bid_single" | "bid_auction" | "lottery" | "organiser_commission";
    winningBidAmount?: number;
  }) =>
    apiClient.post<ApiResponse<any>>(`/committees/${committeeId}/months`, payload),

  getMonths: (committeeId: string) =>
    apiClient.get<ApiResponse<any>>(`/committees/${committeeId}/months`),

  getMonth: (committeeId: string, monthId: string) =>
    apiClient.get<ApiResponse<any>>(`/committees/${committeeId}/months/${monthId}`),

  openBidding: (committeeId: string, monthNumber: number) =>
    apiClient.post<ApiResponse<any>>(`/committees/${committeeId}/months/${monthNumber}/open-bidding`),

  resolveMonth: (committeeId: string, monthId: string) =>
    apiClient.post<ApiResponse<any>>(`/committees/${committeeId}/months/${monthId}/resolve`),

  // ─── Member Bid Placement ────────────────────────────────────────────────
  placeBid: (committeeId: string, monthId: string, memberId: string, bidAmountPaise: number) =>
    apiClient.post<ApiResponse<any>>(`/committees/${committeeId}/months/${monthId}/bids`, {
      memberId,
      bidAmount: bidAmountPaise,
    }),

  // ─── Netted Payment Flow ────────────────────────────────────────────────
  payNetAmount: (committeeId: string, monthId: string, memberId: string) =>
    apiClient.post<ApiResponse<any>>(`/committees/${committeeId}/months/${monthId}/pay-net`, {
      memberId,
    }),

  organiserAdvance: (committeeId: string, monthId: string, memberId: string) =>
    apiClient.post<ApiResponse<any>>(`/committees/${committeeId}/months/${monthId}/organiser-advance`, {
      memberId,
    }),

  getObligations: (committeeId: string, monthId: string) =>
    apiClient.get<ApiResponse<any>>(`/committees/${committeeId}/months/${monthId}/obligations`),

  settlePayout: (committeeId: string, monthId: string) =>
    apiClient.post<ApiResponse<any>>(`/committees/${committeeId}/months/${monthId}/settle-payout`),

  getOverdueObligations: (committeeId: string) =>
    apiClient.get<ApiResponse<any>>(`/committees/${committeeId}/months/overdue`),

  getOrganiserAdvances: (committeeId: string) =>
    apiClient.get<ApiResponse<any>>(`/committees/${committeeId}/months/organiser-advances`),

  // ─── Member Stats ────────────────────────────────────────────────────
  getMemberStats: (committeeId: string, memberId: string) =>
    apiClient.get<ApiResponse<{
      committeeId: string;
      memberId: string;
      totalContributedPaise: number;
      totalReceivedPaise: number;
      totalPaidPaise: number;
      totalCreditedPaise: number;
      totalInterestPaise: number;
      netPositionPaise: number;
      monthsCompleted: number;
      monthsWon: number;
      totalMonths: number;
    }>>(`/committees/${committeeId}/members/${memberId}/stats`),

  // ─── Block/Unblock Members ────────────────────────────────────────────
  blockMember: (committeeId: string, memberId: string, reason: string) =>
    apiClient.post<ApiResponse<{ success: boolean; member: any }>>(
      `/committees/${committeeId}/members/${memberId}/block`,
      { reason }
    ),

  unblockMember: (committeeId: string, memberId: string) =>
    apiClient.post<ApiResponse<{ success: boolean; member: any }>>(
      `/committees/${committeeId}/members/${memberId}/unblock`
    ),

  getBlockedMembers: (committeeId: string) =>
    apiClient.get<ApiResponse<{ members: any[] }>>(
      `/committees/${committeeId}/blocked-members`
    ),

  addMemberToActive: (committeeId: string, userId: string) =>
    apiClient.post<ApiResponse<any>>(
      `/committees/${committeeId}/members/add-active`,
      { userId }
    ),
};
