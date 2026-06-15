import sql from '@/app/api/utils/sql';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { logAudit } from '../utils/audit';

function getRole(session: any): string {
  return (session?.user as any)?.role ?? '';
}

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const role = getRole(session);
  const { searchParams } = new URL(request.url);
  const showAll = searchParams.get('all') === 'true' && ['master_admin', 'admin'].includes(role);

  const fields = showAll
    ? await sql`SELECT * FROM supplier_field_config ORDER BY sort_order ASC, id ASC`
    : await sql`SELECT * FROM supplier_field_config WHERE is_active = TRUE ORDER BY sort_order ASC, id ASC`;

  return Response.json(fields);
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const role = getRole(session);
  if (!['master_admin', 'admin'].includes(role)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { field_label, field_key, field_type, field_options, is_required } = body;

    if (!field_label || !field_key || !field_type) {
      return Response.json(
        { error: 'field_label, field_key, and field_type are required' },
        { status: 400 }
      );
    }

    // Sanitize key: lowercase, replace spaces with underscores, remove special chars
    const sanitizedKey = field_key
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '');

    const [maxOrder] =
      await sql`SELECT COALESCE(MAX(sort_order), 0) as max_order FROM supplier_field_config`;

    const [field] = await sql`
      INSERT INTO supplier_field_config
        (field_label, field_key, field_type, field_options, is_required, sort_order, created_by)
      VALUES (
        ${field_label},
        ${sanitizedKey},
        ${field_type},
        ${field_options ? JSON.stringify(field_options) : null},
        ${!!is_required},
        ${(maxOrder.max_order || 0) + 1},
        ${session.user.id}
      )
      RETURNING *
    `;

    await logAudit('create', 'supplier_field', `Added field: ${field_label} (${field_key})`);
    return Response.json(field, { status: 201 });
  } catch (err: any) {
    if (err.message?.includes('unique')) {
      return Response.json(
        { error: 'Field key already exists. Use a different key.' },
        { status: 400 }
      );
    }
    console.error('POST /api/supplier-fields error:', err);
    return Response.json({ error: err.message || 'Failed to create field' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const role = getRole(session);
  if (!['master_admin', 'admin'].includes(role)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { id, field_label, field_type, field_options, is_required, is_active, sort_order } = body;

    if (!id) return Response.json({ error: 'id is required' }, { status: 400 });

    const setParts: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (field_label !== undefined) {
      setParts.push(`field_label = $${paramCount++}`);
      values.push(field_label);
    }
    if (field_type !== undefined) {
      setParts.push(`field_type = $${paramCount++}`);
      values.push(field_type);
    }
    if (field_options !== undefined) {
      setParts.push(`field_options = $${paramCount++}`);
      values.push(field_options ? JSON.stringify(field_options) : null);
    }
    if (is_required !== undefined) {
      setParts.push(`is_required = $${paramCount++}`);
      values.push(!!is_required);
    }
    if (is_active !== undefined) {
      setParts.push(`is_active = $${paramCount++}`);
      values.push(!!is_active);
    }
    if (sort_order !== undefined && role === 'master_admin') {
      setParts.push(`sort_order = $${paramCount++}`);
      values.push(sort_order);
    }

    if (setParts.length === 0)
      return Response.json({ error: 'No fields to update' }, { status: 400 });

    setParts.push(`updated_at = NOW()`);
    values.push(id);

    const [field] = await sql(
      `UPDATE supplier_field_config SET ${setParts.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    await logAudit('edit', 'supplier_field', `Updated field: ${field?.field_label || id}`);
    return Response.json(field);
  } catch (err: any) {
    console.error('PATCH /api/supplier-fields error:', err);
    return Response.json({ error: err.message || 'Failed to update field' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const role = getRole(session);
  if (role !== 'master_admin') {
    return Response.json(
      { error: 'Forbidden: only Master Admin can delete fields' },
      { status: 403 }
    );
  }

  try {
    const { id } = await request.json();
    if (!id) return Response.json({ error: 'id is required' }, { status: 400 });

    const [field] =
      await sql`DELETE FROM supplier_field_config WHERE id = ${id} RETURNING field_label`;
    await logAudit('delete', 'supplier_field', `Deleted field: ${field?.field_label || id}`);
    return Response.json({ success: true });
  } catch (err: any) {
    console.error('DELETE /api/supplier-fields error:', err);
    return Response.json({ error: err.message || 'Failed to delete field' }, { status: 500 });
  }
}
