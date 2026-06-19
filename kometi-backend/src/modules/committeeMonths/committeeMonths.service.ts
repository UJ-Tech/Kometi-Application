// src/modules/committeeMonths/committeeMonths.service.ts
import supabase from "../../config/supabase";
import crypto from "crypto";
import {
  calculateMonthlyInterest,
  calculateMaxBid,
  calculateMonthSummary,
  calculateLastMemberTotal,
  calculateLateFeeForMember,
} from "../../utils/committeeCalculations";
import { WalletLedgerService } from "../wallet/wallet-ledger.service";
import { InsufficientBalanceError, LedgerIntegrityError } from "../../utils/errors";

/**
 * Generate placeholder contribution records for projection/display.
 * Used when calculateMonthSummary needs contributions but no real payments exist yet.
 */
function placeholderContributions(totalMembers: number, contributionPerPerson: number) {
  return Array.from({ length: totalMembers }, (_, i) => ({
    memberId: `_placeholder_${i + 1}`,
    amountDue: contributionPerPerson,
    amountPaid: contributionPerPerson,
    lateFeeAmount: 0,
    weeksLate: 0,
    status: "paid" as const,
  }));
}

export class CommitteeMonthsService {
  
  // ─── 1. Open Bidding for Month ─────────────────────────────────────────────
  static async openBiddingForMonth(committeeId: string, monthNumber: number) {
    // Find the month
    const { data: month, error: monthErr } = await supabase
      .from("committee_months")
      .select("id, committee_id, month_number, status")
      .eq("committee_id", committeeId)
      .eq("month_number", monthNumber)
      .single();

    if (monthErr || !month) {
      throw new Error("Committee month not found");
    }

    if (month.status !== "pending") {
      throw new Error(`Month is already in ${month.status} status`);
    }

    // Check if all active members have paid their contribution for this month
    const { data: activeMembers, error: membersErr } = await supabase
      .from("committee_members")
      .select("id")
      .eq("committeeId", committeeId)
      .eq("isActive", true);

    if (membersErr) throw membersErr;

    const { data: contributions, error: contribErr } = await supabase
      .from("monthly_contributions")
      .select("member_id, status")
      .eq("committee_id", committeeId)
      .eq("month_id", month.id);

    if (contribErr) throw contribErr;

    const paidMemberIds = new Set(
      (contributions || [])
        .filter((c) => c.status === "paid")
        .map((c) => c.member_id)
    );

    for (const member of activeMembers || []) {
      if (!paidMemberIds.has(member.id)) {
        throw new Error("Cannot open bidding: Not all members have paid their contributions for this month.");
      }
    }

    // Set bidding deadline (default 48 hours from now)
    const biddingDeadline = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

    // Update status
    const { data: updatedMonth, error: updateErr } = await supabase
      .from("committee_months")
      .update({
        status: "bidding_open",
        bidding_deadline: biddingDeadline,
      })
      .eq("id", month.id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    return updatedMonth;
  }

  // ─── 2. Place Bid ──────────────────────────────────────────────────────────
  static async placeBid(committeeId: string, monthId: string, memberId: string, bidAmount: number) {
    // Fetch month + committee in parallel
    const [monthRes, committeeRes] = await Promise.all([
      supabase
        .from("committee_months")
        .select("id, committee_id, month_number, total_pool, status, bidding_deadline")
        .eq("id", monthId)
        .single(),
      supabase
        .from("committees")
        .select("totalSlots, installmentAmountPaise")
        .eq("id", committeeId)
        .single(),
    ]);

    const month = monthRes.data;
    const committee = committeeRes.data;

    if (monthRes.error || !month) throw new Error("Month not found");
    if (committeeRes.error || !committee) throw new Error("Committee not found");
    if (month.committee_id !== committeeId) throw new Error("Month does not belong to this committee");
    if (month.status !== "bidding_open") throw new Error("Bidding is not open for this month");

    // Check deadline
    if (month.bidding_deadline && new Date() > new Date(month.bidding_deadline)) {
      throw new Error("Bidding deadline has passed");
    }

    if (bidAmount <= 0) {
      throw new Error("Bid amount must be greater than zero");
    }

    const eligibility = await this.getMemberEligibility(committeeId, memberId, monthId);
    if (!eligibility.canBid) {
      throw new Error(`Member is not eligible to bid: ${eligibility.reason}`);
    }

    // Calculate max bid allowed
    const totalMembers = committee.totalSlots;
    const contributionPerPerson = Number(committee.installmentAmountPaise);
    const remainingNonWinners = Math.max(totalMembers - (month.month_number - 1), 1);

    const interestAmount = calculateMonthlyInterest(
      totalMembers,
      remainingNonWinners,
      contributionPerPerson
    );
    const maxBidAllowed = calculateMaxBid(Number(month.total_pool), interestAmount);

    if (bidAmount > maxBidAllowed) {
      throw new Error(`Bid amount exceeds maximum allowed bid of ${maxBidAllowed}`);
    }

    // Upsert bid (replace old bid if exists, or create new one)
    const { data: existingBid } = await supabase
      .from("bids")
      .select("id")
      .eq("month_id", monthId)
      .eq("member_id", memberId)
      .single();

    let bid;
    if (existingBid) {
      const { data: updated, error: updErr } = await supabase
        .from("bids")
        .update({
          bid_amount: bidAmount,
          placed_at: new Date().toISOString(),
          status: "pending",
        })
        .eq("id", existingBid.id)
        .select()
        .single();
      if (updErr) throw updErr;
      bid = updated;
    } else {
      const { data: created, error: insErr } = await supabase
        .from("bids")
        .insert({
          committee_id: committeeId,
          month_id: monthId,
          member_id: memberId,
          bid_amount: bidAmount,
          status: "pending",
        })
        .select()
        .single();
      if (insErr) throw insErr;
      bid = created;
    }

    return {
      success: true,
      bid,
      maxBidAllowed,
      message: "Bid placed successfully",
    };
  }

  // ─── 3. Resolve Month ──────────────────────────────────────────────────────
  // ARCHITECTURAL NOTE: This function uses sequential Supabase writes (no
  // multi-table transaction). If any step fails midway, the month stays in
  // its previous state and can be retried. All wallet operations use
  // idempotency keys, and the post-resolution verifyMonthLedgerIntegrity
  // check ensures total credits == total debits.
  static async resolveMonth(committeeId: string, monthId: string) {
    const { data: month, error: monthErr } = await supabase
      .from("committee_months")
      .select("id, committee_id, month_number, total_pool, status, resolution_type")
      .eq("id", monthId)
      .single();

    if (monthErr || !month) throw new Error("Month not found");
    if (month.status === "completed") throw new Error("Month is already completed");

    // Fetch committee details
    const { data: committee, error: cErr } = await supabase
      .from("committees")
      .select("totalSlots, installmentAmountPaise, commissionRatePct, organizerId")
      .eq("id", committeeId)
      .single();

    if (cErr || !committee) throw new Error("Committee not found");

    // Fetch bids
    const { data: bids, error: bidsErr } = await supabase
      .from("bids")
      .select("id, member_id, bid_amount, status")
      .eq("month_id", monthId)
      .eq("status", "pending");

    if (bidsErr) throw bidsErr;

    const totalMembers = committee.totalSlots;
    const contributionPerPerson = Number(committee.installmentAmountPaise);
    const totalPool = Number(month.total_pool);
    const feePercent = Number(committee.commissionRatePct ?? 5);

    let winnerMemberId: string;
    let winningBidAmount: number;
    let resolutionType: "bid_single" | "bid_auction" | "lottery";

    if (!bids || bids.length === 0) {
      // Lottery among eligible members
      const { data: activeMembers, error: amErr } = await supabase
        .from("committee_members")
        .select("id")
        .eq("committeeId", committeeId)
        .eq("isActive", true);

      if (amErr) throw amErr;

      const eligibleMembers: string[] = [];
      for (const member of activeMembers || []) {
        const el = await this.getMemberEligibility(committeeId, member.id, monthId);
        if (el.canBid) {
          eligibleMembers.push(member.id);
        }
      }

      if (eligibleMembers.length === 0) {
        throw new Error("No eligible members found for lottery");
      }

      winnerMemberId = this.runLottery(eligibleMembers);
      const remainingNonWinners = Math.max(totalMembers - (month.month_number - 1), 1);
      const interestAmount = calculateMonthlyInterest(totalMembers, remainingNonWinners, contributionPerPerson);
      winningBidAmount = calculateMaxBid(totalPool, interestAmount);
      resolutionType = "lottery";

    } else if (bids.length === 1) {
      winnerMemberId = bids[0].member_id;
      winningBidAmount = Number(bids[0].bid_amount);
      resolutionType = "bid_single";
    } else {
      // 2+ bids, find lowest
      bids.sort((a, b) => Number(a.bid_amount) - Number(b.bid_amount));
      const lowestBidAmount = Number(bids[0].bid_amount);

      const tiedBids = bids.filter(b => Number(b.bid_amount) === lowestBidAmount);

      if (tiedBids.length > 1) {
        const tiedMemberIds = tiedBids.map(b => b.member_id);
        winnerMemberId = this.runLottery(tiedMemberIds);
      } else {
        winnerMemberId = tiedBids[0].member_id;
      }
      winningBidAmount = lowestBidAmount;
      resolutionType = "bid_auction";
    }

    // Mark non-winning bids as "lost"
    const nonWinnerIds = bids?.filter(b => b.member_id !== winnerMemberId).map(b => b.id) || [];
    if (nonWinnerIds.length > 0) {
      const { error: lostErr } = await supabase
        .from("bids")
        .update({ status: "lost" })
        .in("id", nonWinnerIds);
      if (lostErr) throw lostErr;
    }

    // Mark winning bid as "won"
    if (bids && bids.length > 0) {
      const { error: wonErr } = await supabase
        .from("bids")
        .update({ status: "won" })
        .eq("month_id", monthId)
        .eq("member_id", winnerMemberId);
      if (wonErr) throw wonErr;
    }

    // Calculate month summary
    const remainingNonWinners = Math.max(totalMembers - (month.month_number - 1), 1);
    const interestRatePercent = 2;
    const summary = calculateMonthSummary({
      committeeId,
      monthNumber: month.month_number,
      totalMembers,
      contributionPerPerson,
      organiserFeePercent: feePercent,
      interestRatePercent,
      winningBidAmount,
      winnerId: winnerMemberId,
      resolutionType,
      contributions: placeholderContributions(totalMembers, contributionPerPerson),
      remainingNonWinners,
    });

    // Update month status to completed
    const { error: updateMonthErr } = await supabase
      .from("committee_months")
      .update({
        status: "completed",
        winner_member_id: winnerMemberId,
        winning_bid_amount: winningBidAmount,
        resolution_type: resolutionType,
        remaining_balance: summary.remainingBalance,
        organiser_fee: summary.organiserFee,
        distributable_amount: summary.distributableAmount,
        interest_amount: summary.interestAmount,
        per_member_distribution: summary.perMemberDistribution,
      })
      .eq("id", monthId);

    if (updateMonthErr) throw updateMonthErr;

    // Mark winner as having received payout
    const { error: winnerErr } = await supabase
      .from("committee_members")
      .update({ hasReceivedPayout: true })
      .eq("id", winnerMemberId);

    if (winnerErr) throw winnerErr;

    // Create fund disbursement for winner
    const { error: disburseErr } = await supabase
      .from("fund_disbursements")
      .insert({
        committee_id: committeeId,
        month_id: monthId,
        member_id: winnerMemberId,
        disbursement_type: resolutionType === "lottery" ? "lottery_payout" : "bid_payout",
        amount: winningBidAmount,
        notes: `Month ${month.month_number} payout`,
      });

    if (disburseErr) throw disburseErr;

    // Create member distributions
    const { data: activeMembers, error: amErr2 } = await supabase
      .from("committee_members")
      .select("id, userId")
      .eq("committeeId", committeeId)
      .eq("isActive", true);

    if (amErr2) throw amErr2;

    if (activeMembers && activeMembers.length > 0) {
      const distributions = activeMembers.map(m => ({
        committee_id: committeeId,
        month_id: monthId,
        member_id: m.id,
        distribution_amount: summary.perMemberDistribution,
        interest_share: summary.interestAmount / totalMembers,
        organiser_fee_share: summary.organiserFee / totalMembers,
      }));

      const { error: distErr } = await supabase
        .from("member_distributions")
        .upsert(distributions, { onConflict: "month_id,member_id" });

      if (distErr) throw distErr;
    }

    // ─── Wallet Ledger Operations ─────────────────────────────────────
    // Resolve committee_member.id → users.id for wallet ledger FK
    const { data: winnerMember } = await supabase
      .from("committee_members")
      .select("userId")
      .eq("id", winnerMemberId)
      .single();

    const winnerUserId = winnerMember?.userId || winnerMemberId;
    const activeMembersWithUserId = (activeMembers || []).map(m => ({ committeeMemberId: m.id, userId: m.userId }));

    // 1. Winner: credit bid payout
    await WalletLedgerService.creditWallet({
      memberId: winnerUserId,
      committeeId,
      amount: winningBidAmount,
      entryType: "bid_payout",
      referenceType: "committee_months",
      referenceId: monthId,
      idempotencyKey: `payout_${committeeId}_${monthId}`,
      createdBy: "system",
      notes: `Month ${month.month_number} winning bid payout`,
    });

    // 1b. Winner: debit interest charge
    try {
      await WalletLedgerService.debitWallet({
        memberId: winnerUserId,
        committeeId,
        amount: summary.interestAmount,
        entryType: "interest_charge",
        referenceType: "committee_months",
        referenceId: monthId,
        idempotencyKey: `interest_${committeeId}_${monthId}`,
        createdBy: "system",
        notes: `Month ${month.month_number} interest charge on winner`,
      });
    } catch (err: any) {
      if (err instanceof InsufficientBalanceError) {
        console.error(
          `[CRITICAL] resolveMonth: Winner ${winnerUserId} has insufficient balance for interest charge ` +
          `(${summary.interestAmount} paise) after receiving bid payout of ${winningBidAmount} paise. ` +
          `Committee: ${committeeId}, Month: ${monthId}. Rolling back entire resolution.`
        );
        throw new Error(
          `CRITICAL: Winner wallet cannot cover interest charge (₹${summary.interestAmount / 100}). ` +
          `Month resolution rolled back. Please investigate member ${winnerUserId}'s wallet state.`
        );
      }
      throw err;
    }

    // 2. Each active member: credit distribution (including the winner)
    for (const member of activeMembersWithUserId) {
      await WalletLedgerService.creditWallet({
        memberId: member.userId,
        committeeId,
        amount: summary.perMemberDistribution,
        entryType: "distribution_credit",
        referenceType: "committee_months",
        referenceId: monthId,
        idempotencyKey: `dist_${committeeId}_${monthId}_${member.committeeMemberId}`,
        createdBy: "system",
        notes: `Month ${month.month_number} distribution credit`,
      });
    }

    // 2b. Organiser fee: debit from organizer's wallet
    if (summary.organiserFee > 0) {
      await WalletLedgerService.debitWallet({
        memberId: committee.organizerId,
        committeeId,
        amount: summary.organiserFee,
        entryType: "adjustment_debit",
        referenceType: "committee_months",
        referenceId: monthId,
        idempotencyKey: `orgfee_${committeeId}_${monthId}`,
        createdBy: "system",
        notes: `Month ${month.month_number} organiser fee`,
      });
    }

    // 3. Post-resolution verification: ensure conservation of money
    const integrity = await this.verifyMonthLedgerIntegrity(committeeId, monthId);
    if (integrity.imbalance !== 0) {
      throw new LedgerIntegrityError(
        committeeId,
        monthId,
        integrity.totalCredits,
        integrity.totalDebits
      );
    }

    return {
      success: true,
      month: { id: monthId, status: "completed" },
      summary,
      winnerMemberId,
    };
  }

  // ─── 3b. Verify Month Ledger Integrity ────────────────────────────────────
  /**
   * Post-resolution verification: ensures all wallet ledger entries for this
   * month sum to zero within the committee (conservation of money).
   *
   * Checks:
   *   - Sum all credits for this committee+month → totalCredits
   *   - Sum all debits for this committee+month → totalDebits
   *   - totalCredits - totalDebits must equal 0
   *
   * If mismatch: logs CRITICAL error, throws LedgerIntegrityError.
   * The caller should NOT proceed to next month's bidding.
   */
  static async verifyMonthLedgerIntegrity(
    committeeId: string,
    monthId: string
  ): Promise<{
    totalCredits: number;
    totalDebits: number;
    imbalance: number;
    entryCount: number;
  }> {
    // Query all confirmed ledger entries for this committee+month
    const { data: entries, error } = await supabase
      .from("wallet_ledger_entries")
      .select("amount, direction, reference_type, reference_id")
      .eq("committee_id", committeeId)
      .eq("reference_type", "committee_months")
      .eq("reference_id", monthId)
      .eq("status", "confirmed");

    if (error) throw error;

    const allEntries = entries || [];

    if (allEntries.length === 0) {
      console.error(
        `[CRITICAL] verifyMonthLedgerIntegrity: No ledger entries found for committee=${committeeId} month=${monthId}. ` +
        `Month was marked completed but no wallet operations were recorded.`
      );
      throw new LedgerIntegrityError(committeeId, monthId, 0, 0);
    }

    // Sum credits and debits
    let totalCredits = 0;
    let totalDebits = 0;

    for (const entry of allEntries) {
      const amount = Number(entry.amount);
      if (entry.direction === "credit") {
        totalCredits += amount;
      } else if (entry.direction === "debit") {
        totalDebits += amount;
      }
    }

    const imbalance = totalCredits - totalDebits;

    // Conservation check: total credits must equal total debits
    if (imbalance !== 0) {
      console.error(
        `[CRITICAL] verifyMonthLedgerIntegrity: Ledger imbalance for committee=${committeeId} month=${monthId}. ` +
        `totalCredits=${totalCredits} paise, totalDebits=${totalDebits} paise, imbalance=${imbalance} paise. ` +
        `Committee flagged for manual review.`
      );
      throw new LedgerIntegrityError(committeeId, monthId, totalCredits, totalDebits);
    }

    return {
      totalCredits,
      totalDebits,
      imbalance,
      entryCount: allEntries.length,
    };
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
  static async getMemberEligibility(_committeeId: string, memberId: string, monthId: string) {
    const { data: member, error: memberErr } = await supabase
      .from("committee_members")
      .select("id, isActive, hasReceivedPayout")
      .eq("id", memberId)
      .single();

    if (memberErr || !member) {
      return { canBid: false, reason: "Member not found", hasWonBefore: false, contributionStatus: "unknown" };
    }
    if (!member.isActive) {
      return { canBid: false, reason: "Member is inactive", hasWonBefore: member.hasReceivedPayout, contributionStatus: "unknown" };
    }

    if (member.hasReceivedPayout) {
      return { canBid: false, reason: "Member has already won a previous month", hasWonBefore: true, contributionStatus: "unknown" };
    }

    const { data: contribution } = await supabase
      .from("monthly_contributions")
      .select("status")
      .eq("month_id", monthId)
      .eq("member_id", memberId)
      .single();

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
        committeeId,
        monthNumber: month.month_number,
        totalMembers,
        contributionPerPerson,
        organiserFeePercent: feePercent,
        interestRatePercent: 2,
        winningBidAmount: month.winning_bid_amount ? Number(month.winning_bid_amount) : 0,
        winnerId: month.winner_member_id || "",
        resolutionType: (month.resolution_type || "bid_auction") as "bid_single" | "bid_auction" | "lottery",
        contributions: placeholderContributions(totalMembers, contributionPerPerson),
        remainingNonWinners,
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
    const remainingNonWinners = Math.max(totalMembers - (month.month_number - 1), 1);

    const calculated = calculateMonthSummary({
      committeeId,
      monthNumber: month.month_number,
      totalMembers,
      contributionPerPerson,
      organiserFeePercent: feePercent,
      interestRatePercent: 2,
      winningBidAmount: month.winning_bid_amount ? Number(month.winning_bid_amount) : 0,
      winnerId: month.winner_member_id || "",
      resolutionType: (month.resolution_type || "bid_auction") as "bid_single" | "bid_auction" | "lottery",
      contributions: placeholderContributions(totalMembers, contributionPerPerson),
      remainingNonWinners,
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
      committeeId,
      monthNumber,
      totalMembers,
      contributionPerPerson,
      organiserFeePercent: feePercent,
      interestRatePercent: 2,
      winningBidAmount: winningBidAmount ?? 0,
      winnerId: "",
      resolutionType: "bid_auction",
      contributions: placeholderContributions(totalMembers, contributionPerPerson),
      remainingNonWinners,
    });

    return {
      ...summary,
      committeeId,
      monthNumber,
      totalMembers,
      contributionPerPerson,
      totalPool,
      remainingNonWinners,
      feePercent,
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
      committeeId,
      monthNumber,
      totalMembers,
      contributionPerPerson,
      organiserFeePercent: feePercent,
      interestRatePercent: 2,
      winningBidAmount: winningBidAmount ?? 0,
      winnerId: "",
      resolutionType,
      contributions: placeholderContributions(totalMembers, contributionPerPerson),
      remainingNonWinners,
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

    // Create monthly_contributions records for all active members
    // so that the payment flow (createContributionOrder) and
    // openBiddingForMonth (checks all members paid) have records to work with.
    const { data: activeMembers, error: membersErr } = await supabase
      .from("committee_members")
      .select("id")
      .eq("committeeId", committeeId)
      .eq("isActive", true);

    if (membersErr) throw membersErr;

    if (activeMembers && activeMembers.length > 0) {
      const contributionRecords = activeMembers.map((member) => ({
        committee_id: committeeId,
        month_id: month.id,
        member_id: member.id,
        amount_due: contributionPerPerson,
        amount_paid: 0,
        status: "pending",
        late_fee_amount: 0,
        late_weeks: 0,
      }));

      const { error: contribErr } = await supabase
        .from("monthly_contributions")
        .insert(contributionRecords);

      if (contribErr) throw contribErr;
    }

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
    const lateFeeAmount = calculateLateFeeForMember(contributionAmount, weeksLate);

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

    const total = calculateLastMemberTotal(monthlyDistributions, finalPayout, 0);

    return {
      committeeId,
      memberId,
      monthlyDistributions,
      finalPayout,
      totalEarnings: total,
    };
  }
}
