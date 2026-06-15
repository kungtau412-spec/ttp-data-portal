import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import sql from '@/app/api/utils/sql';
import { logAudit } from '@/app/api/utils/audit';

// PUT /api/templates/[id]/sections/[sectionId] - Update section
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; sectionId: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userRole = (session.user as any).role ?? '';
  if (!['master_admin', 'admin'].includes(userRole)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id, sectionId } = await params;

  try {
    const body = await request.json();
    const { name, description, is_required, is_visible, is_editable } = body;

    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramCount}`);
      values.push(name);
      paramCount++;
    }

    if (description !== undefined) {
      updates.push(`description = $${paramCount}`);
      values.push(description || null);
      paramCount++;
    }

    if (is_required !== undefined) {
      updates.push(`is_required = $${paramCount}`);
      values.push(is_required);
      paramCount++;
    }

    if (is_visible !== undefined) {
      updates.push(`is_visible = $${paramCount}`);
      values.push(is_visible);
      paramCount++;
    }

    if (is_editable !== undefined) {
      updates.push(`is_editable = $${paramCount}`);
      values.push(is_editable);
      paramCount++;
    }

    if (updates.length === 0) {
      return Response.json({ error: 'No fields to update' }, { status: 400 });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(parseInt(sectionId), parseInt(id));

    const result = await sql(
      `UPDATE template_sections 
       SET ${updates.join(', ')} 
       WHERE id = $${paramCount} AND template_id = $${paramCount + 1}
       RETURNING *`,
      values
    );

    if (result.length === 0) {
      return Response.json({ error: 'Section not found' }, { status: 404 });
    }

    await logAudit(
      'section_updated',
      `Section: ${sectionId}`,
      `Updated section "${result[0].name}"`
    );

    return Response.json({ section: result[0] });
  } catch (error: any) {
    console.error('Error updating section:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/templates/[id]/sections/[sectionId] - Delete section
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; sectionId: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userRole = (session.user as any).role ?? '';
  if (!['master_admin', 'admin'].includes(userRole)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id, sectionId } = await params;

  try {
    const result = await sql(
      `DELETE FROM template_sections 
       WHERE id = $1 AND template_id = $2 
       RETURNING *`,
      [parseInt(sectionId), parseInt(id)]
    );

    if (result.length === 0) {
      return Response.json({ error: 'Section not found' }, { status: 404 });
    }

    await logAudit(
      'section_removed',
      `Section: ${sectionId}`,
      `Removed section "${result[0].name}"`
    );

    return Response.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting section:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
