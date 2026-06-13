// src/modules/committeeMonths/committeeMonths.service.ts
import prisma from "../../config/database";
import supabase from "../../config/supabase";
import crypto from "crypto";
import {
  calculateMonthlyInterest,
  calculateMaxBid,
  calculateMonthSummary,
  calculateLastMemberTotal,
  calculateLateFee,
} from "../../utils/committeeCalculations";
import type { CommitteeMonthStatus, ResolutionType } from "@prisma/client";

/** Round a float calculation result and wrap it as BigInt for Prisma BigInt fields. */
function toBigInt(n: number): bigint {
  return BigInt(Math.round(n));
}

export class CommitteeMonthsService {
  
  // ─── 1. Open Bidding for Month ─────────────────────────────────────────────
  static async openBiddingForMonth(committeeId: string, monthNumber: number) {
    return prisma.$transaction(async (tx) => {
      // Find the month
      const month = await tx.committeeMonth.findUnique({
        where: {
          committeeId_monthNumber: { committeeId, monthNumber },
        },
        select: {
          id: true,
          committeeId: true,
          monthNumber: true,
          monthDate: true,
          totalPool: true,
          status: true,
          resolutionType: true,
          committee: true,
        },
      });

      if (!month) {
        throw new Error("Committee month not found");
      }

      if (month.status !== "pending") {
        throw new Error(`Month is already in ${month.status} status`);
      }

      // Check if all active members have paid their contribution for this month
      // Note: We're checking monthlyContributions. If they don't exist, they haven't paid.
      const activeMembers = await tx.committeeMember.findMany({
        where: { committeeId, isActive: true },
      });

      const contributions = await tx.monthlyContribution.findMany({
        where: { committeeId, monthId: month.id },
      });

      const paidMemberIds = new Set(
        contributions
          .filter((c) => c.status === "paid")
          .map((c) => c.memberId)
      );

      for (const member of activeMembers) {
        if (!paidMemberIds.has(member.id)) {
          throw new Error("Cannot open bidding: Not all members have paid their contributions for this month.");
        }
      }

      // Set bidding deadline (default 48 hours from now)
      const biddingDeadline = new Date(Date.now() + 48 * 60 * 60 * 1000);

      // Update status
      const updatedMonth = await tx.committeeMonth.update({
        where: { id: month.id },
        data: {
          status: "bidding_open",
          // @ts-ignore - Requires prisma generate to pick up biddingDeadline
          biddingDeadline,
        },
      });

      return updatedMonth;
    });
  }

  // ─── 2. Place Bid ──────────────────────────────────────────────────────────
  static async placeBid(committeeId: string, monthId: string, memberId: string, bidAmount: number) {
    return prisma.$transaction(async (tx) => {
      // Validations
      const month = await tx.committeeMonth.findUnique({
        where: { id: monthId },
        select: {
          id: true,
          committeeId: true,
          monthNumber: true,
          totalPool: true,
          status: true,
          resolutionType: true,
          committee: true,
        },
      });

      if (!month) throw new Error("Month not found");
      if (month.committeeId !== committeeId) throw new Error("Month does not belong to this committee");
      if (month.status !== "bidding_open") throw new Error("Bidding is not open for this month");

      // Check deadline
      // @ts-ignore - Requires prisma generate to pick up biddingDeadline
      if (month.biddingDeadline && new Date() > month.biddingDeadline) {
        throw new Error("Bidding deadline has passed");
      }

      if (bidAmount <= 0) {
        throw new Error("Bid amount must be greater than zero");
      }

      const eligibility = await this.getMemberEligibility(committeeId, memberId, monthId, tx);
      if (!eligibility.canBid) {
        throw new Error(`Member is not eligible to bid: ${eligibility.reason}`);
      }

      // Calculate max bid allowed
      const totalMembers = month.committee.totalSlots;
      const contributionPerPerson = Number(month.committee.installmentAmountPaise);
      const remainingNonWinners = Math.max(totalMembers - (month.monthNumber - 1), 1);
      
      const interestAmount = calculateMonthlyInterest(
        totalMembers,
        remainingNonWinners,
        contributionPerPerson
      );
      const maxBidAllowed = calculateMaxBid(Number(month.totalPool), interestAmount);

      if (bidAmount > maxBidAllowed) {
        throw new Error(`Bid amount exceeds maximum allowed bid of ${maxBidAllowed}`);
      }

      // Upsert bid (replace old bid if exists, or create new one)
      const bid = await tx.bid.upsert({
        where: { monthId_memberId: { monthId, memberId } },
        update: {
          bidAmount: toBigInt(bidAmount),
          placedAt: new Date(),
          status: "pending",
        },
        create: {
          committeeId,
          monthId,
          memberId,
          bidAmount: toBigInt(bidAmount),
          status: "pending",
        },
      });

      return {
        success: true,
        bid,
        maxBidAllowed,
        message: "Bid placed successfully",
      };
    });
  }

  // ─── 3. Resolve Month ──────────────────────────────────────────────────────
  static async resolveMonth(committeeId: string, monthId: string) {
    return prisma.$transaction(async (tx) => {
      const month = await tx.committeeMonth.findUnique({
        where: { id: monthId },
        select: {
          id: true,
          committeeId: true,
          monthNumber: true,
          totalPool: true,
          status: true,
          resolutionType: true,
          committee: true,
        },
      });

      if (!month) throw new Error("Month not found");
      if (month.status === "completed") throw new Error("Month is already completed");

      const bids = await tx.bid.findMany({
        where: { monthId, status: "pending" },
      });

      const totalMembers = month.committee.totalSlots;
      const contributionPerPerson = Number(month.committee.installmentAmountPaise);
      const totalPool = Number(month.totalPool);
      const feePercent = Number(month.committee.commissionRatePct ?? 5);

      let winnerMemberId: string;
      let winningBidAmount: number;
      let resolutionType: "bid_single" | "bid_auction" | "lottery";

      if (bids.length === 0) {
        // Lottery among eligible members
        const activeMembers = await tx.committeeMember.findMany({
          where: { committeeId, isActive: true },
        });

        const eligibleMembers = [];
        for (const member of activeMembers) {
          const el = await this.getMemberEligibility(committeeId, member.id, monthId, tx);
          if (el.canBid) {
            eligibleMembers.push(member.id);
          }
        }

        if (eligibleMembers.length === 0) {
          throw new Error("No eligible members found for lottery");
        }

        winnerMemberId = this.runLottery(eligibleMembers);
        // Winning bid amount in lottery is technically the max allowed bid, or totalPool - interest
        const remainingNonWinners = Math.max(totalMembers - (month.monthNumber - 1), 1);
        const interestAmount = calculateMonthlyInterest(totalMembers, remainingNonWinners, contributionPerPerson);
        winningBidAmount = calculateMaxBid(totalPool, interestAmount);
        resolutionType = "lottery";

      } else if (bids.length === 1) {
        // Single bid
        winnerMemberId = bids[0].memberId;
        winningBidAmount = Number(bids[0].bidAmount);
        resolutionType = "bid_single";
      } else {
        // 2+ bids, find lowest
        bids.sort((a, b) => Number(a.bidAmount) - Number(b.bidAmount));
        const lowestBidAmount = Number(bids[0].bidAmount);
        
        const tiedBids = bids.filter(b => Number(b.bidAmount) === lowestBidAmount);
        
        if (tiedBids.length > 1) {
          // Tie-breaker lottery among tied members
          const tiedMemberIds = tiedBids.map(b => b.memberId);
          winnerMemberId = this.runLottery(tiedMemberIds);
        } else {
          winnerMemberId = tiedBids[0].memberId;
        }
        winningBidAmount = lowestBidAmount;
        resolutionType = "bid_auction";
      }

      // Mark bids status
      await tx.bid.updateMany({
        where: { monthId, memberId: { not: winnerMemberId } },
        data: { status: "lost" },
      });

      await tx.bid.updateMany({
        where: { monthId, memberId: winnerMemberId },
        data: { status: "won" },
      });

      // Calculate month summary
      const remainingNonWinners = Math.max(totalMembers - (month.monthNumber - 1), 1);
      const summary = calculateMonthSummary({
        totalMembers,
        remainingNonWinners,
        contributionPerPerson,
        totalPool,
        winningBidAmount,
        feePercent,
      });

      // Update month (BigInt cast required for Prisma BigInt fields)
      const updatedMonth = await tx.committeeMonth.update({
        where: { id: monthId },
        data: {
          status: "completed" as CommitteeMonthStatus,
          winnerMemberId,
          winningBidAmount: toBigInt(winningBidAmount),
          resolutionType: resolutionType as ResolutionType,
          remainingBalance: toBigInt(summary.remainingBalance),
          organiserFee: toBigInt(summary.organiserFee),
          distributableAmount: toBigInt(summary.distributableAmount),
          interestAmount: toBigInt(summary.interestAmount),
          perMemberDistribution: toBigInt(summary.perMemberDistribution),
        },
      });

      // Mark member as having received payout
      await tx.committeeMember.update({
        where: { id: winnerMemberId },
        data: { hasReceivedPayout: true },
      });

      // Create fund disbursement for winner
      await tx.fundDisbursement.create({
        data: {
          committeeId,
          monthId,
          memberId: winnerMemberId,
          disbursementType: (resolutionType === "lottery" ? "lottery_payout" : "bid_payout") as "lottery_payout" | "bid_payout",
          amount: toBigInt(winningBidAmount),
          notes: `Month ${month.monthNumber} payout`,
        },
      });

      // Create member distributions
      const activeMembers = await tx.committeeMember.findMany({
        where: { committeeId, isActive: true },
      });

      const distributions = activeMembers.map(m => ({
        committeeId,
        monthId,
        memberId: m.id,
        distributionAmount: toBigInt(summary.perMemberDistribution),
        interestShare: toBigInt(summary.interestAmount / totalMembers),
        organiserFeeShare: toBigInt(summary.organiserFee / totalMembers),
      }));

      for (const dist of distributions) {
        await tx.memberDistribution.upsert({
          where: { monthId_memberId: { monthId, memberId: dist.memberId } },
          create: dist,
          update: dist,
        });
      }

      return {
        success: true,
        month: updatedMonth,
        summary,
        winnerMemberId,
      };
    });
  }

  // ─── 4. Run Lottery ────────────────────────────────────────────────────────
  static runLottery(eligibleMemberIds: string[]): string {
    if (eligibleMemberIds.length === 0) {
      throw new Error("No eligible members to run lottery");
    }
    const randomIndex = crypto.randomInt(0, eligibleMemberIds.length);
    return eligibleMemberIds[randomIndex];
  }

  // ─── 5. Get Member Eligibility ─────────────────────────────────────────────
  static async getMemberEligibility(_committeeId: string, memberId: string, monthId: string, txContext?: any) {
    const tx = txContext || prisma;
    
    const member = await tx.committeeMember.findUnique({
      where: { id: memberId },
    });

    if (!member) {
      return { canBid: false, reason: "Member not found", hasWonBefore: false, contributionStatus: "unknown" };
    }
    if (!member.isActive) {
      return { canBid: false, reason: "Member is inactive", hasWonBefore: member.hasReceivedPayout, contributionStatus: "unknown" };
    }

    if (member.hasReceivedPayout) {
      return { canBid: false, reason: "Member has already won a previous month", hasWonBefore: true, contributionStatus: "unknown" };
    }

    const contribution = await tx.monthlyContribution.findUnique({
      where: { monthId_memberId: { monthId, memberId } },
    });

    const status = contribution?.status || "pending";

    if (status !== "paid") {
      return { canBid: false, reason: `Contribution status is ${status}`, hasWonBefore: false, contributionStatus: status };
    }

    return { canBid: true, reason: "Eligible", hasWonBefore: false, contributionStatus: status };
  }


  // ───────────────────────────────────────────────────────────────────────────
  // Read methods — Supabase client (matches rest of codebase)

  static async getMonthsForCommittee(committeeId: string) {
    const { data: committee, error: cErr } = await supabase
      .from("committees")
      .select("totalSlots, installmentAmountPaise, commissionRatePct")
      .eq("id", committeeId)
      .single();

    if (cErr || !committee) throw new Error("Committee not found");

    const totalMembers = committee.totalSlots;
    const contributionPerPerson = Number(committee.installmentAmountPaise);
    const feePercent = Number(committee.commissionRatePct ?? 5);
    const totalPool = totalMembers * contributionPerPerson;

    const { data: months, error: mErr } = await supabase
      .from("committee_months")
      .select("id, committee_id, month_number, month_date, total_pool, status, winner_member_id, winning_bid_amount, remaining_balance, organiser_fee, distributable_amount, interest_amount, per_member_distribution, resolution_type")
      .eq("committee_id", committeeId)
      .order("month_number", { ascending: true });

    if (mErr) throw mErr;

    const monthList = months || [];
    const completedCount = monthList.filter((m: any) => m.status === "completed").length;

    const enrichedMonths = monthList.map((month: any) => {
      const remainingNonWinners = Math.max(totalMembers - (month.month_number - 1), 1);

      const calculated = calculateMonthSummary({
        totalMembers,
        remainingNonWinners,
        contributionPerPerson,
        totalPool,
        winningBidAmount: month.winning_bid_amount ? Number(month.winning_bid_amount) : 0,
        feePercent,
      });

      return {
        id: month.id,
        committeeId: month.committee_id,
        monthNumber: month.month_number,
        monthDate: month.month_date,
        status: month.status,
        winnerMemberId: month.winner_member_id,
        resolutionType: month.resolution_type,
        totalPool: Number(month.total_pool),
        winningBidAmount: month.winning_bid_amount ? Number(month.winning_bid_amount) : null,
        remainingBalance: Number(month.remaining_balance),
        organiserFee: Number(month.organiser_fee),
        distributableAmount: Number(month.distributable_amount),
        interestAmount: Number(month.interest_amount),
        perMemberDistribution: Number(month.per_member_distribution),
        projected: {
          interestAmount: calculated.interestAmount,
          maxBidAllowed: calculated.maxBidAllowed,
          remainingBalance: calculated.remainingBalance,
          organiserFee: calculated.organiserFee,
          distributableAmount: calculated.distributableAmount,
          perMemberDistribution: calculated.perMemberDistribution,
        },
      };
    });

    return {
      committeeId,
      totalMembers,
      contributionPerPerson,
      totalPool,
      feePercent,
      completedMonths: completedCount,
      months: enrichedMonths,
    };
  }

  static async getMonthDetail(committeeId: string, monthId: string) {
    const { data: committee, error: cErr } = await supabase
      .from("committees")
      .select("totalSlots, installmentAmountPaise, commissionRatePct")
      .eq("id", committeeId)
      .single();

    if (cErr || !committee) throw new Error("Committee not found");

    const { data: month, error: mErr } = await supabase
      .from("committee_months")
      .select("id, committee_id, month_number, month_date, total_pool, status, winner_member_id, winning_bid_amount, remaining_balance, organiser_fee, distributable_amount, interest_amount, per_member_distribution, resolution_type")
      .eq("id", monthId)
      .single();

    if (mErr || !month || month.committee_id !== committeeId) {
      throw new Error("Month not found");
    }

    const totalMembers = committee.totalSlots;
    const contributionPerPerson = Number(committee.installmentAmountPaise);
    const feePercent = Number(committee.commissionRatePct ?? 5);
    const totalPool = totalMembers * contributionPerPerson;
    const remainingNonWinners = Math.max(totalMembers - (month.month_number - 1), 1);

    const calculated = calculateMonthSummary({
      totalMembers,
      remainingNonWinners,
      contributionPerPerson,
      totalPool,
      winningBidAmount: month.winning_bid_amount ? Number(month.winning_bid_amount) : 0,
      feePercent,
    });

    // Fetch related data in parallel
    const [bidsRes, contribsRes, distsRes] = await Promise.all([
      supabase
        .from("bids")
        .select("id, committee_id, month_id, member_id, bid_amount, placed_at, status, committeeMember:committee_members(id, userId, slotNumber, user:users(id, name, phone))")
        .eq("month_id", monthId)
        .order("bid_amount", { ascending: true }),
      supabase
        .from("monthly_contributions")
        .select("id, committee_id, month_id, member_id, amount_due, amount_paid, late_fee_amount, status, paid_at, late_weeks, committeeMember:committee_members(id, userId, slotNumber, user:users(id, name, phone))")
        .eq("month_id", monthId),
      supabase
        .from("member_distributions")
        .select("id, committee_id, month_id, member_id, distribution_amount, interest_share, organiser_fee_share, distributed_at, committeeMember:committee_members(id, userId, slotNumber, user:users(id, name, phone))")
        .eq("month_id", monthId)
        .order("distribution_amount", { ascending: false }),
    ]);

    const bids = (bidsRes.data || []).map((b: any) => ({
      id: b.id,
      committeeId: b.committee_id,
      monthId: b.month_id,
      memberId: b.member_id,
      bidAmount: Number(b.bid_amount),
      placedAt: b.placed_at,
      status: b.status,
      committeeMember: b.committeeMember,
    }));

    const monthlyContributions = (contribsRes.data || []).map((c: any) => ({
      id: c.id,
      committeeId: c.committee_id,
      monthId: c.month_id,
      memberId: c.member_id,
      amountDue: Number(c.amount_due),
      amountPaid: Number(c.amount_paid),
      lateFeeAmount: Number(c.late_fee_amount),
      status: c.status,
      paidAt: c.paid_at,
      lateWeeks: c.late_weeks,
      committeeMember: c.committeeMember,
    }));

    const memberDistributions = (distsRes.data || []).map((d: any) => ({
      id: d.id,
      committeeId: d.committee_id,
      monthId: d.month_id,
      memberId: d.member_id,
      distributionAmount: Number(d.distribution_amount),
      interestShare: Number(d.interest_share),
      organiserFeeShare: Number(d.organiser_fee_share),
      distributedAt: d.distributed_at,
      committeeMember: d.committeeMember,
    }));

    return {
      id: month.id,
      committeeId: month.committee_id,
      monthNumber: month.month_number,
      monthDate: month.month_date,
      status: month.status,
      winnerMemberId: month.winner_member_id,
      resolutionType: month.resolution_type,
      totalPool: Number(month.total_pool),
      winningBidAmount: month.winning_bid_amount ? Number(month.winning_bid_amount) : null,
      remainingBalance: Number(month.remaining_balance),
      organiserFee: Number(month.organiser_fee),
      distributableAmount: Number(month.distributable_amount),
      interestAmount: Number(month.interest_amount),
      perMemberDistribution: Number(month.per_member_distribution),
      projected: {
        interestAmount: calculated.interestAmount,
        maxBidAllowed: calculated.maxBidAllowed,
        remainingBalance: calculated.remainingBalance,
        organiserFee: calculated.organiserFee,
        distributableAmount: calculated.distributableAmount,
        perMemberDistribution: calculated.perMemberDistribution,
      },
      bids,
      monthlyContributions,
      memberDistributions,
    };
  }

  static async calculateProjectedMonth(committeeId: string, monthNumber: number, winningBidAmount?: number) {
    const { data: committee, error: cErr } = await supabase
      .from("committees")
      .select("totalSlots, installmentAmountPaise, commissionRatePct")
      .eq("id", committeeId)
      .single();

    if (cErr || !committee) throw new Error("Committee not found");

    const totalMembers = committee.totalSlots;
    const contributionPerPerson = Number(committee.installmentAmountPaise);
    const feePercent = Number(committee.commissionRatePct ?? 5);
    const totalPool = totalMembers * contributionPerPerson;
    const remainingNonWinners = Math.max(totalMembers - (monthNumber - 1), 1);

    const summary = calculateMonthSummary({
      totalMembers,
      remainingNonWinners,
      contributionPerPerson,
      totalPool,
      winningBidAmount: winningBidAmount ?? 0,
      feePercent,
    });

    return {
      committeeId,
      monthNumber,
      totalMembers,
      contributionPerPerson,
      totalPool,
      remainingNonWinners,
      feePercent,
      ...summary,
    };
  }

  static async createMonth(params: {
    committeeId: string;
    monthNumber: number;
    monthDate: string;
    resolutionType: "bid_single" | "bid_auction" | "lottery";
    winningBidAmount?: number;
  }) {
    const { committeeId, monthNumber, monthDate, resolutionType, winningBidAmount } = params;

    const { data: committee, error: cErr } = await supabase
      .from("committees")
      .select("totalSlots, installmentAmountPaise, commissionRatePct")
      .eq("id", committeeId)
      .single();

    if (cErr || !committee) throw new Error("Committee not found");

    const totalMembers = committee.totalSlots;
    const contributionPerPerson = Number(committee.installmentAmountPaise);
    const feePercent = Number(committee.commissionRatePct ?? 5);
    const totalPool = totalMembers * contributionPerPerson;
    const remainingNonWinners = Math.max(totalMembers - (monthNumber - 1), 1);

    const summary = calculateMonthSummary({
      totalMembers,
      remainingNonWinners,
      contributionPerPerson,
      totalPool,
      winningBidAmount: winningBidAmount ?? 0,
      feePercent,
    });

    const { data: month, error: mErr } = await supabase
      .from("committee_months")
      .insert({
        committee_id: committeeId,
        month_number: monthNumber,
        month_date: new Date(monthDate),
        total_pool: totalPool,
        status: "pending",
        winning_bid_amount: winningBidAmount != null ? winningBidAmount : null,
        remaining_balance: summary.remainingBalance,
        organiser_fee: summary.organiserFee,
        distributable_amount: summary.distributableAmount,
        interest_amount: summary.interestAmount,
        per_member_distribution: summary.perMemberDistribution,
        resolution_type: resolutionType,
      })
      .select()
      .single();

    if (mErr) throw mErr;

    return { ...month, projected: summary };
  }

  static async calculateMemberLateFee(params: {
    committeeId: string;
    memberId: string;
    monthId: string;
    weeksLate: number;
  }) {
    const { committeeId, memberId, monthId, weeksLate } = params;

    const { data: committee, error: cErr } = await supabase
      .from("committees")
      .select("installmentAmountPaise")
      .eq("id", committeeId)
      .single();

    if (cErr || !committee) throw new Error("Committee not found");

    const contributionAmount = Number(committee.installmentAmountPaise);
    const lateFeeAmount = calculateLateFee(contributionAmount, weeksLate);

    return {
      committeeId,
      memberId,
      monthId,
      contributionAmount,
      weeksLate,
      lateFeeAmount,
      totalDue: contributionAmount + lateFeeAmount,
    };
  }

  static async getLastMemberEarnings(committeeId: string, memberId: string) {
    const { data: distributions, error: dErr } = await supabase
      .from("member_distributions")
      .select("distribution_amount")
      .eq("committee_id", committeeId)
      .eq("member_id", memberId)
      .order("distributed_at", { ascending: true });

    if (dErr) throw dErr;

    const { data: disbursement } = await supabase
      .from("fund_disbursements")
      .select("amount")
      .eq("committee_id", committeeId)
      .eq("member_id", memberId)
      .limit(1)
      .single();

    const monthlyDistributions = (distributions || []).map(d => Number(d.distribution_amount));
    const finalPayout = disbursement ? Number(disbursement.amount) : 0;

    const total = calculateLastMemberTotal(monthlyDistributions, finalPayout);

    return {
      committeeId,
      memberId,
      monthlyDistributions,
      finalPayout,
      totalEarnings: total,
    };
  }
}
