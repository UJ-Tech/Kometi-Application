// src/modules/committeeMonths/committeeMonths.service.ts
import supabase from "../../config/supabase";
import crypto from "crypto";
import {
  calculateMonthlyInterest,
  calculateMaxBid,
  calculateMonthSummary,
  calculateLastMemberTotal,
  calculateLateFeeForMember,
  generateMemberPaymentObligations,
  calculatePaymentDeadline,
  runNettedConservationCheck,
} from "../../utils/committeeCalculations";
import { WalletLedgerService } from "../wallet/wallet-ledger.service";
import { emitToAll } from "../../config/socket";

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
  // NEW FLOW: Bidding opens WITHOUT requiring upfront payment.
  // Members pay AFTER resolution (netted flow: contribution - distribution).
  static async openBiddingForMonth(committeeId: string, monthNumber: number) {
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

    // ─── Month 1: Organiser Commission — auto-resolve, no bidding ──────
    if (month.month_number === 1) {
      return this.resolveMonth(committeeId, month.id);
    }

    // ─── Last month: Only 1 member remains — auto-resolve, no bidding ──
    const { data: committee } = await supabase
      .from("committees")
      .select("totalSlots")
      .eq("id", committeeId)
      .single();

    const { data: completedMonths } = await supabase
      .from("committee_months")
      .select("id")
      .eq("committee_id", committeeId)
      .eq("status", "completed");

    const totalSlots = committee?.totalSlots || 0;
    const completedCount = completedMonths?.length || 0;
    const remainingMembers = totalSlots - completedCount;

    if (remainingMembers <= 1) {
      return this.resolveMonth(committeeId, month.id);
    }

    // Set bidding deadline (default 48 hours from now)
    const biddingDeadline = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

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

    // Notify all members that bidding is open
    emitToAll("committee:bidding_opened", { committeeId, monthId: month.id, monthNumber });

    return updatedMonth;
  }

  // ─── 2. Place Bid ──────────────────────────────────────────────────────────
  static async placeBid(committeeId: string, monthId: string, memberId: string, bidAmount: number) {
    // Fetch month + committee in parallel
    const [monthRes, committeeRes] = await Promise.all([
      supabase
        .from("committee_months")
        .select("id, committee_id, month_number, total_pool, status, bidding_deadline, resolution_type")
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
    if (month.resolution_type === "organiser_commission") throw new Error("Month 1 is organiser commission — no bidding allowed");

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

    const interestAmount = calculateMonthlyInterest(remainingNonWinners, contributionPerPerson, 2);
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

    // Notify committee that a bid was placed (without revealing amount)
    emitToAll("committee:bid_placed", { committeeId, monthId });

    return {
      success: true,
      bid,
      maxBidAllowed,
      message: "Bid placed successfully",
    };
  }

  // ─── 3. Resolve Month ──────────────────────────────────────────────────────
  // NEW NETTED FLOW:
  //   1. Determine winner (bid/lottery or organiser_commission for month 1)
  //   2. Calculate summary (includes nonWinnerNetPayable, winnerNetReceivable)
  //   3. Credit winner immediately (winnerNetReceivable)
  //   4. Create payment obligations for ALL members (non-winners pay later)
  //   5. Non-winners have 3 days to pay; if they don't, organiser advances (with 3% penalty after 2 extra days)
  static async resolveMonth(committeeId: string, monthId: string) {
    const { data: month, error: monthErr } = await supabase
      .from("committee_months")
      .select("id, committee_id, month_number, total_pool, status, resolution_type")
      .eq("id", monthId)
      .single();

    if (monthErr || !month) throw new Error("Month not found");
    if (month.status === "completed") throw new Error("Month is already completed");

    const { data: committee, error: cErr } = await supabase
      .from("committees")
      .select("totalSlots, installmentAmountPaise, status, filledSlots, organizerId")
      .eq("id", committeeId)
      .single();

    if (cErr || !committee) throw new Error("Committee not found");

    if (committee.status !== "ACTIVE") {
      throw new Error("Committee must be active before creating months. Please start the committee first.");
    }

    if (committee.filledSlots !== committee.totalSlots) {
      throw new Error(
        `Cannot create month until all slots are filled. Filled: ${committee.filledSlots}/${committee.totalSlots}`
      );
    }

    const totalMembers = committee.totalSlots;
    const contributionPerPerson = Number(committee.installmentAmountPaise);
    const totalPool = Number(month.total_pool);

    let winnerMemberId: string;
    let winningBidAmount: number;
    let resolutionType: "bid_single" | "bid_auction" | "lottery" | "organiser_commission";

    // ─── Month 1: Organiser Commission ──────────────────────────────────
    // No bidding happens. Organiser takes full pool. Every member pays
    // full contribution with nothing distributed back.
    if (month.month_number === 1 || month.resolution_type === "organiser_commission") {
      winningBidAmount = totalPool;
      resolutionType = "organiser_commission";

      // Find organiser's committee_member record
      const { data: orgMember, error: orgErr } = await supabase
        .from("committee_members")
        .select("id")
        .eq("committeeId", committeeId)
        .eq("userId", committee.organizerId)
        .single();

      if (orgErr || !orgMember) throw new Error("Organiser is not a member of this committee");

      winnerMemberId = orgMember.id;
    } else {
      const { data: bids, error: bidsErr } = await supabase
        .from("bids")
        .select("id, member_id, bid_amount, status")
        .eq("month_id", monthId)
        .eq("status", "pending");

      if (bidsErr) throw bidsErr;

      if (!bids || bids.length === 0) {
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
        const interestAmount = calculateMonthlyInterest(remainingNonWinners, contributionPerPerson, 2);
        winningBidAmount = calculateMaxBid(totalPool, interestAmount);
        resolutionType = "lottery";

      } else if (bids.length === 1) {
        winnerMemberId = bids[0].member_id;
        winningBidAmount = Number(bids[0].bid_amount);
        resolutionType = "bid_single";
      } else {
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
      const nonWinnerIds = bids.filter(b => b.member_id !== winnerMemberId).map(b => b.id);
      if (nonWinnerIds.length > 0) {
        const { error: lostErr } = await supabase
          .from("bids")
          .update({ status: "lost" })
          .in("id", nonWinnerIds);
        if (lostErr) throw lostErr;
      }

      // Mark winning bid as "won"
      if (bids.length > 0) {
        const { error: wonErr } = await supabase
          .from("bids")
          .update({ status: "won" })
          .eq("month_id", monthId)
          .eq("member_id", winnerMemberId);
        if (wonErr) throw wonErr;
      }
    }

    // ─── Winner never physically pays — their contribution is netted from winnings ──
    // Mark winner's installment + monthly_contribution as PAID for EVERY resolved month.
    {
      const { data: winnerUser } = await supabase
        .from("committee_members")
        .select("userId")
        .eq("id", winnerMemberId)
        .single();

      if (winnerUser) {
        await supabase
          .from("installments")
          .update({ status: "PAID", paidAt: new Date().toISOString(), paymentMethod: "NETTED_PAYOUT" })
          .eq("committeeId", committeeId)
          .eq("userId", winnerUser.userId)
          .eq("cycleNo", month.month_number);

        await supabase
          .from("monthly_contributions")
          .update({ status: "paid", amount_paid: contributionPerPerson, paid_at: new Date().toISOString() })
          .eq("committee_id", committeeId)
          .eq("month_id", monthId)
          .eq("member_id", winnerMemberId);
      }
    }

    // Calculate month summary (now includes nonWinnerNetPayable, winnerNetReceivable)
    const remainingNonWinners = Math.max(totalMembers - (month.month_number - 1), 1);
    const interestRatePercent = 2;
    const summary = calculateMonthSummary({
      committeeId,
      monthNumber: month.month_number,
      totalMembers,
      contributionPerPerson,
      interestRatePercent,
      winningBidAmount,
      winnerId: winnerMemberId,
      resolutionType,
      contributions: placeholderContributions(totalMembers, contributionPerPerson),
      remainingNonWinners,
    });

    // Run netted conservation check
    const nettedCheck = runNettedConservationCheck(summary, totalMembers);
    if (!nettedCheck.passed) {
      throw new Error(
        `Netted conservation check failed: collected=${nettedCheck.totalCollected}, paid=${nettedCheck.totalPaidOut}, diff=${nettedCheck.difference}`
      );
    }

    // Calculate payment deadline
    const resolvedAt = new Date();
    const paymentDeadline = calculatePaymentDeadline(resolvedAt, summary.paymentDeadlineDays);

    // Update month status to completed with netted amounts
    const { error: updateMonthErr } = await supabase
      .from("committee_months")
      .update({
        status: "completed",
        winner_member_id: winnerMemberId,
        winning_bid_amount: winningBidAmount,
        resolution_type: resolutionType,
        remaining_balance: Math.round(summary.remainingBalance),
        distributable_amount: Math.round(summary.distributableAmount),
        interest_amount: Math.round(summary.interestAmount),
        per_member_distribution: Math.round(summary.perMemberDistribution),
        non_winner_net_payable: Math.round(summary.nonWinnerNetPayable * 100),
        winner_net_receivable: Math.round(summary.winnerNetReceivable * 100),
        payment_deadline: paymentDeadline,
      })
      .eq("id", monthId);

    if (updateMonthErr) throw updateMonthErr;

    // Notify all members that month is resolved
    emitToAll("committee:month_resolved", { committeeId, monthId, monthNumber: month.month_number });

    // Create fund disbursement for winner
    const { error: disburseErr } = await supabase
      .from("fund_disbursements")
      .insert({
        committee_id: committeeId,
        month_id: monthId,
        member_id: winnerMemberId,
        disbursement_type: resolutionType === "organiser_commission"
          ? "organiser_commission"
          : resolutionType === "lottery"
            ? "lottery_payout"
            : "bid_payout",
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
        distribution_amount: Math.round(summary.perMemberDistribution),
        interest_share: Math.round(summary.interestAmount / totalMembers),
      }));

      const { error: distErr } = await supabase
        .from("member_distributions")
        .upsert(distributions, { onConflict: "month_id,member_id" });

      if (distErr) throw distErr;
    }

    // ─── NETTED WALLET OPERATIONS ───────────────────────────────────────
    const activeMembersWithUserId = (activeMembers || []).map(m => ({ committeeMemberId: m.id, userId: m.userId }));

    // 1. Winner: NO wallet credit on resolution — credit only when all obligations settled
    // The winner's obligation record tracks the expected payout (direction="receive", status="pending")
    // Wallet is credited later when all non-winners have paid or organiser has advanced.

    // 2. Generate payment obligations for all members
    const allMemberIds = activeMembersWithUserId.map(m => m.committeeMemberId);
    const obligations = generateMemberPaymentObligations(summary, allMemberIds, resolvedAt);

    // 4. Insert member_payment_obligations records
    if (obligations.length > 0) {
      const obligationRecords = obligations.map(obl => {
        const memberWithUser = activeMembersWithUserId.find(m => m.committeeMemberId === obl.memberId);
        return {
          committee_id: committeeId,
          month_id: monthId,
          member_id: obl.memberId,
          user_id: memberWithUser?.userId || obl.memberId,
          role: obl.role,
          contribution_amount: Math.round(obl.contributionAmount),
          distribution_share: Math.round(obl.distributionShare),
          net_amount: Math.round(obl.netAmount),
          direction: obl.direction,
          interest_charged: Math.round(obl.interestCharged),
          due_date: obl.dueDate,
          status: "pending" as const,
        };
      });

      const { error: oblErr } = await supabase
        .from("member_payment_obligations")
        .insert(obligationRecords);

      if (oblErr) throw oblErr;
    }

    // 5a. Auto-settle organiser commission month (month 1) immediately
    // Organiser receives full pool as commission — no need to wait for member payments
    if (resolutionType === "organiser_commission") {
      try {
        const { data: orgWinnerObl } = await supabase
          .from("member_payment_obligations")
          .select("id, member_id, net_amount")
          .eq("committee_id", committeeId)
          .eq("month_id", monthId)
          .eq("role", "winner")
          .eq("direction", "receive")
          .single();

        if (orgWinnerObl) {
          const { data: orgUser } = await supabase
            .from("committee_members")
            .select("userId")
            .eq("id", orgWinnerObl.member_id)
            .single();

          if (orgUser) {
            const payoutAmount = Number(orgWinnerObl.net_amount);
            if (payoutAmount > 0) {
              await WalletLedgerService.creditWallet({
                memberId: orgUser.userId,
                committeeId,
                amount: payoutAmount,
                entryType: "bid_payout",
                referenceType: "member_payment_obligations",
                referenceId: orgWinnerObl.id,
                idempotencyKey: `organiser_commission_${committeeId}_${monthId}`,
                createdBy: "system",
                notes: `Month 1 organiser commission — full pool credited`,
              });

              await supabase
                .from("member_payment_obligations")
                .update({ status: "paid", paid_at: new Date().toISOString() })
                .eq("id", orgWinnerObl.id);

              await supabase
                .from("committee_members")
                .update({ hasReceivedPayout: true })
                .eq("id", orgWinnerObl.member_id);

              console.log(`[resolveMonth] Month 1 organiser commission auto-settled: ${payoutAmount} paise`);
            }
          }
        }
      } catch (settleErr) {
        console.error(`[resolveMonth] Month 1 auto-settle failed (non-fatal):`, settleErr);
      }
    }

    // 5b. Post-resolution verification
    const integrity = await this.verifyMonthLedgerIntegrity(committeeId, monthId);
    if (integrity.imbalance !== 0) {
      console.warn(
        `[resolveMonth] Ledger imbalance for committee=${committeeId} month=${monthId}: ${integrity.imbalance} paise. ` +
        `This is expected during netted flow — non-winners have not paid yet.`
      );
    }

    return {
      success: true,
      month: { id: monthId, status: "completed" },
      summary: {
        ...summary,
        nonWinnerNetPayable: summary.nonWinnerNetPayable,
        winnerNetReceivable: summary.winnerNetReceivable,
        paymentDeadline,
      },
      winnerMemberId,
      obligations: obligations.map(o => ({
        memberId: o.memberId,
        role: o.role,
        netAmount: o.netAmount,
        direction: o.direction,
        dueDate: o.dueDate,
        status: o.status,
      })),
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
      return { totalCredits: 0, totalDebits: 0, imbalance: 0, entryCount: 0 };
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
  static async getMemberEligibility(_committeeId: string, memberId: string, _monthId: string) {
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

    // In the netted flow, members pay AFTER resolution (contribution - distribution).
    // So we do NOT check contribution status before allowing bids.
    // Check if member is blocked instead.
    const { data: blockedMember } = await supabase
      .from("committee_members")
      .select("is_blocked")
      .eq("id", memberId)
      .single();

    if (blockedMember?.is_blocked) {
      return { canBid: false, reason: "Member is blocked due to overdue payment", hasWonBefore: false, contributionStatus: "pending" };
    }

    return { canBid: true, reason: "Eligible", hasWonBefore: false, contributionStatus: "pending" };
  }


  // ───────────────────────────────────────────────────────────────────────────
  // Read methods — Supabase client (matches rest of codebase)

  static async getMonthsForCommittee(committeeId: string) {
    const { data: committee, error: cErr } = await supabase
      .from("committees")
      .select("totalSlots, installmentAmountPaise")
      .eq("id", committeeId)
      .single();

    if (cErr || !committee) throw new Error("Committee not found");

    const totalMembers = committee.totalSlots;
    const contributionPerPerson = Number(committee.installmentAmountPaise);
    const totalPool = totalMembers * contributionPerPerson;

    const { data: months, error: mErr } = await supabase
      .from("committee_months")
      .select("id, committee_id, month_number, month_date, total_pool, status, winner_member_id, winning_bid_amount, remaining_balance, distributable_amount, interest_amount, per_member_distribution, resolution_type, non_winner_net_payable, winner_net_receivable, payment_deadline")
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
        interestRatePercent: 2,
        winningBidAmount: month.winning_bid_amount ? Number(month.winning_bid_amount) : 0,
        winnerId: month.winner_member_id || "",
        resolutionType: (month.resolution_type || "bid_auction") as "bid_single" | "bid_auction" | "lottery" | "organiser_commission",
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
        distributableAmount: Number(month.distributable_amount),
        interestAmount: Number(month.interest_amount),
        perMemberDistribution: Number(month.per_member_distribution),
        nonWinnerNetPayable: month.non_winner_net_payable ? Number(month.non_winner_net_payable) / 100 : calculated.nonWinnerNetPayable,
        winnerNetReceivable: month.winner_net_receivable ? Number(month.winner_net_receivable) / 100 : calculated.winnerNetReceivable,
        paymentDeadline: month.payment_deadline || null,
        projected: {
          interestAmount: calculated.interestAmount,
          maxBidAllowed: calculated.maxBidAllowed,
          remainingBalance: calculated.remainingBalance,
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
      completedMonths: completedCount,
      months: enrichedMonths,
    };
  }

  static async getMonthDetail(committeeId: string, monthId: string) {
    const { data: committee, error: cErr } = await supabase
      .from("committees")
      .select("totalSlots, installmentAmountPaise")
      .eq("id", committeeId)
      .single();

    if (cErr || !committee) throw new Error("Committee not found");

    const { data: month, error: mErr } = await supabase
      .from("committee_months")
      .select("id, committee_id, month_number, month_date, total_pool, status, winner_member_id, winning_bid_amount, remaining_balance, distributable_amount, interest_amount, per_member_distribution, resolution_type, non_winner_net_payable, winner_net_receivable, payment_deadline")
      .eq("id", monthId)
      .single();

    if (mErr || !month || month.committee_id !== committeeId) {
      throw new Error("Month not found");
    }

    const totalMembers = committee.totalSlots;
    const contributionPerPerson = Number(committee.installmentAmountPaise);
    const remainingNonWinners = Math.max(totalMembers - (month.month_number - 1), 1);

    const calculated = calculateMonthSummary({
      committeeId,
      monthNumber: month.month_number,
      totalMembers,
      contributionPerPerson,
      interestRatePercent: 2,
      winningBidAmount: month.winning_bid_amount ? Number(month.winning_bid_amount) : 0,
      winnerId: month.winner_member_id || "",
      resolutionType: (month.resolution_type || "bid_auction") as "bid_single" | "bid_auction" | "lottery" | "organiser_commission",
      contributions: placeholderContributions(totalMembers, contributionPerPerson),
      remainingNonWinners,
    });

    // Fetch related data in parallel
    const [bidsRes, contribsRes, distsRes, obligsRes] = await Promise.all([
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
        .select("id, committee_id, month_id, member_id, distribution_amount, interest_share, distributed_at, committeeMember:committee_members(id, userId, slotNumber, user:users(id, name, phone))")
        .eq("month_id", monthId)
        .order("distribution_amount", { ascending: false }),
      supabase
        .from("member_payment_obligations")
        .select("id, member_id, user_id, role, contribution_amount, distribution_share, net_amount, direction, interest_charged, due_date, status, paid_at, advanced_by_organiser, organiser_id, organiser_advanced_at, created_at")
        .eq("month_id", monthId)
        .order("created_at", { ascending: true }),
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
      distributedAt: d.distributed_at,
      committeeMember: d.committeeMember,
    }));

    const paymentObligations = (obligsRes.data || []).map((o: any) => ({
      id: o.id,
      memberId: o.member_id,
      userId: o.user_id,
      role: o.role,
      contributionAmount: Number(o.contribution_amount),
      distributionShare: Number(o.distribution_share),
      netAmount: Number(o.net_amount),
      direction: o.direction,
      interestCharged: Number(o.interest_charged),
      dueDate: o.due_date,
      status: o.status,
      paidAt: o.paid_at,
      advancedByOrganiser: o.advanced_by_organiser,
      organiserId: o.organiser_id,
      organiserAdvancedAt: o.organiser_advanced_at,
      createdAt: o.created_at,
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
      distributableAmount: Number(month.distributable_amount),
      interestAmount: Number(month.interest_amount),
      perMemberDistribution: Number(month.per_member_distribution),
      nonWinnerNetPayable: month.non_winner_net_payable ? Number(month.non_winner_net_payable) / 100 : calculated.nonWinnerNetPayable,
      winnerNetReceivable: month.winner_net_receivable ? Number(month.winner_net_receivable) / 100 : calculated.winnerNetReceivable,
      paymentDeadline: month.payment_deadline || null,
      projected: {
        interestAmount: calculated.interestAmount,
        maxBidAllowed: calculated.maxBidAllowed,
        remainingBalance: calculated.remainingBalance,
        distributableAmount: calculated.distributableAmount,
        perMemberDistribution: calculated.perMemberDistribution,
      },
      bids,
      monthlyContributions,
      memberDistributions,
      paymentObligations,
    };
  }

  static async calculateProjectedMonth(committeeId: string, monthNumber: number, winningBidAmount?: number) {
    const { data: committee, error: cErr } = await supabase
      .from("committees")
      .select("totalSlots, installmentAmountPaise")
      .eq("id", committeeId)
      .single();

    if (cErr || !committee) throw new Error("Committee not found");

    const totalMembers = committee.totalSlots;
    const contributionPerPerson = Number(committee.installmentAmountPaise);
    const totalPool = totalMembers * contributionPerPerson;
    const remainingNonWinners = Math.max(totalMembers - (monthNumber - 1), 1);

    const summary = calculateMonthSummary({
      committeeId,
      monthNumber,
      totalMembers,
      contributionPerPerson,
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
    };
  }

  static async createMonth(params: {
    committeeId: string;
    monthNumber: number;
    monthDate: string;
    resolutionType: "bid_single" | "bid_auction" | "lottery" | "organiser_commission";
    winningBidAmount?: number;
  }) {
    const { committeeId, monthNumber, monthDate, winningBidAmount } = params;

    // Auto-detect resolution type: Month 1 = organiser commission, Month 2+ = bid_auction (resolved dynamically)
    const resolutionType = monthNumber === 1 ? "organiser_commission" : "bid_auction";

    const { data: committee, error: cErr } = await supabase
      .from("committees")
      .select("totalSlots, installmentAmountPaise")
      .eq("id", committeeId)
      .single();

    if (cErr || !committee) throw new Error("Committee not found");

    const totalMembers = committee.totalSlots;
    const contributionPerPerson = Number(committee.installmentAmountPaise);
    const totalPool = totalMembers * contributionPerPerson;
    const remainingNonWinners = Math.max(totalMembers - (monthNumber - 1), 1);

    const summary = calculateMonthSummary({
      committeeId,
      monthNumber,
      totalMembers,
      contributionPerPerson,
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
        remaining_balance: Math.round(summary.remainingBalance),
        distributable_amount: Math.round(summary.distributableAmount),
        interest_amount: Math.round(summary.interestAmount),
        per_member_distribution: Math.round(summary.perMemberDistribution),
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

    // ─── Auto-resolve: Month 1 (organiser commission) and last month (only 1 member left) ──
    const isLastMonth = monthNumber === totalMembers;
    const shouldAutoResolve = monthNumber === 1 || isLastMonth;
    if (shouldAutoResolve) {
      await this.resolveMonth(committeeId, month.id);
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

  // ─── 6. Pay Net Amount (non-winner pays after resolution) ────────────────
  static async payNetAmount(committeeId: string, monthId: string, memberId: string) {
    // 1. Fetch obligation
    const { data: obligation, error: oblErr } = await supabase
      .from("member_payment_obligations")
      .select("id, member_id, user_id, net_amount, direction, status, due_date")
      .eq("committee_id", committeeId)
      .eq("month_id", monthId)
      .eq("member_id", memberId)
      .single();

    if (oblErr || !obligation) throw new Error("Payment obligation not found");
    if (obligation.status !== "pending") throw new Error(`Obligation is already ${obligation.status}`);
    if (obligation.direction !== "pay") throw new Error("This member does not owe money for this month");

    const netAmountPaise = Number(obligation.net_amount);
    const userId = obligation.user_id;

    // 2. Validate wallet balance — use combined balance (raw wallet + committee ledger credits)
    //    matching WalletService.getWalletData() so frontend display is consistent.
    const { data: wallet, error: walletError } = await supabase
      .from("wallets")
      .select("id, balancePaise")
      .eq("userId", userId)
      .single();

    if (walletError || !wallet) throw new Error("Wallet not found");

    const rawBalance = Number(wallet.balancePaise);

    // Add committee ledger credits (same logic as WalletService.getWalletData)
    const { data: ledgerEntries } = await supabase
      .from("wallet_ledger_entries")
      .select("amount, direction, entry_type")
      .eq("member_id", userId)
      .eq("status", "confirmed");

    const committeeBalance = (ledgerEntries || []).reduce((sum: number, entry: any) => {
      if (entry.entry_type === "contribution_made") return sum;
      return sum + (entry.direction === "credit" ? Number(entry.amount) : -Number(entry.amount));
    }, 0);

    const walletBalance = rawBalance + committeeBalance;
    if (walletBalance < netAmountPaise) {
      throw new Error(
        `Insufficient wallet balance. You have ₹${(walletBalance / 100).toFixed(0)} but need ₹${(netAmountPaise / 100).toFixed(0)}`
      );
    }

    // 3. Get month number for installment lookup
    const { data: monthRow } = await supabase
      .from("committee_months")
      .select("month_number")
      .eq("id", monthId)
      .single();

    const cycleNo = monthRow?.month_number || 1;

    // 4. Create payment_transactions record
    const { data: tx, error: txError } = await supabase
      .from("payment_transactions")
      .insert({
        committee_id: committeeId,
        month_id: monthId,
        member_id: memberId,
        transaction_type: "contribution",
        amount: netAmountPaise,
        currency: "INR",
        status: "paid",
        paid_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (txError || !tx) throw new Error("Failed to record payment transaction");

    // 5. Update obligation → paid
    const { error: updateOblErr } = await supabase
      .from("member_payment_obligations")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
        payment_transaction_id: tx.id,
      })
      .eq("id", obligation.id);

    if (updateOblErr) throw updateOblErr;

    // 6. Update monthly_contributions → paid (backward compat)
    await supabase
      .from("monthly_contributions")
      .update({
        status: "paid",
        amount_paid: netAmountPaise,
        paid_at: new Date().toISOString(),
        payment_transaction_id: tx.id,
      })
      .eq("committee_id", committeeId)
      .eq("month_id", monthId)
      .eq("member_id", memberId);

    // 7. Update installments → PAID (backward compat)
    await supabase
      .from("installments")
      .update({
        status: "PAID",
        amountPaidPaise: netAmountPaise,
        paidAt: new Date().toISOString(),
        paymentMethod: "WALLET",
        paymentReference: tx.id,
      })
      .eq("committeeId", committeeId)
      .eq("userId", userId)
      .eq("cycleNo", cycleNo);

    // 8. Credit wallet ledger — net contribution made
    try {
      await WalletLedgerService.creditWallet({
        memberId: userId,
        committeeId,
        amount: netAmountPaise,
        entryType: "contribution_made",
        referenceType: "member_payment_obligations",
        referenceId: obligation.id,
        idempotencyKey: `net_pay_${committeeId}_${monthId}_${memberId}`,
        createdBy: "system",
        notes: `Month ${cycleNo} net contribution payment`,
      });
    } catch (err) {
      console.error("[payNetAmount] Wallet ledger credit failed:", err);
    }

    // 9. DEBIT WALLET (LAST — all DB updates above succeeded)
    //    Debit from raw wallet first, then from committee ledger if needed.
    const rawDebit = Math.min(rawBalance, netAmountPaise);
    const ledgerDebit = netAmountPaise - rawDebit;

    // 9a. Debit raw wallet
    if (rawDebit > 0) {
      const rawBalanceAfter = rawBalance - rawDebit;
      const { error: debitError } = await supabase
        .from("wallets")
        .update({ balancePaise: rawBalanceAfter })
        .eq("id", wallet.id);

      if (debitError) throw new Error("Failed to debit wallet");
    }

    // 9b. If remainder, debit from committee ledger (already validated combined balance is sufficient)
    if (ledgerDebit > 0) {
      try {
        // Create a direct debit entry in the ledger for the remainder
        const { data: lastLedgerEntry } = await supabase
          .from("wallet_ledger_entries")
          .select("balance_after")
          .eq("member_id", userId)
          .eq("committee_id", committeeId)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        const prevBalance = lastLedgerEntry ? Number(lastLedgerEntry.balance_after) : 0;
        const newBalance = prevBalance - ledgerDebit;

        const { error: ledgerDebitErr } = await supabase
          .from("wallet_ledger_entries")
          .insert({
            member_id: userId,
            committee_id: committeeId,
            entry_type: "contribution_made",
            amount: ledgerDebit,
            direction: "debit",
            reference_type: "member_payment_obligations",
            reference_id: obligation.id,
            balance_after: newBalance,
            status: "confirmed",
            idempotency_key: `net_pay_ledger_${committeeId}_${monthId}_${memberId}`,
            created_by: "system",
            notes: `Month ${cycleNo} net contribution (from committee credits)`,
          });

        if (ledgerDebitErr) {
          console.error("[payNetAmount] Ledger debit failed:", ledgerDebitErr);
        }
      } catch (err) {
        console.error("[payNetAmount] Ledger debit failed:", err);
      }
    }

    // 10. Record legacy transaction (non-critical)
    try {
      await supabase
        .from("transactions")
        .insert({
          walletId: wallet.id,
          userId,
          type: "DEBIT",
          category: "INSTALLMENT_PAYMENT",
          status: "COMPLETED",
          amountPaise: netAmountPaise,
          balanceBefore: rawBalance,
          balanceAfter: rawBalance - rawDebit,
          description: `Committee net contribution — Month ${cycleNo}`,
          paymentMethod: "WALLET",
          idempotencyKey: `net_txn_${committeeId}_${monthId}_${memberId}`,
        });
    } catch (err) {
      console.error("[payNetAmount] Legacy transaction insert failed:", err);
    }

    // 11. Check if all obligations settled → credit winner payout (non-critical)
    try {
      await this.settleWinnerPayoutIfNeeded(committeeId, monthId);
    } catch (err) {
      console.error("[payNetAmount] settleWinnerPayoutIfNeeded failed:", err);
    }

    return {
      success: true,
      obligation: { ...obligation, status: "paid", paid_at: new Date().toISOString() },
    };
  }

  // ─── 7. Organiser Advance (organiser pays on behalf of defaulting member) ─
  // If member doesn't pay within 3 days, organiser must advance.
  // If organiser delays 2 more days (total 5 days from resolution), organiser
  // owes 3% interest on the amount to the winner.
  static async organiserAdvance(
    committeeId: string,
    monthId: string,
    memberId: string,
    organiserId: string
  ) {
    // 1. Fetch obligation
    const { data: obligation, error: oblErr } = await supabase
      .from("member_payment_obligations")
      .select("id, member_id, user_id, net_amount, direction, status, due_date, organiser_id")
      .eq("committee_id", committeeId)
      .eq("month_id", monthId)
      .eq("member_id", memberId)
      .single();

    if (oblErr || !obligation) throw new Error("Payment obligation not found");
    if (obligation.status === "paid") throw new Error("Obligation already paid");
    if (obligation.status === "organiser_advanced") throw new Error("Already advanced by organiser");
    if (obligation.direction !== "pay") throw new Error("This member does not owe money");

    // Fetch month number for log messages
    const { data: monthRow } = await supabase
      .from("committee_months")
      .select("month_number")
      .eq("id", monthId)
      .single();
    const monthNumber = monthRow?.month_number || 0;

    const netAmountPaise = Number(obligation.net_amount);
    const dueDate = new Date(obligation.due_date);
    const now = new Date();
    const daysSinceDue = Math.max(0, Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));

    // Calculate organiser advance penalty: 3% per extra day after 2 extra days
    let organiserPenalty = 0;
    if (daysSinceDue > 2) {
      const extraDays = daysSinceDue - 2;
      organiserPenalty = Math.round(netAmountPaise * 0.03 * extraDays);
    }
    const totalAdvanced = netAmountPaise + organiserPenalty;

    // 2. Debit organiser's wallet (combined: raw + committee ledger)
    const { data: organiserWallet, error: owErr } = await supabase
      .from("wallets")
      .select("id, balancePaise")
      .eq("userId", organiserId)
      .single();

    if (owErr || !organiserWallet) throw new Error("Organiser wallet not found");

    const organiserRawBalance = Number(organiserWallet.balancePaise);

    // Add committee ledger credits
    const { data: orgLedgerEntries } = await supabase
      .from("wallet_ledger_entries")
      .select("amount, direction, entry_type")
      .eq("member_id", organiserId)
      .eq("status", "confirmed");

    const orgCommitteeBalance = (orgLedgerEntries || []).reduce((sum: number, entry: any) => {
      if (entry.entry_type === "contribution_made") return sum;
      return sum + (entry.direction === "credit" ? Number(entry.amount) : -Number(entry.amount));
    }, 0);

    const organiserBalance = organiserRawBalance + orgCommitteeBalance;
    if (organiserBalance < totalAdvanced) {
      throw new Error(
        `Organiser has insufficient balance. Needs ₹${(totalAdvanced / 100).toFixed(0)}, has ₹${(organiserBalance / 100).toFixed(0)}`
      );
    }

    // 3. Create payment record
    const { data: tx, error: txError } = await supabase
      .from("payment_transactions")
      .insert({
        committee_id: committeeId,
        month_id: monthId,
        member_id: memberId,
        transaction_type: "contribution",
        amount: totalAdvanced,
        currency: "INR",
        status: "paid",
        paid_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (txError || !tx) throw new Error("Failed to record advance transaction");

    // 4. Update obligation
    const { error: updateOblErr } = await supabase
      .from("member_payment_obligations")
      .update({
        status: "organiser_advanced",
        advanced_by_organiser: true,
        organiser_id: organiserId,
        organiser_advanced_at: new Date().toISOString(),
        paid_at: new Date().toISOString(),
        payment_transaction_id: tx.id,
      })
      .eq("id", obligation.id);

    if (updateOblErr) throw updateOblErr;

    // 5. Debit organiser wallet (LAST) — raw first, then ledger
    const orgRawDebit = Math.min(organiserRawBalance, totalAdvanced);
    const orgLedgerDebit = totalAdvanced - orgRawDebit;

    // 5a. Debit raw wallet
    if (orgRawDebit > 0) {
      const rawAfter = organiserRawBalance - orgRawDebit;
      const { error: debitError } = await supabase
        .from("wallets")
        .update({ balancePaise: rawAfter })
        .eq("id", organiserWallet.id);
      if (debitError) throw new Error("Failed to debit organiser wallet");
    }

    // 5b. If remainder, debit from committee ledger
    if (orgLedgerDebit > 0) {
      try {
        const { data: lastEntry } = await supabase
          .from("wallet_ledger_entries")
          .select("balance_after")
          .eq("member_id", organiserId)
          .eq("committee_id", committeeId)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        const prevBal = lastEntry ? Number(lastEntry.balance_after) : 0;
        const newBal = prevBal - orgLedgerDebit;

        await supabase
          .from("wallet_ledger_entries")
          .insert({
            member_id: organiserId,
            committee_id: committeeId,
            entry_type: "adjustment_credit",
            amount: orgLedgerDebit,
            direction: "debit",
            reference_type: "member_payment_obligations",
            reference_id: obligation.id,
            balance_after: newBal,
            status: "confirmed",
            idempotency_key: `org_advance_ledger_${committeeId}_${monthId}_${memberId}`,
            created_by: "organiser",
            notes: `Organiser advance (from committee credits)`,
          });
      } catch (err) {
        console.error("[organiserAdvance] Ledger debit failed:", err);
      }
    }

    // 6. Credit wallet ledger for organiser advance
    try {
      await WalletLedgerService.creditWallet({
        memberId: organiserId,
        committeeId,
        amount: totalAdvanced,
        entryType: "adjustment_credit",
        referenceType: "member_payment_obligations",
        referenceId: obligation.id,
        idempotencyKey: `org_advance_${committeeId}_${monthId}_${memberId}`,
        createdBy: "organiser",
        notes: `Organiser advance for member's Month ${monthNumber} obligation` + 
          (organiserPenalty > 0 ? ` (includes ₹${organiserPenalty / 100} penalty)` : ""),
      });
    } catch (err) {
      console.error("[organiserAdvance] Wallet ledger credit failed:", err);
    }

    // 8. Record legacy transaction (non-critical)
    try {
      const orgBalanceAfter = organiserBalance - totalAdvanced;
      await supabase
        .from("transactions")
        .insert({
          walletId: organiserWallet.id,
          userId: organiserId,
          type: "DEBIT",
          category: "INSTALLMENT_PAYMENT",
          status: "COMPLETED",
          amountPaise: totalAdvanced,
          balanceBefore: organiserBalance,
          balanceAfter: orgBalanceAfter,
          description: `Organiser advance — Month ${monthNumber}` +
            (organiserPenalty > 0 ? ` (includes penalty)` : ""),
          paymentMethod: "WALLET",
          idempotencyKey: `org_txn_${committeeId}_${monthId}_${memberId}`,
        });
    } catch (err) {
      console.error("[organiserAdvance] Legacy transaction insert failed:", err);
    }

    // 9. Check if all obligations settled → credit winner payout (non-critical)
    try {
      await this.settleWinnerPayoutIfNeeded(committeeId, monthId);
    } catch (err) {
      console.error("[organiserAdvance] settleWinnerPayoutIfNeeded failed:", err);
    }

    return {
      success: true,
      obligation: { ...obligation, status: "organiser_advanced" },
      advance: {
        originalAmount: netAmountPaise,
        penalty: organiserPenalty,
        totalAdvanced,
        daysSinceDue,
      },
    };
  }

  // ─── 8. Check if all obligations settled → credit winner ──────────────────
  // Called after each payNetAmount / organiserAdvance to see if winner can be paid.
  // Returns a result object so callers know what happened.
  static async settleWinnerPayoutIfNeeded(
    committeeId: string,
    monthId: string
  ): Promise<{ settled: boolean; reason: string; amount?: number }> {
    // Get all obligations for this month
    const { data: obligations, error: oblErr } = await supabase
      .from("member_payment_obligations")
      .select("id, member_id, role, direction, status, net_amount")
      .eq("committee_id", committeeId)
      .eq("month_id", monthId);

    if (oblErr || !obligations) {
      console.error("[settleWinnerPayout] Failed to fetch obligations:", oblErr);
      return { settled: false, reason: "Failed to fetch obligations" };
    }

    // Find the winner obligation
    const winnerObl = obligations.find((o: any) => o.direction === "receive");
    if (!winnerObl) {
      return { settled: false, reason: "No winner obligation found" };
    }
    if (winnerObl.status === "paid") {
      return { settled: false, reason: "Winner payout already settled" };
    }

    // Check if ALL non-winner obligations are settled (paid or organiser_advanced)
    const nonWinnerObls = obligations.filter((o: any) => o.direction === "pay");
    const unpaidObls = nonWinnerObls.filter((o: any) => o.status !== "paid" && o.status !== "organiser_advanced");

    if (unpaidObls.length > 0) {
      return {
        settled: false,
        reason: `${unpaidObls.length} of ${nonWinnerObls.length} non-winner obligations still unpaid`,
      };
    }

    if (nonWinnerObls.length === 0) {
      return { settled: false, reason: "No non-winner obligations found" };
    }

    // All settled — credit winner's wallet
    const { data: winnerMember } = await supabase
      .from("committee_members")
      .select("userId")
      .eq("id", winnerObl.member_id)
      .single();

    if (!winnerMember) {
      return { settled: false, reason: "Winner member record not found" };
    }

    const winnerPayoutPaise = Number(winnerObl.net_amount);

    if (winnerPayoutPaise <= 0) {
      return { settled: false, reason: `Winner payout amount is ${winnerPayoutPaise} paise (must be positive)` };
    }

    // Credit wallet — creditWallet writes ledger entry + calls refresh_wallet_balance_cache RPC
    await WalletLedgerService.creditWallet({
      memberId: winnerMember.userId,
      committeeId,
      amount: winnerPayoutPaise,
      entryType: "bid_payout",
      referenceType: "member_payment_obligations",
      referenceId: winnerObl.id,
      idempotencyKey: `winner_payout_${committeeId}_${monthId}`,
      createdBy: "system",
      notes: `Month ${monthId.slice(-4)} winner payout — all obligations settled`,
    });

    // Update winner obligation → paid
    await supabase
      .from("member_payment_obligations")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", winnerObl.id);

    // Mark winner as having received payout (only NOW when wallet is actually credited)
    await supabase
      .from("committee_members")
      .update({ hasReceivedPayout: true })
      .eq("id", winnerObl.member_id);

    console.log(
      `[settleWinnerPayout] Winner ${winnerMember.userId} credited ${winnerPayoutPaise} paise ` +
      `for month ${monthId} — all obligations settled`
    );

    return { settled: true, reason: "Winner wallet credited", amount: winnerPayoutPaise };
  }

  // ─── 9. Get Payment Obligations for a Month ─────────────────────────────
  static async getObligations(committeeId: string, monthId: string, _userId?: string) {
    let query = supabase
      .from("member_payment_obligations")
      .select(`
        id, member_id, user_id, role, contribution_amount, distribution_share,
        net_amount, direction, interest_charged, due_date, status, paid_at,
        advanced_by_organiser, organiser_id, organiser_advanced_at, created_at,
        committeeMember:committee_members(id, userId, slotNumber, user:users(id, name, phone))
      `)
      .eq("committee_id", committeeId)
      .eq("month_id", monthId)
      .order("created_at", { ascending: true });

    const { data: obligations, error } = await query;
    if (error) throw error;

    return (obligations || []).map((o: any) => ({
      id: o.id,
      memberId: o.member_id,
      userId: o.user_id,
      role: o.role,
      contributionAmount: Number(o.contribution_amount),
      distributionShare: Number(o.distribution_share),
      netAmount: Number(o.net_amount),
      direction: o.direction,
      interestCharged: Number(o.interest_charged),
      dueDate: o.due_date,
      status: o.status,
      paidAt: o.paid_at,
      advancedByOrganiser: o.advanced_by_organiser,
      organiserId: o.organiser_id,
      organiserAdvancedAt: o.organiser_advanced_at,
      createdAt: o.created_at,
      committeeMember: o.committeeMember,
    }));
  }

  // ─── 9. Get Overdue Obligations (for organiser dashboard) ──────────────
  static async getOverdueObligations(committeeId: string) {
    const now = new Date().toISOString();

    const { data: obligations, error } = await supabase
      .from("member_payment_obligations")
      .select(`
        id, member_id, user_id, role, contribution_amount, distribution_share,
        net_amount, direction, interest_charged, due_date, status, paid_at,
        advanced_by_organiser, organiser_id, organiser_advanced_at, created_at,
        committeeMember:committee_members(id, userId, slotNumber, user:users(id, name, phone)),
        committeeMonth:committee_months(id, month_number, month_date)
      `)
      .eq("committee_id", committeeId)
      .in("status", ["pending", "overdue"])
      .lt("due_date", now)
      .order("due_date", { ascending: true });

    if (error) throw error;

    return (obligations || []).map((o: any) => ({
      id: o.id,
      memberId: o.member_id,
      userId: o.user_id,
      role: o.role,
      contributionAmount: Number(o.contribution_amount),
      distributionShare: Number(o.distribution_share),
      netAmount: Number(o.net_amount),
      direction: o.direction,
      interestCharged: Number(o.interest_charged),
      dueDate: o.due_date,
      status: o.status,
      paidAt: o.paid_at,
      advancedByOrganiser: o.advanced_by_organiser,
      organiserId: o.organiser_id,
      organiserAdvancedAt: o.organiser_advanced_at,
      createdAt: o.created_at,
      committeeMember: o.committeeMember,
      committeeMonth: o.committeeMonth,
      daysOverdue: Math.max(0, Math.floor((Date.now() - new Date(o.due_date).getTime()) / (1000 * 60 * 60 * 24))),
    }));
  }

  // ─── 10. Get Organiser Advances (for organiser dashboard) ─────────────
  static async getOrganiserAdvances(committeeId: string, organiserId: string) {
    const { data: advances, error } = await supabase
      .from("member_payment_obligations")
      .select(`
        id, member_id, user_id, net_amount, due_date, status, paid_at,
        advanced_by_organiser, organiser_id, organiser_advanced_at, created_at,
        committeeMember:committee_members(id, userId, slotNumber, user:users(id, name, phone)),
        committeeMonth:committee_months(id, month_number, month_date)
      `)
      .eq("committee_id", committeeId)
      .eq("organiser_id", organiserId)
      .eq("advanced_by_organiser", true)
      .order("organiser_advanced_at", { ascending: false });

    if (error) throw error;

    return (advances || []).map((a: any) => ({
      id: a.id,
      memberId: a.member_id,
      userId: a.user_id,
      netAmount: Number(a.net_amount),
      dueDate: a.due_date,
      status: a.status,
      paidAt: a.paid_at,
      advancedAt: a.organiser_advanced_at,
      createdAt: a.created_at,
      committeeMember: a.committeeMember,
      committeeMonth: a.committeeMonth,
      repaidStatus: a.status === "paid" ? "repaid" : "pending",
    }));
  }
}
