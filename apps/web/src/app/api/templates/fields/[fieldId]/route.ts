import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import sql from '@/app/api/utils/sql';
import { logAudit } from '@/app/api/utils/audit';

// PUT /api/templates/fields/[fieldId] - Update field
export async function PUT(request: Request, { params }: { params: Promise<{ fieldId: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userRole = (session.user as any).role ?? '';
  if (!['master_admin', 'admin'].includes(userRole)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { fieldId } = await params;

  try {
    const body = await request.json();

    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    const allowedFields = [
      'label',
      'field_key',
      'field_type',
      'is_required',
      'is_unique',
      'is_read_only',
      'is_visible',
      'max_length',
      'min_length',
      'min_value',
      'max_value',
      'validation_pattern',
      'placeholder',
      'help_text',
      'field_options',
      'conditional_logic',
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates.push(`${field} = $${paramCount}`);
        if (field === 'field_options' || field === 'conditional_logic') {
          values.push(JSON.stringify(body[field]));
        } else {
          values.push(body[field]);
        }
        paramCount++;
      }
    }

    if (updates.length === 0) {
      return Response.json({ error: 'No fields to update' }, { status: 400 });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(parseInt(fieldId));

    const result = await sql(
      `UPDATE template_fields 
       SET ${updates.join(', ')} 
       WHERE id = $${paramCount}
       RETURNING *`,
      values
    );

    if (result.length === 0) {
      return Response.json({ error: 'Field not found' }, { status: 404 });
    }

    await logAudit('field_modified', `Field: ${fieldId}`, `Modified field "${result[0].label}"`);

    return Response.json({ field: result[0] });
  } catch (error: any) {
    console.error('Error updating field:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/templates/fields/[fieldId] - Delete field
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ fieldId: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userRole = (session.user as any).role ?? '';
  if (!['master_admin', 'admin'].includes(userRole)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { fieldId } = await params;

  try {
    const result = await sql(`DELETE FROM template_fields WHERE id = $1 RETURNING *`, [
      parseInt(fieldId),
    ]);

    if (result.length === 0) {
      return Response.json({ error: 'Field not found' }, { status: 404 });
    }

    await logAudit('field_removed', `Field: ${fieldId}`, `Removed field "${result[0].label}"`);

    return Response.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting field:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
