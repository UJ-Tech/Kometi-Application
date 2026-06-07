// src/stores/committee.store.ts
import { create } from "zustand";
import type { Committee, CommitteeDetail, CommitteeStatus, CommitteeType, PaginationMeta } from "../types";
import { committeesApi } from "../services/committees.api";

interface CommitteeFilters {
  status?: CommitteeStatus;
  type?:   CommitteeType;
}

interface CommitteeState {
  committees:      Committee[];
  activeCommittee: CommitteeDetail | null;
  isLoading:       boolean;
  filters:         CommitteeFilters;
  pagination:      PaginationMeta;

  setCommittees:         (list: Committee[]) => void;
  appendCommittees:      (list: Committee[]) => void;
  setActiveCommittee:    (c: CommitteeDetail | null) => void;
  upsertCommittee:       (c: Committee) => void;
  updateCommitteeStatus: (id: string, status: CommitteeStatus) => void;
  setFilters:            (f: CommitteeFilters) => void;
  setPagination:         (meta: PaginationMeta) => void;
  setLoading:            (v: boolean) => void;
  fetchCommittees:       () => Promise<void>;
  reset:                 () => void;
}

const defaultPagination: PaginationMeta = {
  total: 0, page: 1, limit: 20, hasMore: false,
};

export const useCommitteeStore = create<CommitteeState>((set, get) => ({
  committees:      [],
  activeCommittee: null,
  isLoading:       false,
  filters:         {},
  pagination:      defaultPagination,

  setCommittees:      (list)  => set({ committees: list }),
  appendCommittees:   (list)  => set((s) => ({ committees: [...s.committees, ...list] })),
  setActiveCommittee: (c)     => set({ activeCommittee: c }),
  setFilters:         (f)     => set({ filters: f }),
  setPagination:      (meta)  => set({ pagination: meta }),
  setLoading:         (v)     => set({ isLoading: v }),

  upsertCommittee: (c) => {
    set((s) => {
      const idx = s.committees.findIndex((x) => x.id === c.id);
      if (idx >= 0) {
        const updated = [...s.committees];
        updated[idx] = c;
        return { committees: updated };
      }
      return { committees: [c, ...s.committees] };
    });
  },

  updateCommitteeStatus: (id, status) => {
    set((s) => ({
      committees: s.committees.map((c) =>
        c.id === id ? { ...c, status } : c
      ),
      activeCommittee:
        s.activeCommittee?.id === id
          ? { ...s.activeCommittee, status }
          : s.activeCommittee,
    }));
  },

  fetchCommittees: async () => {
    set({ isLoading: true });
    try {
      const res = await committeesApi.list();
      set({ committees: res.data.data });
    } catch (err) {
      console.error("[CommitteeStore] fetchCommittees failed:", err);
    } finally {
      set({ isLoading: false });
    }
  },

  reset: () => set({
    committees: [], activeCommittee: null,
    isLoading: false, filters: {}, pagination: defaultPagination,
  }),
}));
