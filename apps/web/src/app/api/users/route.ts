import sql from '@/app/api/utils/sql';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { logAudit } from '../utils/audit';

export async function GET(_request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const userRole = (session.user as any).role;
  if (!['master_admin', 'admin'].includes(userRole)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Admin cannot see master_admin accounts
  if (userRole === 'admin') {
    const users = await sql`
      SELECT u.id, u.name, u.email, u.role, u.status, u.locked, u.force_password_change,
             m.name as mill_name, u.mill_id
      FROM "user" u
      LEFT JOIN mills m ON u.mill_id = m.id
      WHERE u.role != 'master_admin'
      ORDER BY u."createdAt" DESC
    `;
    return Response.json(users);
  }

  const users = await sql`
    SELECT u.id, u.name, u.email, u.role, u.status, u.locked, u.force_password_change,
           m.name as mill_name, u.mill_id
    FROM "user" u
    LEFT JOIN mills m ON u.mill_id = m.id
    ORDER BY u."createdAt" DESC
  `;
  return Response.json(users);
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const userRole = (session.user as any).role;
  if (!['master_admin', 'admin'].includes(userRole)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { name, email, password, role, mill_id } = await request.json();

  // Roles permission check
  if (userRole === 'admin' && role === 'master_admin') {
    return Response.json({ error: 'Admins cannot create master admins' }, { status: 403 });
  }

  try {
    // We use better-auth to create users ideally, but here we'll do a manual insert for simplicity
    // in this specific "Admin creating users" scenario, or we could use better-auth api.
    // For this prototype, we'll manually insert into user and handle password properly if needed,
    // but better-auth API is safer.

    // Using better-auth API to create user
    await auth.api.signUpEmail({
      body: {
        email,
        password,
        name,
      },
    });

    // Update the role and status after creation
    await sql`
      UPDATE "user"
      SET role = ${role}, mill_id = ${mill_id || null}
      WHERE email = ${email}
    `;

    await logAudit('create', 'user', `Created user ${email} with role ${role}`);
    return Response.json({ success: true });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const userRole = (session.user as any).role;
  if (!['master_admin', 'admin'].includes(userRole)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id, name, role, status, mill_id, locked, force_password_change } = await request.json();

  // Get current user to check target role
  const [targetUser] = await sql`SELECT role, name, email FROM "user" WHERE id = ${id}`;
  if (!targetUser) return Response.json({ error: 'User not found' }, { status: 404 });

  // Admin cannot edit or lock/unlock master_admin accounts
  if (userRole === 'admin' && targetUser.role === 'master_admin') {
    return Response.json(
      { error: 'Forbidden: Admin cannot edit Master Admin accounts' },
      { status: 403 }
    );
  }
  if (userRole === 'admin' && role === 'master_admin') {
    return Response.json({ error: 'Admins cannot assign the Master Admin role' }, { status: 403 });
  }

  const oldSnapshot = `role=${targetUser.role}`;
  const newSnapshot = `role=${role || targetUser.role}`;

  const setParts: string[] = [];
  const values: any[] = [];
  let paramCount = 1;

  if (name !== undefined) {
    setParts.push(`name = $${paramCount++}`);
    values.push(name);
  }
  if (role !== undefined) {
    setParts.push(`role = $${paramCount++}`);
    values.push(role);
  }
  if (status !== undefined) {
    setParts.push(`status = $${paramCount++}`);
    values.push(status);
  }
  if (mill_id !== undefined) {
    setParts.push(`mill_id = $${paramCount++}`);
    values.push(mill_id || null);
  }
  if (locked !== undefined) {
    setParts.push(`locked = $${paramCount++}`);
    values.push(!!locked);
  }
  if (force_password_change !== undefined) {
    setParts.push(`force_password_change = $${paramCount++}`);
    values.push(!!force_password_change);
  }

  if (setParts.length === 0)
    return Response.json({ error: 'No fields to update' }, { status: 400 });

  values.push(id);
  await sql(`UPDATE "user" SET ${setParts.join(', ')} WHERE id = $${paramCount}`, values);

  // Determine audit action
  let auditAction = 'edit';
  let auditDetails = `Updated user ${targetUser.email}`;
  if (locked === true) {
    auditAction = 'lock';
    auditDetails = `Locked account: ${targetUser.email}`;
  }
  if (locked === false) {
    auditAction = 'unlock';
    auditDetails = `Unlocked account: ${targetUser.email}`;
  }
  if (status === 'inactive') {
    auditAction = 'deactivate';
    auditDetails = `Deactivated account: ${targetUser.email}`;
  }
  if (status === 'active' && locked === undefined) {
    auditAction = 'activate';
    auditDetails = `Activated account: ${targetUser.email}`;
  }

  await logAudit(auditAction, 'user', auditDetails, oldSnapshot, newSnapshot);
  return Response.json({ success: true });
}
