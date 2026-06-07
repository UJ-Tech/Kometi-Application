// src/modules/admin/admin.service.ts
import supabase from "../../config/supabase";

export class AdminService {
  static async getDashboardStats() {
    // 1. Total Collection
    const { data: paidInstallments, error: paidError } = await supabase
      .from("installments")
      .select("amountPaidPaise")
      .eq("status", "PAID");

    if (paidError) throw paidError;
    const totalCollectionPaise = (paidInstallments || []).reduce(
      (sum, inst) => sum + Number(inst.amountPaidPaise),
      0
    );

    // 2. Pending Payments
    const { data: pendingInstallments, error: pendingError } = await supabase
      .from("installments")
      .select("amountDuePaise, penaltyPaise")
      .in("status", ["PENDING", "OVERDUE", "PARTIAL"]);

    if (pendingError) throw pendingError;
    const pendingPaymentsPaise = (pendingInstallments || []).reduce(
      (sum, inst) => sum + Number(inst.amountDuePaise) + Number(inst.penaltyPaise),
      0
    );

    // 3. Active Committees
    const { count: activeCommitteesCount, error: activeError } = await supabase
      .from("committees")
      .select("*", { count: "exact", head: true })
      .eq("status", "ACTIVE");

    if (activeError) throw activeError;

    // 4. Profit Overview & Monthly Analytics
    // Fetch completed payout cycles and their committees to calculate commission profit
    const { data: payoutCycles, error: payoutError } = await supabase
      .from("payout_cycles")
      .select("*, committee:committees(*)")
      .eq("isCompleted", true);

    if (payoutError) throw payoutError;

    let profitOverviewPaise = 0;
    (payoutCycles || []).forEach((cycle: any) => {
      const comm = cycle.committee;
      if (comm) {
        const totalPot = Number(comm.installmentAmountPaise) * comm.totalSlots;
        const commRate = Number(comm.commissionRatePct || 5.0);
        const commission = (totalPot * commRate) / 100;
        profitOverviewPaise += commission;
      }
    });

    // 5. Monthly Analytics (Last 6 months)
    const monthlyAnalyticsMap = new Map<string, { collection: number; profit: number }>();

    // Initialise last 6 months
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const monthKey = d.toLocaleString("en-IN", { month: "short", year: "2-digit" }); // e.g. "May-26"
      monthlyAnalyticsMap.set(monthKey, { collection: 0, profit: 0 });
    }

    // Populate Collections by Month
    const { data: allPaidInstallments, error: allPaidErr } = await supabase
      .from("installments")
      .select("amountPaidPaise, paidAt")
      .eq("status", "PAID")
      .not("paidAt", "is", null);

    if (!allPaidErr && allPaidInstallments) {
      allPaidInstallments.forEach((inst) => {
        const date = new Date(inst.paidAt!);
        const monthKey = date.toLocaleString("en-IN", { month: "short", year: "2-digit" });
        if (monthlyAnalyticsMap.has(monthKey)) {
          const current = monthlyAnalyticsMap.get(monthKey)!;
          current.collection += Number(inst.amountPaidPaise);
          monthlyAnalyticsMap.set(monthKey, current);
        }
      });
    }

    // Populate Profits by Month
    (payoutCycles || []).forEach((cycle: any) => {
      const comm = cycle.committee;
      if (comm && cycle.payoutDate) {
        const date = new Date(cycle.payoutDate);
        const monthKey = date.toLocaleString("en-IN", { month: "short", year: "2-digit" });
        if (monthlyAnalyticsMap.has(monthKey)) {
          const totalPot = Number(comm.installmentAmountPaise) * comm.totalSlots;
          const commRate = Number(comm.commissionRatePct || 5.0);
          const commission = (totalPot * commRate) / 100;

          const current = monthlyAnalyticsMap.get(monthKey)!;
          current.profit += commission;
          monthlyAnalyticsMap.set(monthKey, current);
        }
      }
    });

    const monthlyAnalytics = Array.from(monthlyAnalyticsMap.entries()).map(([month, data]) => ({
      month,
      collectionPaise: data.collection,
      profitPaise: data.profit,
    }));

    return {
      totalCollectionPaise,
      pendingPaymentsPaise,
      activeCommitteesCount: activeCommitteesCount || 0,
      profitOverviewPaise,
      monthlyAnalytics,
    };
  }

  static async updateUserRole(userId: string, newRole: string) {
    // Validate role
    const validRoles = ["ADMIN", "MANAGER", "ACCOUNTANT", "AGENT", "ORGANIZER", "MEMBER"];
    if (!validRoles.includes(newRole)) {
      throw new Error(`Invalid user role: ${newRole}`);
    }

    const { data: user, error } = await supabase
      .from("users")
      .update({ role: newRole })
      .eq("id", userId)
      .select("id, name, phone, role")
      .single();

    if (error || !user) {
      throw new Error("Failed to update user role");
    }

    return user;
  }
}
