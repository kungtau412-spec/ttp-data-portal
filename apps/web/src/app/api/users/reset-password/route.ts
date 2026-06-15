import sql from '@/app/api/utils/sql';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { logAudit } from '../../utils/audit';
import * as argon2 from 'argon2';

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const requesterRole = (session.user as any)?.role ?? '';

  if (!['master_admin', 'admin'].includes(requesterRole)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { user_id, new_password, force_change } = await request.json();

    if (!user_id || !new_password) {
      return Response.json({ error: 'user_id and new_password are required' }, { status: 400 });
    }

    if (new_password.length < 8) {
      return Response.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    // Fetch the target user
    const [targetUser] = await sql`
      SELECT id, email, name, role FROM "user" WHERE id = ${user_id}
    `;
    if (!targetUser) return Response.json({ error: 'User not found' }, { status: 404 });

    // Authority matrix: Admin cannot reset Master Admin passwords
    if (requesterRole === 'admin' && targetUser.role === 'master_admin') {
      return Response.json(
        { error: 'Forbidden: Admin cannot reset Master Admin passwords' },
        { status: 403 }
      );
    }

    // Hash the new password with argon2
    const hashedPassword = await argon2.hash(new_password);

    // Update the credential account password
    const updateResult = await sql`
      UPDATE account
      SET password = ${hashedPassword}, "updatedAt" = NOW()
      WHERE "userId" = ${user_id} AND "providerId" = 'credential'
    `;

    // If no credential account exists yet, insert one
    if ((updateResult as any).count === 0 || !updateResult) {
      await sql`
        INSERT INTO account (id, "userId", "accountId", "providerId", password, "createdAt", "updatedAt")
        VALUES (
          gen_random_uuid()::text,
          ${user_id},
          ${user_id},
          'credential',
          ${hashedPassword},
          NOW(),
          NOW()
        )
        ON CONFLICT DO NOTHING
      `;
    }

    // Set force_password_change flag
    await sql`
      UPDATE "user"
      SET force_password_change = ${!!force_change}
      WHERE id = ${user_id}
    `;

    const requesterName = session.user.name || session.user.id;
    const details = `${requesterName} (${requesterRole}) reset password for ${targetUser.name} (${targetUser.email} — ${targetUser.role})${force_change ? ' [force change at next login]' : ''}`;

    await logAudit(
      'reset_password',
      'user',
      details,
      undefined,
      force_change ? 'force_password_change=true' : 'force_password_change=false'
    );

    return Response.json({ success: true });
  } catch (err: any) {
    console.error('POST /api/users/reset-password error:', err);
    return Response.json({ error: err.message || 'Failed to reset password' }, { status: 500 });
  }
}
