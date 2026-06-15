import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import sql from '@/app/api/utils/sql';
import { logAudit } from '@/app/api/utils/audit';

// PUT /api/templates/fields/[fieldId]/move - Move field to different section
export async function PUT(request: Request, { params }: { params: Promise<{ fieldId: string }> }) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = (session.user as any).role;
    if (!['master_admin', 'admin'].includes(userRole)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { fieldId } = await params;
    const body = await request.json();
    const { section_id } = body;

    if (!section_id) {
      return Response.json({ error: 'section_id is required' }, { status: 400 });
    }

    // Get current field info
    const [field] = await sql`
      SELECT * FROM template_fields WHERE id = ${parseInt(fieldId)}
    `;

    if (!field) {
      return Response.json({ error: 'Field not found' }, { status: 404 });
    }

    // Get max sort_order in target section
    const maxOrderResult = await sql`
      SELECT COALESCE(MAX(sort_order), -1) as max_order 
      FROM template_fields 
      WHERE section_id = ${parseInt(section_id)}
    `;
    const nextOrder = maxOrderResult[0].max_order + 1;

    // Move field to new section
    const result = await sql`
      UPDATE template_fields 
      SET section_id = ${parseInt(section_id)},
          sort_order = ${nextOrder},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${parseInt(fieldId)}
      RETURNING *
    `;

    await logAudit(
      'field_moved',
      `Field: ${fieldId}`,
      `Moved field "${field.label}" to section ${section_id}`
    );

    return Response.json({ field: result[0] });
  } catch (error: any) {
    console.error('Error moving field:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
