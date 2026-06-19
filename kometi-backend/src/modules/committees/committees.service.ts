// src/modules/committees/committees.service.ts
import supabase from "../../config/supabase";
import { emitToAll, emitToUser } from "../../config/socket";

function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I,O,0,1 to avoid confusion
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export class CommitteesService {
  static async createCommittee(
    organizerId: string,
    name: string,
    description: string | undefined,
    totalSlots: number,
    installmentAmountPaise: bigint,
    cycleDurationDays: number,
    commissionRatePct?: number,
    maxDiscountPct?: number,
    includeOrganizerAsMember?: boolean
  ) {
    // Generate a unique invite code (retry on collision, max 5 attempts)
    let inviteCode = generateInviteCode();
    let attempts = 0;
    while (attempts < 5) {
      const { data: existing } = await supabase
        .from("committees")
        .select("id")
        .eq("inviteCode", inviteCode)
        .maybeSingle();

      if (!existing) break;
      inviteCode = generateInviteCode();
      attempts++;
    }

    const { data: committee, error } = await supabase
      .from("committees")
      .insert({
        name,
        description,
        organizerId,
        inviteCode,
        totalSlots,
        filledSlots: includeOrganizerAsMember ? 1 : 0,
        installmentAmountPaise: Number(installmentAmountPaise),
        cycleDurationDays,
        commissionRatePct: commissionRatePct ?? 5.0,
        maxDiscountPct: maxDiscountPct ?? 30.0,
        status: "DRAFT",
      })
      .select()
      .single();

    if (error) throw error;

    if (includeOrganizerAsMember) {
      const { error: memberError } = await supabase
        .from("committee_members")
        .insert({
          committeeId: committee.id,
          userId: organizerId,
          slotNumber: 1,
        });

      if (memberError) throw memberError;
    }

    return committee;
  }

  static async listCommittees(userId: string) {
    // Get IDs of committees where user is a member
    const { data: memberRows } = await supabase
      .from("committee_members")
      .select("committeeId")
      .eq("userId", userId)
      .eq("isActive", true);

    const memberCommitteeIds = (memberRows ?? []).map((r) => r.committeeId);

    // Fetch committees where user is organizer OR member
    const { data, error } = await supabase
      .from("committees")
      .select("*, organizer:users!organizerId(id, name, phone)")
      .or(`organizerId.eq.${userId},id.in.(${memberCommitteeIds.length > 0 ? memberCommitteeIds.join(",") : "00000000-0000-0000-0000-000000000000"})`)
      .order("createdAt", { ascending: false });

    if (error) throw error;
    return data;
  }

  static async getCommitteeById(id: string, userId: string) {
    const { data: committee, error } = await supabase
      .from("committees")
      .select("*, organizer:users!organizerId(id, name, phone), members:committee_members(*, user:users(id, name, phone)), bids:bids(id, committee_id, month_id, member_id, bid_amount, placed_at, status), payoutCycles:payout_cycles(*)")
      .eq("id", id)
      .single();

    if (error || !committee) throw new Error("Committee not found");

    // Check access: user must be organizer or member
    const isOrganizer = committee.organizerId === userId;
    const isMember = committee.members?.some((m: any) => m.userId === userId);
    if (!isOrganizer && !isMember) {
      throw new Error("You do not have access to this committee");
    }

    return committee;
  }

  static async addMemberToCommittee(committeeId: string, userId: string, slotNumber: number) {
    const { data: committee, error: commError } = await supabase
      .from("committees")
      .select("status, filledSlots, totalSlots")
      .eq("id", committeeId)
      .single();

    if (commError || !committee) throw new Error("Committee not found");
    if (committee.status !== "DRAFT") throw new Error("Can only add members to a DRAFT committee");
    if (committee.filledSlots >= committee.totalSlots) throw new Error("Committee slot list is full");

    // Check KYC status of member
    const { data: memberUser, error: userError } = await supabase
      .from("users")
      .select("kycStatus")
      .eq("id", userId)
      .single();

    if (userError || !memberUser || memberUser.kycStatus !== "VERIFIED") {
      throw new Error("Only KYC Verified members can join committees");
    }

    const { data: member, error: memberError } = await supabase
      .from("committee_members")
      .insert({
        committeeId,
        userId,
        slotNumber,
      })
      .select()
      .single();

    if (memberError) throw memberError;

    await supabase
      .from("committees")
      .update({ filledSlots: committee.filledSlots + 1 })
      .eq("id", committeeId);

    return member;
  }

  static async adjustCommitteeSize(committeeId: string, newTotalSlots: number) {
    const { data: committee, error: commError } = await supabase
      .from("committees")
      .select("status, filledSlots, totalSlots")
      .eq("id", committeeId)
      .single();

    if (commError || !committee) throw new Error("Committee not found");
    if (committee.status !== "DRAFT") throw new Error("Committee size can only be adjusted before starting");

    if (newTotalSlots < committee.filledSlots) {
      throw new Error(
        `Cannot reduce size to ${newTotalSlots}: already ${committee.filledSlots} members joined. ` +
        `Minimum allowed is ${committee.filledSlots}.`
      );
    }

    if (newTotalSlots === committee.totalSlots) {
      throw new Error("New size is the same as current size");
    }

    const { error: updateError } = await supabase
      .from("committees")
      .update({ totalSlots: newTotalSlots })
      .eq("id", committeeId);

    if (updateError) throw updateError;

    return {
      success: true,
      previousTotalSlots: committee.totalSlots,
      newTotalSlots,
      filledSlots: committee.filledSlots,
      isNowFull: newTotalSlots === committee.filledSlots,
    };
  }

  static async startCommittee(committeeId: string) {
    const { data: committee, error: commError } = await supabase
      .from("committees")
      .select("*, members:committee_members(*)")
      .eq("id", committeeId)
      .single();

    if (commError || !committee) throw new Error("Committee not found");
    if (committee.status !== "DRAFT") throw new Error("Committee is already started");
    if (committee.filledSlots !== committee.totalSlots) {
      throw new Error("Cannot start committee until all slots are filled");
    }

    const startDate = new Date();
    const cycleDurationDays = committee.cycleDurationDays;
    const totalSlots = committee.totalSlots;
    const endDate = new Date(startDate.getTime() + totalSlots * cycleDurationDays * 24 * 60 * 60 * 1000);

    const { error: updateError } = await supabase
      .from("committees")
      .update({
        status: "ACTIVE",
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        nextDueDate: new Date(startDate.getTime() + cycleDurationDays * 24 * 60 * 60 * 1000).toISOString(),
        currentCycleNo: 1,
      })
      .eq("id", committeeId);

    if (updateError) throw updateError;

    // Generate future payment schedules (Installments) for each member for all cycles
    const installments = [];
    for (let cycle = 1; cycle <= totalSlots; cycle++) {
      const dueDate = new Date(startDate.getTime() + cycle * cycleDurationDays * 24 * 60 * 60 * 1000).toISOString();

      for (const member of committee.members) {
        installments.push({
          committeeId,
          memberId: member.id,
          userId: member.userId,
          cycleNo: cycle,
          amountDuePaise: committee.installmentAmountPaise,
          dueDate,
          status: "PENDING",
        });
      }
    }

    const { error: instError } = await supabase
      .from("installments")
      .insert(installments);

    if (instError) throw instError;

    // Notify all via WebSockets
    emitToAll("committee:started", { committeeId });
  }

  static async submitBid(committeeId: string, userId: string, bidAmountPaise: number) {
    const { data: committee, error: commError } = await supabase
      .from("committees")
      .select("*")
      .eq("id", committeeId)
      .single();

    if (commError || !committee) throw new Error("Committee not found");
    if (committee.status !== "ACTIVE") throw new Error("Bids can only be submitted for active committees");

    const currentCycleNo = committee.currentCycleNo;

    const { data: member, error: memberError } = await supabase
      .from("committee_members")
      .select("*")
      .eq("committeeId", committeeId)
      .eq("userId", userId)
      .single();

    if (memberError || !member) throw new Error("You are not a member of this committee");
    if (member.hasReceivedPayout) throw new Error("You have already received a payout for this committee");

    const totalPot = Number(committee.installmentAmountPaise) * committee.totalSlots;
    const commissionRate = Number(committee.commissionRatePct || 5);
    const maxDiscountRate = Number(committee.maxDiscountPct || 30);

    const commission = (totalPot * commissionRate) / 100;
    const maxDiscount = (totalPot * maxDiscountRate) / 100;

    const minPayout = totalPot - maxDiscount;
    const maxPayout = totalPot - commission;

    if (bidAmountPaise < minPayout) {
      throw new Error(`Bid payout amount cannot be lower than the minimum allowed payout (${minPayout / 100} INR)`);
    }
    if (bidAmountPaise > maxPayout) {
      throw new Error(`Bid payout amount cannot exceed the maximum allowed payout (${maxPayout / 100} INR)`);
    }

    // Look up the current committee_month record by cycleNo (month_number)
    const { data: currentMonth, error: monthError } = await supabase
      .from("committee_months")
      .select("id")
      .eq("committee_id", committeeId)
      .eq("month_number", currentCycleNo)
      .maybeSingle();

    if (monthError || !currentMonth) throw new Error("Active committee month not found. Ensure the month has been created before bidding.");

    const monthId = currentMonth.id;

    const { data: existingBid } = await supabase
      .from("bids")
      .select("id")
      .eq("month_id", monthId)
      .eq("member_id", member.id)
      .maybeSingle();

    let bid;
    if (existingBid) {
      const { data: updatedBid, error: updateErr } = await supabase
        .from("bids")
        .update({ bid_amount: Number(bidAmountPaise) })
        .eq("id", existingBid.id)
        .select()
        .single();
      if (updateErr) throw updateErr;
      bid = updatedBid;
    } else {
      const { data: newBid, error: insertErr } = await supabase
        .from("bids")
        .insert({
          committee_id: committeeId,
          month_id: monthId,
          member_id: member.id,
          bid_amount: Number(bidAmountPaise),
          status: "pending",
        })
        .select()
        .single();
      if (insertErr) throw insertErr;
      bid = newBid;
    }

    emitToAll("committee:bid_submitted", { committeeId, cycleNo: currentCycleNo, userId, bidAmountPaise });
    return bid;
  }

  // ─── Join by Invite Code ──────────────────────────────────────────────────
  static async joinByCode(userId: string, inviteCode: string) {
    const code = inviteCode.toUpperCase().trim();

    // 1. Find committee by invite code
    const { data: committee, error: commError } = await supabase
      .from("committees")
      .select("id, name, status, totalSlots, filledSlots")
      .eq("inviteCode", code)
      .single();

    if (commError || !committee) {
      throw new Error("Invalid invite code. Please check and try again.");
    }

    if (committee.status !== "DRAFT") {
      throw new Error("This committee is no longer accepting new members.");
    }

    if (committee.filledSlots >= committee.totalSlots) {
      throw new Error("This committee has no available slots.");
    }

    // 2. Check if user already a member
    const { data: existingMember } = await supabase
      .from("committee_members")
      .select("id")
      .eq("committeeId", committee.id)
      .eq("userId", userId)
      .maybeSingle();

    if (existingMember) {
      throw new Error("You are already a member of this committee.");
    }

    // 3. Check if there's already a pending request
    const { data: existingRequest } = await supabase
      .from("join_requests")
      .select("id, status")
      .eq("committeeId", committee.id)
      .eq("userId", userId)
      .maybeSingle();

    if (existingRequest) {
      if (existingRequest.status === "PENDING") {
        throw new Error("Your join request is already pending approval.");
      }
      if (existingRequest.status === "APPROVED") {
        throw new Error("You have already been approved for this committee.");
      }
      // If rejected, allow re-request by updating
      const { data: updated, error: updateErr } = await supabase
        .from("join_requests")
        .update({ status: "PENDING", reviewedById: null, reviewedAt: null })
        .eq("id", existingRequest.id)
        .select()
        .single();

      if (updateErr) throw updateErr;
      return { committee, joinRequest: updated, isRetry: true };
    }

    // 4. Create join request
    const { data: joinRequest, error: createErr } = await supabase
      .from("join_requests")
      .insert({
        committeeId: committee.id,
        userId,
        status: "PENDING",
      })
      .select()
      .single();

    if (createErr) throw createErr;
    return { committee, joinRequest, isRetry: false };
  }

  // ─── Get Join Requests for a Committee ────────────────────────────────────
  static async getJoinRequests(committeeId: string, organizerId: string) {
    // Verify organizer owns this committee
    const { data: committee, error: commError } = await supabase
      .from("committees")
      .select("id, organizerId")
      .eq("id", committeeId)
      .single();

    if (commError || !committee) throw new Error("Committee not found");
    if (committee.organizerId !== organizerId) throw new Error("Unauthorized");

    // Fetch join requests
    const { data: requests, error } = await supabase
      .from("join_requests")
      .select("*")
      .eq("committeeId", committeeId)
      .order("createdAt", { ascending: true });

    if (error) throw error;
    if (!requests || requests.length === 0) return [];

    // Fetch user details separately to avoid ambiguous FK embedding
    const userIds = [...new Set(requests.map((r) => r.userId))];
    const { data: users } = await supabase
      .from("users")
      .select("id, name, phone, email, kycStatus")
      .in("id", userIds);

    const userMap = new Map((users ?? []).map((u) => [u.id, u]));
    return requests.map((r) => ({ ...r, user: userMap.get(r.userId) ?? null }));
  }

  // ─── Approve Join Request ─────────────────────────────────────────────────
  static async approveJoinRequest(committeeId: string, requestId: string, organizerId: string) {
    // 1. Verify organizer owns committee
    const { data: committee, error: commError } = await supabase
      .from("committees")
      .select("id, organizerId, totalSlots, filledSlots, status")
      .eq("id", committeeId)
      .single();

    if (commError || !committee) throw new Error("Committee not found");
    if (committee.organizerId !== organizerId) throw new Error("Unauthorized");
    if (committee.status !== "DRAFT") throw new Error("Can only approve members for a DRAFT committee");

    // 2. Find the join request
    const { data: joinRequest, error: reqError } = await supabase
      .from("join_requests")
      .select("id, committeeId, userId, status")
      .eq("id", requestId)
      .single();

    if (reqError || !joinRequest) throw new Error("Join request not found");
    if (joinRequest.committeeId !== committeeId) throw new Error("Request does not belong to this committee");

    // 3. Check if user already a member
    const { data: existingMember } = await supabase
      .from("committee_members")
      .select("id")
      .eq("committeeId", committeeId)
      .eq("userId", joinRequest.userId)
      .maybeSingle();

    if (joinRequest.status === "APPROVED") {
      return { success: true, alreadyProcessed: true, alreadyMember: !!existingMember };
    }
    if (joinRequest.status === "REJECTED") {
      throw new Error("This request has already been rejected");
    }

    // 4. Check slot availability
    if (committee.filledSlots >= committee.totalSlots) {
      throw new Error("Committee is full. No slots available.");
    }

    if (existingMember) {
      // Already a member, just update the request status
      const { error: requestUpdateError } = await supabase
        .from("join_requests")
        .update({ status: "APPROVED", reviewedById: organizerId, reviewedAt: new Date().toISOString() })
        .eq("id", requestId);
      if (requestUpdateError) throw requestUpdateError;
      return { success: true, alreadyMember: true };
    }

    // 5. Find next available slot number
    const { data: lastMember } = await supabase
      .from("committee_members")
      .select("slotNumber")
      .eq("committeeId", committeeId)
      .order("slotNumber", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextSlot = (lastMember?.slotNumber ?? 0) + 1;

    // 6. Create CommitteeMember
    const { error: memberErr } = await supabase
      .from("committee_members")
      .insert({
        committeeId,
        userId: joinRequest.userId,
        slotNumber: nextSlot,
      });

    if (memberErr) throw memberErr;

    // 7. Update filledSlots
    const { error: slotsErr } = await supabase
      .from("committees")
      .update({ filledSlots: committee.filledSlots + 1 })
      .eq("id", committeeId);

    if (slotsErr) throw slotsErr;

    // 8. Update JoinRequest status
    const { error: statusErr } = await supabase
      .from("join_requests")
      .update({ status: "APPROVED", reviewedById: organizerId, reviewedAt: new Date().toISOString() })
      .eq("id", requestId);

    if (statusErr) throw statusErr;

    return { success: true, alreadyMember: false, slotNumber: nextSlot };
  }

  // ─── Reject Join Request ──────────────────────────────────────────────────
  static async rejectJoinRequest(committeeId: string, requestId: string, organizerId: string) {
    // Verify organizer owns committee
    const { data: committee, error: commError } = await supabase
      .from("committees")
      .select("id, organizerId")
      .eq("id", committeeId)
      .single();

    if (commError || !committee) throw new Error("Committee not found");
    if (committee.organizerId !== organizerId) throw new Error("Unauthorized");

    const { data: request, error: reqError } = await supabase
      .from("join_requests")
      .select("id, status, committeeId")
      .eq("id", requestId)
      .single();

    if (reqError || !request) throw new Error("Join request not found");
    if (request.committeeId !== committeeId) throw new Error("Request does not belong to this committee");
    if (request.status === "REJECTED") {
      return { success: true, alreadyProcessed: true };
    }
    if (request.status === "APPROVED") {
      throw new Error("This request has already been approved");
    }

    const { error: updateError } = await supabase
      .from("join_requests")
      .update({
        status: "REJECTED",
        reviewedById: organizerId,
        reviewedAt: new Date().toISOString(),
      })
      .eq("id", requestId);

    if (updateError) throw updateError;
    return { success: true };
  }

  // ─── Get My Join Request Status (for members polling) ─────────────────────
  static async getMyJoinRequestStatus(committeeId: string, userId: string) {
    const { data: request, error } = await supabase
      .from("join_requests")
      .select("id, committeeId, userId, status, reviewedById, reviewedAt, createdAt, updatedAt")
      .eq("committeeId", committeeId)
      .eq("userId", userId)
      .order("createdAt", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return request;
  }

  static async getCommitteeSchedule(committeeId: string, userId: string) {
    const { data: committee, error: commError } = await supabase
      .from("committees")
      .select("id, organizerId, totalSlots, cycleDurationDays, installmentAmountPaise, status")
      .eq("id", committeeId)
      .single();

    if (commError || !committee) throw new Error("Committee not found");

    const isOrganizer = committee.organizerId === userId;
    if (!isOrganizer) {
      const { data: member } = await supabase
        .from("committee_members")
        .select("id")
        .eq("committeeId", committeeId)
        .eq("userId", userId)
        .maybeSingle();
      if (!member) throw new Error("You do not have access to this committee");
    }

    const { data: installments, error: instError } = await supabase
      .from("installments")
      .select("cycleNo, dueDate, amountDuePaise, amountPaidPaise, status")
      .eq("committeeId", committeeId)
      .order("cycleNo", { ascending: true });

    if (instError) throw instError;

    return {
      committeeId,
      totalSlots: committee.totalSlots,
      cycleDurationDays: committee.cycleDurationDays,
      installmentAmountPaise: committee.installmentAmountPaise,
      status: committee.status,
      cycles: installments || [],
    };
  }

  // ─── LOTTERY (FIXED_WINNER) FLOW ────────────────────────────────────────

  static async getLotteryStatus(committeeId: string, userId: string) {
    const { data: committee, error: commError } = await supabase
      .from("committees")
      .select("id, organizerId, totalSlots, currentCycleNo, status, type, installmentAmountPaise")
      .eq("id", committeeId)
      .single();

    if (commError || !committee) throw new Error("Committee not found");
    if (committee.type !== "FIXED_WINNER") throw new Error("This endpoint is only for lottery-type committees");
    if (committee.status !== "ACTIVE") throw new Error("Committee is not active");

    const isOrganizer = committee.organizerId === userId;
    if (!isOrganizer) throw new Error("Only the organizer can verify collections");

    const cycleNo = committee.currentCycleNo;

    // Get all members
    const { data: members, error: memError } = await supabase
      .from("committee_members")
      .select("id, userId, slotNumber, hasReceivedPayout, user:users(id, name, phone)")
      .eq("committeeId", committeeId)
      .eq("isActive", true)
      .order("slotNumber", { ascending: true });

    if (memError) throw memError;

    // Get installment status for current cycle
    const { data: installments, error: instError } = await supabase
      .from("installments")
      .select("memberId, userId, status, amountDuePaise, amountPaidPaise")
      .eq("committeeId", committeeId)
      .eq("cycleNo", cycleNo);

    if (instError) throw instError;

    const instMap = new Map((installments ?? []).map((i) => [i.memberId, i]));

    const memberStatus = (members ?? []).map((m) => {
      const inst = instMap.get(m.id);
      return {
        memberId: m.id,
        userId: m.userId,
        slotNumber: m.slotNumber,
        name: (m.user as any)?.name || "Unknown",
        phone: (m.user as any)?.phone || "",
        hasReceivedPayout: m.hasReceivedPayout,
        installmentStatus: inst?.status || "NO_INSTALLMENT",
        amountPaidPaise: inst?.amountPaidPaise || 0,
        amountDuePaise: inst?.amountDuePaise || 0,
      };
    });

    const paidMembers = memberStatus.filter((m) => m.installmentStatus === "PAID" && !m.hasReceivedPayout);
    const unpaidMembers = memberStatus.filter((m) => m.installmentStatus !== "PAID" && !m.hasReceivedPayout);
    const alreadyWon = memberStatus.filter((m) => m.hasReceivedPayout);

    // Check if already resolved this cycle
    const { data: existingPayout } = await supabase
      .from("payout_cycles")
      .select("id, isCompleted, lockedMembers, receiptNumber")
      .eq("committeeId", committeeId)
      .eq("cycleNo", cycleNo)
      .maybeSingle();

    return {
      committeeId,
      cycleNo,
      totalSlots: committee.totalSlots,
      installmentAmountPaise: committee.installmentAmountPaise,
      members: memberStatus,
      paidCount: paidMembers.length,
      unpaidCount: unpaidMembers.length,
      alreadyWonCount: alreadyWon.length,
      paidMembers,
      unpaidMembers,
      alreadyWon,
      existingPayout: existingPayout || null,
    };
  }

  static async lockLotteryMembers(committeeId: string, userId: string) {
    const { data: committee, error: commError } = await supabase
      .from("committees")
      .select("id, organizerId, status, type, currentCycleNo")
      .eq("id", committeeId)
      .single();

    if (commError || !committee) throw new Error("Committee not found");
    if (committee.type !== "FIXED_WINNER") throw new Error("This endpoint is only for lottery-type committees");
    if (committee.status !== "ACTIVE") throw new Error("Committee is not active");
    if (committee.organizerId !== userId) throw new Error("Only the organizer can lock members");

    const cycleNo = committee.currentCycleNo;

    // Check if already resolved this cycle
    const { data: existingPayout } = await supabase
      .from("payout_cycles")
      .select("id, isCompleted")
      .eq("committeeId", committeeId)
      .eq("cycleNo", cycleNo)
      .maybeSingle();

    if (existingPayout?.isCompleted) {
      throw new Error(`Cycle #${cycleNo} has already been resolved`);
    }

    // Get eligible members (paid installments, haven't won yet)
    const { data: members, error: memError } = await supabase
      .from("committee_members")
      .select("id, userId, slotNumber, hasReceivedPayout")
      .eq("committeeId", committeeId)
      .eq("isActive", true);

    if (memError) throw memError;

    const { data: installments, error: instError } = await supabase
      .from("installments")
      .select("memberId, status")
      .eq("committeeId", committeeId)
      .eq("cycleNo", cycleNo);

    if (instError) throw instError;

    const paidMemberIds = new Set(
      (installments ?? [])
        .filter((i) => i.status === "PAID")
        .map((i) => i.memberId)
    );

    const eligibleMembers = (members ?? []).filter(
      (m) => !m.hasReceivedPayout && paidMemberIds.has(m.id)
    );

    if (eligibleMembers.length === 0) {
      throw new Error("No eligible members found. All members must have paid their installments.");
    }

    const lockedMemberIds = eligibleMembers.map((m) => m.id);

    // Upsert or update payout_cycles with locked members
    if (existingPayout) {
      const { error: updateErr } = await supabase
        .from("payout_cycles")
        .update({ lockedMembers: lockedMemberIds })
        .eq("id", existingPayout.id);
      if (updateErr) throw updateErr;
    } else {
      const { error: insertErr } = await supabase
        .from("payout_cycles")
        .insert({
          committeeId,
          cycleNo,
          winnerId: "", // placeholder, will be set on draw
          winnerSlot: 0,
          payoutAmtPaise: 0,
          lockedMembers: lockedMemberIds,
          isCompleted: false,
        });
      if (insertErr) throw insertErr;
    }

    return {
      lockedCount: lockedMemberIds.length,
      lockedMembers: eligibleMembers.map((m) => ({
        memberId: m.id,
        userId: m.userId,
        slotNumber: m.slotNumber,
      })),
    };
  }

  static async drawLotteryWinner(committeeId: string, userId: string) {
    const { data: committee, error: commError } = await supabase
      .from("committees")
      .select("id, organizerId, status, type, currentCycleNo, totalSlots, installmentAmountPaise, commissionRatePct")
      .eq("id", committeeId)
      .single();

    if (commError || !committee) throw new Error("Committee not found");
    if (committee.type !== "FIXED_WINNER") throw new Error("This endpoint is only for lottery-type committees");
    if (committee.status !== "ACTIVE") throw new Error("Committee is not active");
    if (committee.organizerId !== userId) throw new Error("Only the organizer can draw the lottery");

    const cycleNo = committee.currentCycleNo;

    // Get the locked payout cycle
    const { data: payoutCycle, error: pcError } = await supabase
      .from("payout_cycles")
      .select("*")
      .eq("committeeId", committeeId)
      .eq("cycleNo", cycleNo)
      .maybeSingle();

    if (pcError) throw pcError;
    if (!payoutCycle) throw new Error("Members not locked yet. Please lock eligible members first.");
    if (payoutCycle.isCompleted) throw new Error(`Cycle #${cycleNo} has already been resolved`);
    if (!payoutCycle.lockedMembers || (payoutCycle.lockedMembers as any[]).length === 0) {
      throw new Error("No locked members found. Please lock eligible members first.");
    }

    const lockedMemberIds = payoutCycle.lockedMembers as string[];

    // Fetch member details for locked members
    const { data: lockedMembers, error: lmError } = await supabase
      .from("committee_members")
      .select("id, userId, slotNumber, user:users(id, name, phone)")
      .in("id", lockedMemberIds);

    if (lmError || !lockedMembers || lockedMembers.length === 0) {
      throw new Error("Locked members not found");
    }

    // Randomly select winner
    const winnerIndex = Math.floor(Math.random() * lockedMembers.length);
    const winner = lockedMembers[winnerIndex];

    const totalPot = Number(committee.installmentAmountPaise) * committee.totalSlots;
    const commissionRate = Number(committee.commissionRatePct || 5);
    const commissionPaise = Math.floor((totalPot * commissionRate) / 100);
    const winningPayoutPaise = totalPot - commissionPaise;

    // Update payout cycle with winner
    const { error: updateErr } = await supabase
      .from("payout_cycles")
      .update({
        winnerId: winner.userId,
        winnerSlot: winner.slotNumber,
        payoutAmtPaise: winningPayoutPaise,
      })
      .eq("id", payoutCycle.id);

    if (updateErr) throw updateErr;

    return {
      winnerId: winner.userId,
      winnerName: (winner.user as any)?.name || "Unknown",
      winnerPhone: (winner.user as any)?.phone || "",
      winnerSlot: winner.slotNumber,
      payoutAmtPaise: winningPayoutPaise,
      commissionPaise,
      totalPot,
      lockedCount: lockedMemberIds.length,
    };
  }

  static async confirmLotteryPayout(committeeId: string, userId: string) {
    const { data: committee, error: commError } = await supabase
      .from("committees")
      .select("*, members:committee_members(*, user:users(*))")
      .eq("id", committeeId)
      .single();

    if (commError || !committee) throw new Error("Committee not found");
    if (committee.type !== "FIXED_WINNER") throw new Error("This endpoint is only for lottery-type committees");
    if (committee.status !== "ACTIVE") throw new Error("Committee is not active");
    if (committee.organizerId !== userId) throw new Error("Only the organizer can confirm payout");

    const cycleNo = committee.currentCycleNo;
    const totalSlots = committee.totalSlots;

    // Get the payout cycle with winner info
    const { data: payoutCycle, error: pcError } = await supabase
      .from("payout_cycles")
      .select("*")
      .eq("committeeId", committeeId)
      .eq("cycleNo", cycleNo)
      .single();

    if (pcError || !payoutCycle) throw new Error("Payout cycle not found. Run draw first.");
    if (payoutCycle.isCompleted) throw new Error(`Cycle #${cycleNo} has already been resolved`);
    if (!payoutCycle.winnerId || payoutCycle.winnerSlot === 0) {
      throw new Error("No winner selected. Run draw first.");
    }

    const winningBidAmountPaise = Number(payoutCycle.payoutAmtPaise);
    const totalPot = Number(committee.installmentAmountPaise) * totalSlots;
    const commissionRate = Number(committee.commissionRatePct || 5);
    const commissionPaise = Math.floor((totalPot * commissionRate) / 100);

    // Generate receipt number
    const receiptNumber = `RCP-${committeeId.slice(0, 4).toUpperCase()}-${cycleNo}-${Date.now()}`;

    // 1. Credit winner wallet
    const { data: winnerWallet, error: walletErr } = await supabase
      .from("wallets")
      .select("*")
      .eq("userId", payoutCycle.winnerId)
      .single();

    if (walletErr || !winnerWallet) throw new Error("Winner wallet not found");

    const winnerBalanceBefore = Number(winnerWallet.balancePaise);
    const winnerBalanceAfter = winnerBalanceBefore + winningBidAmountPaise;

    await supabase
      .from("wallets")
      .update({ balancePaise: winnerBalanceAfter })
      .eq("id", winnerWallet.id);

    await supabase
      .from("transactions")
      .insert({
        walletId: winnerWallet.id,
        userId: payoutCycle.winnerId,
        type: "CREDIT",
        category: "COMMITTEE_PAYOUT",
        status: "COMPLETED",
        amountPaise: winningBidAmountPaise,
        balanceBefore: winnerBalanceBefore,
        balanceAfter: winnerBalanceAfter,
        description: `Lottery Payout Winner - Cycle #${cycleNo}`,
        referenceId: payoutCycle.id,
        referenceType: "PayoutCycle",
        idempotencyKey: `lottery-payout-${committeeId}-${cycleNo}-${Date.now()}`,
      });

    // 2. Credit organizer commission
    const { data: organizerWallet } = await supabase
      .from("wallets")
      .select("*")
      .eq("userId", committee.organizerId)
      .single();

    if (organizerWallet) {
      const orgBalanceBefore = Number(organizerWallet.balancePaise);
      const orgBalanceAfter = orgBalanceBefore + commissionPaise;

      await supabase
        .from("wallets")
        .update({ balancePaise: orgBalanceAfter })
        .eq("id", organizerWallet.id);

      await supabase
        .from("transactions")
        .insert({
          walletId: organizerWallet.id,
          userId: committee.organizerId,
          type: "CREDIT",
          category: "COMMISSION",
          status: "COMPLETED",
          amountPaise: commissionPaise,
          balanceBefore: orgBalanceBefore,
          balanceAfter: orgBalanceAfter,
          description: `Lottery Foreman Commission - ${committee.name} Cycle #${cycleNo}`,
          referenceId: payoutCycle.id,
          referenceType: "PayoutCycle",
          idempotencyKey: `lottery-commission-${committeeId}-${cycleNo}-${Date.now()}`,
        });

      emitToUser(committee.organizerId, "wallet:credited", {
        amountPaise: commissionPaise,
        newBalance: orgBalanceAfter,
      });
    }

    // 3. Mark winner as having received payout
    const winnerMember = committee.members?.find((m: any) => m.userId === payoutCycle.winnerId);
    if (winnerMember) {
      await supabase
        .from("committee_members")
        .update({ hasReceivedPayout: true })
        .eq("id", winnerMember.id);
    }

    // 4. Update payout cycle as completed
    const { error: updateErr } = await supabase
      .from("payout_cycles")
      .update({
        isCompleted: true,
        receiptNumber,
        payoutDate: new Date().toISOString(),
      })
      .eq("id", payoutCycle.id);

    if (updateErr) throw updateErr;

    // 5. Write notifications to DB
    const winnerUser = (winnerMember?.user as any)?.name || "Member";

    // Notification to winner
    await supabase.from("notifications").insert({
      userId: payoutCycle.winnerId,
      type: "COMMITTEE_PAYOUT",
      title: "Lottery Winner!",
      body: `Congratulations! You won Cycle #${cycleNo} of ${committee.name}. Payout of ₹${Math.floor(winningBidAmountPaise / 100)} credited to your wallet.`,
      metadata: { committeeId, cycleNo, payoutAmtPaise: winningBidAmountPaise, receiptNumber },
    });

    // Notifications to all other members
    const otherMembers = (committee.members ?? []).filter((m: any) => m.userId !== payoutCycle.winnerId);
    const notifInserts = otherMembers.map((m: any) => ({
      userId: m.userId,
      type: "COMMITTEE_PAYOUT" as const,
      title: "Lottery Completed",
      body: `Lottery for Cycle #${cycleNo} of ${committee.name} completed. Winner: ${winnerUser} (Slot ${payoutCycle.winnerSlot}). Next installment due soon.`,
      metadata: { committeeId, cycleNo, winnerId: payoutCycle.winnerId, receiptNumber },
    }));

    if (notifInserts.length > 0) {
      await supabase.from("notifications").insert(notifInserts);
    }

    // 6. Emit real-time events
    emitToUser(payoutCycle.winnerId, "wallet:credited", {
      amountPaise: winningBidAmountPaise,
      newBalance: winnerBalanceAfter,
    });

    emitToAll("committee:resolved", {
      committeeId,
      cycleNo,
      winnerId: payoutCycle.winnerId,
      payoutAmtPaise: winningBidAmountPaise,
      receiptNumber,
    });

    // 7. Advance to next cycle
    const nextCycleNo = cycleNo + 1;
    let nextStatus = "ACTIVE";
    if (nextCycleNo > totalSlots) {
      nextStatus = "COMPLETED";
    }

    const nextDueDate = new Date(
      new Date().getTime() + committee.cycleDurationDays * 24 * 60 * 60 * 1000
    ).toISOString();

    await supabase
      .from("committees")
      .update({
        currentCycleNo: nextStatus === "COMPLETED" ? cycleNo : nextCycleNo,
        status: nextStatus,
        nextDueDate: nextStatus === "COMPLETED" ? null : nextDueDate,
      })
      .eq("id", committeeId);

    return {
      winnerId: payoutCycle.winnerId,
      winnerName: winnerUser,
      winnerSlot: payoutCycle.winnerSlot,
      payoutAmtPaise: winningBidAmountPaise,
      commissionPaise,
      receiptNumber,
      nextCycleNo: nextStatus === "COMPLETED" ? null : nextCycleNo,
      isCompleted: nextStatus === "COMPLETED",
    };
  }

  static async getLotteryReceipt(committeeId: string, cycleNo: number, userId: string) {
    const { data: committee, error: commError } = await supabase
      .from("committees")
      .select("id, name, organizerId, totalSlots, installmentAmountPaise, commissionRatePct, type")
      .eq("id", committeeId)
      .single();

    if (commError || !committee) throw new Error("Committee not found");
    if (committee.type !== "FIXED_WINNER") throw new Error("This endpoint is only for lottery-type committees");

    // Check access
    const isOrganizer = committee.organizerId === userId;
    if (!isOrganizer) {
      const { data: member } = await supabase
        .from("committee_members")
        .select("id")
        .eq("committeeId", committeeId)
        .eq("userId", userId)
        .maybeSingle();
      if (!member) throw new Error("You do not have access to this committee");
    }

    const { data: payoutCycle, error: pcError } = await supabase
      .from("payout_cycles")
      .select("*")
      .eq("committeeId", committeeId)
      .eq("cycleNo", cycleNo)
      .single();

    if (pcError || !payoutCycle) throw new Error("Payout cycle not found");
    if (!payoutCycle.isCompleted) throw new Error("This cycle has not been completed yet");

    // Get winner info
    const { data: winnerUser } = await supabase
      .from("users")
      .select("id, name, phone")
      .eq("id", payoutCycle.winnerId)
      .single();

    const totalPot = Number(committee.installmentAmountPaise) * committee.totalSlots;
    const commissionRate = Number(committee.commissionRatePct || 5);
    const commissionPaise = Math.floor((totalPot * commissionRate) / 100);

    return {
      receiptNumber: payoutCycle.receiptNumber,
      committeeName: committee.name,
      committeeId: committee.id,
      cycleNo: payoutCycle.cycleNo,
      totalSlots: committee.totalSlots,
      installmentAmountPaise: committee.installmentAmountPaise,
      totalPotPaise: totalPot,
      winner: {
        name: (winnerUser as any)?.name || "Unknown",
        phone: (winnerUser as any)?.phone || "",
        slot: payoutCycle.winnerSlot,
      },
      payoutAmtPaise: Number(payoutCycle.payoutAmtPaise),
      commissionPaise,
      payoutDate: payoutCycle.payoutDate,
      createdAt: payoutCycle.createdAt,
      lockedMembers: payoutCycle.lockedMembers,
    };
  }
}
