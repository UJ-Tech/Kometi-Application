// src/utils/rbac.ts
// No role-based access control — committee access is based on ownership/membership.

export function canViewMembers(hasCommittee?: boolean): boolean {
  return !!hasCommittee;
}

// Stub — admin panel is no longer role-gated
export function canAccessAdminPanel(_role?: string): boolean {
  return false;
}
