import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import sql from '@/app/api/utils/sql';
import { logAudit } from '@/app/api/utils/audit';

// PUT /api/templates/[id]/sections/reorder - Reorder sections
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userRole = (session.user as any).role ?? '';
  if (!['master_admin', 'admin'].includes(userRole)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const { section_ids } = body; // Array of section IDs in new order

    if (!Array.isArray(section_ids)) {
      return Response.json({ error: 'section_ids must be an array' }, { status: 400 });
    }

    // Update each section's sort_order
    for (let i = 0; i < section_ids.length; i++) {
      await sql(
        `UPDATE template_sections 
         SET sort_order = $1, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $2 AND template_id = $3`,
        [i, section_ids[i], parseInt(id)]
      );
    }

    await logAudit(
      session.user.id,
      userRole,
      'sections_reordered',
      `Template: ${id}`,
      `Reordered ${section_ids.length} sections`
    );

    return Response.json({ success: true });
  } catch (error: any) {
    console.error('Error reordering sections:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
