// src/jobs/overdue-check.ts
// Daily scheduled job: marks payment obligations as 'overdue' when past their dueDate,
// then auto-advances and blocks members after 5 days.

import supabase from "../config/supabase";
import { CommitteeMonthsService } from "../modules/committeeMonths/committeeMonths.service";

const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const BLOCKING_THRESHOLD_DAYS = 5; // Auto-advance + block after 5 days

interface OverdueCheckResult {
  scanned: number;
  markedOverdue: number;
  autoAdvanced: number;
  blocked: number;
  errors: string[];
}

/**
 * Mark overdue obligations, auto-advance, and block members.
 */
export async function runOverdueCheck(): Promise<OverdueCheckResult> {
  const now = new Date();
  const errors: string[] = [];
  let markedOverdue = 0;
  let autoAdvanced = 0;
  let blocked = 0;

  // Step 1: Find all pending obligations past their due date
  const { data: overdueObligations, error: fetchError } = await supabase
    .from("member_payment_obligations")
    .select("id, committee_id, month_id, member_id, user_id, net_amount, due_date")
    .eq("status", "pending")
    .lt("due_date", now.toISOString());

  if (fetchError) {
    console.error("[overdue-check] Failed to fetch obligations:", fetchError.message);
    return { scanned: 0, markedOverdue: 0, autoAdvanced: 0, blocked: 0, errors: [fetchError.message] };
  }

  const obligations = overdueObligations || [];
  if (obligations.length === 0) {
    return { scanned: 0, markedOverdue: 0, autoAdvanced: 0, blocked: 0, errors: [] };
  }

  // Step 2: Mark each obligation as overdue and check for blocking
  for (const obl of obligations) {
    try {
      // Mark as overdue
      const { error: updateError } = await supabase
        .from("member_payment_obligations")
        .update({ status: "overdue" })
        .eq("id", obl.id)
        .eq("status", "pending");

      if (updateError) {
        const msg = `Failed to mark obligation ${obl.id}: ${updateError.message}`;
        console.error("[overdue-check]", msg);
        errors.push(msg);
        continue;
      }
      markedOverdue++;

      // Check days since resolution (use created_at as proxy for resolution time)
      const { data: monthData } = await supabase
        .from("committee_months")
        .select("created_at")
        .eq("id", obl.month_id)
        .single();

      const resolvedAt = monthData?.created_at ? new Date(monthData.created_at) : new Date(obl.due_date);
      const daysSinceResolution = Math.floor((now.getTime() - resolvedAt.getTime()) / (1000 * 60 * 60 * 24));

      // Step 3: Auto-advance and block after threshold
      if (daysSinceResolution >= BLOCKING_THRESHOLD_DAYS) {
        // Check if already advanced
        const { data: currentObl } = await supabase
          .from("member_payment_obligations")
          .select("status, advanced_by_organiser")
          .eq("id", obl.id)
          .single();

        if (currentObl && currentObl.status !== "organiser_advanced" && !currentObl.advanced_by_organiser) {
          // Get organiser ID
          const { data: committee } = await supabase
            .from("committees")
            .select("organizerId")
            .eq("id", obl.committee_id)
            .single();

          if (committee) {
            try {
              // Auto-advance
              await CommitteeMonthsService.organiserAdvance(
                obl.committee_id,
                obl.month_id,
                obl.member_id,
                committee.organizerId
              );
              autoAdvanced++;
              console.log(
                `[overdue-check] Auto-advanced obligation ${obl.id} ` +
                `(member=${obl.member_id}, committee=${obl.committee_id})`
              );

              // Block member
              const { error: blockError } = await supabase
                .from("committee_members")
                .update({
                  is_blocked: true,
                  blocked_at: now.toISOString(),
                  blocked_reason: "Payment overdue - organiser auto-advanced after 5 days",
                })
                .eq("id", obl.member_id);

              if (blockError) {
                console.error(`[overdue-check] Failed to block member ${obl.member_id}:`, blockError.message);
                errors.push(`Failed to block member ${obl.member_id}: ${blockError.message}`);
              } else {
                blocked++;
                console.log(
                  `[overdue-check] Blocked member ${obl.member_id} ` +
                  `(committee=${obl.committee_id})`
                );
              }
            } catch (advanceErr: any) {
              console.error(`[overdue-check] Auto-advance failed for obligation ${obl.id}:`, advanceErr.message);
              errors.push(`Auto-advance failed for obligation ${obl.id}: ${advanceErr.message}`);
            }
          }
        }
      }
    } catch (err: any) {
      const msg = `Unexpected error processing obligation ${obl.id}: ${err.message}`;
      console.error("[overdue-check]", msg);
      errors.push(msg);
    }
  }

  console.log(
    `[overdue-check] Completed: scanned=${obligations.length}, ` +
    `overdue=${markedOverdue}, advanced=${autoAdvanced}, blocked=${blocked}, ` +
    `errors=${errors.length}`
  );

  return { scanned: obligations.length, markedOverdue, autoAdvanced, blocked, errors };
}

/**
 * Start the daily overdue check scheduler.
 * Runs immediately on startup, then every 24 hours.
 */
export function startOverdueCheckScheduler(): void {
  // Run immediately on startup
  runOverdueCheck().catch((err) => {
    console.error("[overdue-check] Initial run failed:", err);
  });

  // Then run every 24 hours
  setInterval(() => {
    runOverdueCheck().catch((err) => {
      console.error("[overdue-check] Scheduled run failed:", err);
    });
  }, CHECK_INTERVAL_MS);

  console.log("[overdue-check] Scheduler started (runs every 24 hours)");
}
