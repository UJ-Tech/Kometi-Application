// src/stores/member.store.ts
import { create } from "zustand";
import type { User, KYCDocument, PaginationMeta } from "../types";
import { membersApi } from "../services/members.api";

interface MemberState {
  members:        User[];
  selectedMember: User | null;
  kycDoc:         KYCDocument | null;
  isLoading:      boolean;
  searchQuery:    string;
  pagination:     PaginationMeta;

  setMembers:       (members: User[]) => void;
  appendMembers:    (members: User[]) => void;
  setSelected:      (member: User | null) => void;
  setKYCDoc:        (doc: KYCDocument | null) => void;
  upsertMember:     (member: User) => void;
  removeMember:     (id: string) => void;
  setSearchQuery:   (q: string) => void;
  setPagination:    (meta: PaginationMeta) => void;
  setLoading:       (v: boolean) => void;
  fetchMembers:     () => Promise<void>;
  reset:            () => void;
}

const defaultPagination: PaginationMeta = {
  total: 0, page: 1, limit: 20, hasMore: false,
};

export const useMemberStore = create<MemberState>((set, get) => ({
  members:        [],
  selectedMember: null,
  kycDoc:         null,
  isLoading:      false,
  searchQuery:    "",
  pagination:     defaultPagination,

  setMembers:     (members)  => set({ members }),
  appendMembers:  (members)  => set((s) => ({ members: [...s.members, ...members] })),
  setSelected:    (member)   => set({ selectedMember: member }),
  setKYCDoc:      (doc)      => set({ kycDoc: doc }),
  setSearchQuery: (q)        => set({ searchQuery: q }),
  setPagination:  (meta)     => set({ pagination: meta }),
  setLoading:     (v)        => set({ isLoading: v }),

  upsertMember: (member) => {
    set((s) => {
      const idx = s.members.findIndex((m) => m.id === member.id);
      if (idx >= 0) {
        const updated = [...s.members];
        updated[idx] = member;
        return { members: updated };
      }
      return { members: [member, ...s.members] };
    });
  },

  removeMember: (id) => {
    set((s) => ({ members: s.members.filter((m) => m.id !== id) }));
  },

  fetchMembers: async () => {
    set({ isLoading: true });
    try {
      const q = get().searchQuery;
      const res = await membersApi.list({ search: q || undefined });
      set({ members: res.data.data });
    } catch (err) {
      console.error("[MemberStore] fetchMembers failed:", err);
    } finally {
      set({ isLoading: false });
    }
  },

  reset: () => set({
    members: [], selectedMember: null, kycDoc: null,
    isLoading: false, searchQuery: "", pagination: defaultPagination,
  }),
}));
