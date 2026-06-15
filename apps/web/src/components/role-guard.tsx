'use client';

import { authClient } from '@/lib/auth-client';
import { type UserRole, hasRole } from '@/lib/permissions';
import { ShieldX } from 'lucide-react';

interface RoleGuardProps {
  /** User must be at least this privileged (inclusive) */
  minRole?: UserRole;
  /** User must have at least the privilege of one of these roles */
  allowedRoles?: UserRole[];
  /** What to show when the user lacks access (default: access denied card) */
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Wraps content that should only be visible to users with the right role.
 *
 * Usage:
 *   <RoleGuard allowedRoles={['master_admin', 'admin']}>
 *     <AdminPanel />
 *   </RoleGuard>
 *
 *   <RoleGuard minRole="admin">
 *     <ManageButton />
 *   </RoleGuard>
 */
export default function RoleGuard({ minRole, allowedRoles, fallback, children }: RoleGuardProps) {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) return null;

  const role = (session?.user as any)?.role ?? '';

  // Hierarchy-aware: master_admin satisfies any role check that a lower privilege would
  const allowed = minRole
    ? hasRole(role, minRole)
    : allowedRoles
      ? allowedRoles.some((r) => hasRole(role, r))
      : true;

  if (!allowed) {
    if (fallback !== undefined) return <>{fallback}</>;
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
        <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center">
          <ShieldX size={28} className="text-red-400" />
        </div>
        <div className="text-center">
          <h3 className="text-base font-semibold text-slate-700">Access Denied</h3>
          <p className="text-sm text-slate-400 mt-1">
            You don't have permission to view this page.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
