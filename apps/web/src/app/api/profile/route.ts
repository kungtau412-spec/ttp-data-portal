import sql from '@/app/api/utils/sql';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { logAudit } from '../utils/audit';
import * as argon2 from 'argon2';

// GET — return own full profile
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const [user] = await sql`
    SELECT
      u.id, u.name, u.email, u.role, u.status, u.force_password_change, u.locked,
      m.name as mill_name, u.mill_id, u."createdAt"
    FROM "user" u
    LEFT JOIN mills m ON u.mill_id = m.id
    WHERE u.id = ${session.user.id}
  `;

  if (!user) return Response.json({ error: 'User not found' }, { status: 404 });
  return Response.json(user);
}

// PATCH — update own name
export async function PATCH(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { name } = await request.json();
    if (!name?.trim()) return Response.json({ error: 'Name is required' }, { status: 400 });

    await sql`UPDATE "user" SET name = ${name.trim()} WHERE id = ${session.user.id}`;
    await logAudit('edit', 'user', `Updated own profile: name changed`);
    return Response.json({ success: true });
  } catch (err: any) {
    console.error('PATCH /api/profile error:', err);
    return Response.json({ error: err.message || 'Failed to update profile' }, { status: 500 });
  }
}

// POST — change own password
export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { current_password, new_password } = await request.json();

    if (!current_password || !new_password) {
      return Response.json(
        { error: 'current_password and new_password are required' },
        { status: 400 }
      );
    }
    if (new_password.length < 8) {
      return Response.json(
        { error: 'New password must be at least 8 characters' },
        { status: 400 }
      );
    }

    // Verify current password
    const [account] = await sql`
      SELECT password FROM account
      WHERE "userId" = ${session.user.id} AND "providerId" = 'credential'
    `;
    if (!account?.password) {
      return Response.json({ error: 'No credential account found' }, { status: 400 });
    }

    const valid = await argon2.verify(account.password, current_password);
    if (!valid) {
      return Response.json({ error: 'Current password is incorrect' }, { status: 400 });
    }

    const hashed = await argon2.hash(new_password);

    await sql`
      UPDATE account
      SET password = ${hashed}, "updatedAt" = NOW()
      WHERE "userId" = ${session.user.id} AND "providerId" = 'credential'
    `;

    // Clear force_password_change flag
    await sql`
      UPDATE "user" SET force_password_change = FALSE WHERE id = ${session.user.id}
    `;

    await logAudit('change_password', 'user', `Changed own password`);
    return Response.json({ success: true });
  } catch (err: any) {
    console.error('POST /api/profile error:', err);
    return Response.json({ error: err.message || 'Failed to change password' }, { status: 500 });
  }
}
