import sql from '@/app/api/utils/sql';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

/**
 * Visibility matrix:
 *   master_admin → all logs
 *   admin        → admin + mill_user logs only (NO master_admin, NO null-role)
 *   mill_user    → forbidden (handled by RoleGuard on UI, but enforced here too)
 */
export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const role = (session.user as any)?.role ?? '';

  if (!['master_admin', 'admin'].includes(role)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(request.url);
  const action = url.searchParams.get('action');
  const target = url.searchParams.get('target');
  const search = url.searchParams.get('search');
  const roleFilter = url.searchParams.get('role'); // NEW: filter by performed-by role
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '200', 10), 500);

  const values: any[] = [];
  let query = `
    SELECT l.*, u.name as user_name, u.email as user_email
    FROM audit_logs l
    LEFT JOIN "user" u ON l.user_id = u.id
    WHERE 1=1
  `;

  // ── Role-based visibility ──────────────────────────────────────────────────
  // Admin: strictly show only admin + mill_user rows.
  // NULL user_role = system/unknown origin → hidden from admin (could be master_admin).
  if (role === 'admin') {
    query += ` AND l.user_role IN ('admin', 'mill_user')`;
  }
  // master_admin sees everything (no extra clause)

  // ── Optional performed-by-role filter (respects visibility ceiling) ────────
  if (roleFilter && roleFilter !== 'all') {
    // Admin cannot filter up to master_admin even by requesting it
    const allowedRoles =
      role === 'master_admin' ? ['master_admin', 'admin', 'mill_user'] : ['admin', 'mill_user'];

    if (allowedRoles.includes(roleFilter)) {
      values.push(roleFilter);
      query += ` AND l.user_role = $${values.length}`;
    }
  }

  // ── Standard filters ───────────────────────────────────────────────────────
  if (action) {
    values.push(action);
    query += ` AND l.action = $${values.length}`;
  }
  if (target) {
    values.push(target);
    query += ` AND l.target = $${values.length}`;
  }
  if (search) {
    values.push(`%${search}%`);
    const n = values.length;
    query += ` AND (l.details ILIKE $${n} OR l.target ILIKE $${n} OR u.name ILIKE $${n})`;
  }

  values.push(limit);
  query += ` ORDER BY l.created_at DESC LIMIT $${values.length}`;

  const logs = await sql(query, values);
  return Response.json(logs);
}
