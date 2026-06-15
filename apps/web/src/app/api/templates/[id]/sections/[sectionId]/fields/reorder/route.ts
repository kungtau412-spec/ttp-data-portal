import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import sql from '@/app/api/utils/sql';
import { logAudit } from '@/app/api/utils/audit';

// PUT /api/templates/[id]/sections/[sectionId]/fields/reorder - Reorder fields
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
    const { field_ids } = body; // Array of field IDs in new order

    if (!Array.isArray(field_ids)) {
      return Response.json({ error: 'field_ids must be an array' }, { status: 400 });
    }

    // Update each field's sort_order
    for (let i = 0; i < field_ids.length; i++) {
      await sql(
        `UPDATE template_fields 
         SET sort_order = $1, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $2 AND section_id = $3`,
        [i, field_ids[i], parseInt(sectionId)]
      );
    }

    await logAudit(
      session.user.id,
      userRole,
      'fields_reordered',
      `Section: ${sectionId}`,
      `Reordered ${field_ids.length} fields`
    );

    return Response.json({ success: true });
  } catch (error: any) {
    console.error('Error reordering fields:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
