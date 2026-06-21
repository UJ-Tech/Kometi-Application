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

    // 4. Total Committees by Status
    const { data: committeesByStatus } = await supabase
      .from("committees")
      .select("status");

    const committeeStats = { DRAFT: 0, ACTIVE: 0, COMPLETED: 0, CANCELLED: 0 };
    (committeesByStatus || []).forEach((c: any) => {
      if (committeeStats.hasOwnProperty(c.status)) {
        committeeStats[c.status as keyof typeof committeeStats]++;
      }
    });

    // 5. Total Users by Role
    const { data: usersByRole } = await supabase
      .from("users")
      .select("role");

    const userStats: Record<string, number> = {};
    (usersByRole || []).forEach((u: any) => {
      userStats[u.role] = (userStats[u.role] || 0) + 1;
    });
    const totalUsersCount = (usersByRole || []).length;

    // 6. Total Installments by Status
    const { data: installmentsByStatus } = await supabase
      .from("installments")
      .select("status");

    const installmentStats: Record<string, number> = {};
    (installmentsByStatus || []).forEach((i: any) => {
      installmentStats[i.status] = (installmentStats[i.status] || 0) + 1;
    });

    // 7. Profit Overview & Monthly Analytics
    const { data: payoutCycles, error: payoutError } = await supabase
      .from("payout_cycles")
      .select("*, committee:committees(*)")
      .eq("isCompleted", true);

    if (payoutError) throw payoutError;

    let profitOverviewPaise = 0;
    (payoutCycles || []).forEach((cycle: any) => {
      const comm = cycle.committee;
      if (comm) {
        // No organiser fee in new engine — profit is 0
      }
    });

    // 8. Monthly Analytics (Last 6 months)
    const monthlyAnalyticsMap = new Map<string, { collection: number; profit: number }>();

    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const monthKey = d.toLocaleString("en-IN", { month: "short", year: "2-digit" });
      monthlyAnalyticsMap.set(monthKey, { collection: 0, profit: 0 });
    }

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

    (payoutCycles || []).forEach((cycle: any) => {
      const comm = cycle.committee;
      if (comm && cycle.payoutDate) {
        const date = new Date(cycle.payoutDate);
        const monthKey = date.toLocaleString("en-IN", { month: "short", year: "2-digit" });
        if (monthlyAnalyticsMap.has(monthKey)) {
          // No organiser fee in new engine — profit is 0
          const current = monthlyAnalyticsMap.get(monthKey)!;
          monthlyAnalyticsMap.set(monthKey, current);
        }
      }
    });

    const monthlyAnalytics = Array.from(monthlyAnalyticsMap.entries()).map(([month, data]) => ({
      month,
      collectionPaise: data.collection,
      profitPaise: data.profit,
    }));

    // 9. Recent Transactions (last 20)
    const { data: recentTransactions } = await supabase
      .from("transactions")
      .select("*, user:users(name, phone)")
      .order("createdAt", { ascending: false })
      .limit(20);

    // 10. All Committees (for admin overview)
    const { data: allCommittees } = await supabase
      .from("committees")
      .select("id, name, type, status, totalSlots, filledSlots, installmentAmountPaise, organizer:users!organizerId(name, phone)")
      .order("createdAt", { ascending: false });

    // 11. Wallets summary
    const { data: wallets } = await supabase
      .from("wallets")
      .select("id, userId, balancePaise, user:users(name, phone, role)")
      .order("balancePaise", { ascending: false });

    const totalWalletBalancePaise = (wallets || []).reduce(
      (sum, w) => sum + Number(w.balancePaise),
      0
    );

    return {
      totalCollectionPaise,
      pendingPaymentsPaise,
      activeCommitteesCount: activeCommitteesCount || 0,
      profitOverviewPaise,
      monthlyAnalytics,
      totalUsersCount,
      userStats,
      committeeStats,
      installmentStats,
      recentTransactions: recentTransactions || [],
      allCommittees: allCommittees || [],
      wallets: wallets || [],
      totalWalletBalancePaise,
    };
  }

  static async updateUserRole(userId: string, newRole: string) {
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
