import sql from '@/app/api/utils/sql';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

export async function logAudit(
  action: string,
  target: string,
  details?: string,
  oldValue?: string,
  newValue?: string
) {
  const session = await auth.api.getSession({ headers: await headers() });
  const userId = session?.user?.id || 'system';
  const userRole = (session?.user as any)?.role || null;

  await sql`
    INSERT INTO audit_logs (user_id, user_role, action, target, details, old_value, new_value)
    VALUES (${userId}, ${userRole}, ${action}, ${target}, ${details || null}, ${oldValue || null}, ${newValue || null})
  `;
}
