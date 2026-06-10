// src/utils/rbac.ts
// Role-Based Access Control helpers

import type { UserRole } from "../types";

export function canAccessAdminPanel(role?: UserRole): boolean {
  return role === "ADMIN";
}

export function canAccessOrganizerDashboard(role?: UserRole): boolean {
  return role === "ORGANIZER";
}

export function canCreateCommittee(role?: UserRole): boolean {
  return role === "ORGANIZER";
}

export function canViewMembers(role?: UserRole, hasCommittee?: boolean): boolean {
  if (!role) return false;
  if (role === "ADMIN") return true;
  if (role === "ORGANIZER") return !!hasCommittee;
  return false;
}

export function canVerifyKYC(role?: UserRole): boolean {
  return !!role && ["ADMIN", "ORGANIZER"].includes(role);
}
