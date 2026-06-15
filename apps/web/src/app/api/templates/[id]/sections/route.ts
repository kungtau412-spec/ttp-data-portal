import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import sql from '@/app/api/utils/sql';
import { logAudit } from '@/app/api/utils/audit';

// POST /api/templates/[id]/sections - Add section
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
    const { name, description, is_required = true, is_visible = true, is_editable = true } = body;

    if (!name) {
      return Response.json({ error: 'Section name is required' }, { status: 400 });
    }

    // Get max sort_order
    const maxOrderResult = await sql(
      `SELECT COALESCE(MAX(sort_order), -1) as max_order 
       FROM template_sections 
       WHERE template_id = $1`,
      [parseInt(id)]
    );
    const nextOrder = maxOrderResult[0].max_order + 1;

    const result = await sql(
      `INSERT INTO template_sections 
       (template_id, name, description, is_required, is_visible, is_editable, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [parseInt(id), name, description || null, is_required, is_visible, is_editable, nextOrder]
    );

    await logAudit('section_added', `Template: ${id}`, `Added section "${name}"`);

    return Response.json({ section: result[0] }, { status: 201 });
  } catch (error: any) {
    console.error('Error adding section:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
