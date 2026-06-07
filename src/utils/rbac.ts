// src/utils/rbac.ts
// Role-Based Access Control helpers

import type { UserRole } from "../types";

export function canAccessAdminPanel(role?: UserRole): boolean {
  return !!role && ["ADMIN", "MANAGER", "ACCOUNTANT", "AGENT"].includes(role);
}

export function canCreateCommittee(role?: UserRole): boolean {
  return role === "ORGANIZER";
}

export function canAccessOrganizerDashboard(role?: UserRole): boolean {
  return role === "ORGANIZER";
}

export function canViewMembers(role?: UserRole): boolean {
  return !!role && ["ADMIN", "ORGANIZER"].includes(role);
}

export function canVerifyKYC(role?: UserRole): boolean {
  return !!role && ["ADMIN", "ORGANIZER"].includes(role);
}
