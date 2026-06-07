// src/stores/installment.store.ts
import { create } from "zustand";
import type { Installment, InstallmentStatus, PaymentMethod, PaginationMeta } from "../types";
import { installmentsApi } from "../services/installments.api";

interface InstallmentState {
  dueToday:       Installment[];
  overdue:        Installment[];
  collected:      Installment[];
  upcomingDues:   Installment[];
  selectedInst:   Installment | null;
  isCollecting:   boolean;
  isLoading:      boolean;
  pagination:     PaginationMeta;

  setDueToday:    (list: Installment[]) => void;
  setOverdue:     (list: Installment[]) => void;
  setCollected:   (list: Installment[]) => void;
  appendCollected:(list: Installment[]) => void;
  setSelected:    (inst: Installment | null) => void;
  setCollecting:  (v: boolean) => void;
  setLoading:     (v: boolean) => void;
  setPagination:  (meta: PaginationMeta) => void;
  markPaid:       (id: string) => void;
  fetchUpcomingDues: () => Promise<void>;
  payInstallment: (id: string, method: PaymentMethod) => Promise<void>;
  reset:          () => void;
}

const defaultPagination: PaginationMeta = {
  total: 0, page: 1, limit: 20, hasMore: false,
};

export const useInstallmentStore = create<InstallmentState>((set, get) => ({
  dueToday:     [],
  overdue:      [],
  collected:    [],
  upcomingDues: [],
  selectedInst: null,
  isCollecting: false,
  isLoading:    false,
  pagination:   defaultPagination,

  setDueToday:    (list) => set({ dueToday: list }),
  setOverdue:     (list) => set({ overdue: list }),
  setCollected:   (list) => set({ collected: list }),
  appendCollected:(list) => set((s) => ({ collected: [...s.collected, ...list] })),
  setSelected:    (inst) => set({ selectedInst: inst }),
  setCollecting:  (v)    => set({ isCollecting: v }),
  setLoading:     (v)    => set({ isLoading: v }),
  setPagination:  (meta) => set({ pagination: meta }),

  markPaid: (id) => {
    const updateStatus = (list: Installment[]) =>
      list.map((i) => i.id === id ? { ...i, status: "PAID" as InstallmentStatus } : i);
    set((s) => ({
      dueToday:    updateStatus(s.dueToday),
      overdue:     updateStatus(s.overdue),
      upcomingDues: updateStatus(s.upcomingDues),
      collected:   s.collected.some((i) => i.id === id)
        ? updateStatus(s.collected)
        : [...s.collected],
    }));
  },

  fetchUpcomingDues: async () => {
    set({ isLoading: true });
    try {
      const res = await installmentsApi.list({ status: "PENDING" });
      set({ upcomingDues: res.data.data });
    } catch (err) {
      console.error("[InstallmentStore] fetchUpcomingDues failed:", err);
    } finally {
      set({ isLoading: false });
    }
  },

  payInstallment: async (id, method) => {
    set({ isCollecting: true });
    try {
      await installmentsApi.collect(id, {
        amountPaidPaise: 0, // Server calculates based on installment dues
        paymentMethod: method,
      });
      get().markPaid(id);
    } catch (err) {
      console.error("[InstallmentStore] payInstallment failed:", err);
      throw err;
    } finally {
      set({ isCollecting: false });
    }
  },

  reset: () => set({
    dueToday: [], overdue: [], collected: [], upcomingDues: [],
    selectedInst: null, isCollecting: false, isLoading: false,
    pagination: defaultPagination,
  }),
}));
