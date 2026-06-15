/**
 * Centralized role-based access control (RBAC) for SDCP Portal.
 *
 * Roles (in descending privilege):
 *   master_admin → admin → mill_user
 */

export type UserRole = 'master_admin' | 'admin' | 'mill_user';

export const ROLES: Record<string, UserRole> = {
  MASTER_ADMIN: 'master_admin',
  ADMIN: 'admin',
  MILL_USER: 'mill_user',
};

export const ROLE_LABELS: Record<UserRole, string> = {
  master_admin: 'Master Admin',
  admin: 'Admin',
  mill_user: 'Mill User',
};

/** Ordered list — higher index means lower privilege */
const ROLE_HIERARCHY: UserRole[] = ['master_admin', 'admin', 'mill_user'];

/** Returns true if `userRole` has at least the level of `requiredRole` */
export function hasRole(userRole: string | undefined | null, requiredRole: UserRole): boolean {
  const userIdx = ROLE_HIERARCHY.indexOf((userRole ?? '') as UserRole);
  const reqIdx = ROLE_HIERARCHY.indexOf(requiredRole);
  if (userIdx === -1 || reqIdx === -1) return false;
  return userIdx <= reqIdx; // lower index = higher privilege
}

/** Returns true if `userRole` is exactly one of the listed roles */
export function isOneOf(userRole: string | undefined | null, roles: UserRole[]): boolean {
  return roles.includes((userRole ?? '') as UserRole);
}

// ─── Module-level permission definitions ────────────────────────────────────

export const CAN = {
  // User Management
  viewUsers: (role: string) => isOneOf(role, ['master_admin', 'admin']),
  createUser: (role: string) => isOneOf(role, ['master_admin', 'admin']),
  createMasterAdmin: (role: string) => role === 'master_admin',
  editUser: (role: string) => isOneOf(role, ['master_admin', 'admin']),

  // Mills
  viewMills: (_role: string) => true, // all authenticated users can list mills
  manageMills: (role: string) => isOneOf(role, ['master_admin', 'admin']),

  // Assessment Years
  viewYears: (_role: string) => true,
  manageYears: (role: string) => role === 'master_admin',

  // Assessments
  viewAssessments: (_role: string) => true,
  initAssessment: (role: string) => isOneOf(role, ['master_admin', 'admin']),
  submitAssessment: (role: string) => isOneOf(role, ['master_admin', 'admin', 'mill_user']),
  approveAssessment: (role: string) => isOneOf(role, ['master_admin', 'admin']),
  reopenAssessment: (role: string) => isOneOf(role, ['master_admin', 'admin']),

  // Reports
  viewReports: (role: string) => isOneOf(role, ['master_admin', 'admin']),

  // Audit Logs
  viewAuditLogs: (role: string) => hasRole(role, 'admin'), // admin sees filtered; mill_user via dashboard only

  // Supplier Fields Configuration (Part 4)
  viewSupplierFields: (role: string) => isOneOf(role, ['master_admin', 'admin']),
  manageSupplierFields: (role: string) => isOneOf(role, ['master_admin', 'admin']),
  deleteSupplierField: (role: string) => role === 'master_admin',
  reorderSupplierField: (role: string) => role === 'master_admin',
};
