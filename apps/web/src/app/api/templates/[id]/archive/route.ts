import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import sql from '@/app/api/utils/sql';
import { logAudit } from '@/app/api/utils/audit';

// POST /api/templates/[id]/archive - Archive template (master_admin only)
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userRole = (session.user as any).role ?? '';
  if (userRole !== 'master_admin') {
    return Response.json(
      { error: 'Forbidden - Only Master Admin can archive templates' },
      { status: 403 }
    );
  }

  const { id } = await params;

  try {
    const result = await sql(
      `UPDATE assessment_templates 
       SET status = 'archived', 
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 
       RETURNING *`,
      [parseInt(id)]
    );

    if (result.length === 0) {
      return Response.json({ error: 'Template not found' }, { status: 404 });
    }

    await logAudit('template_archived', `Template: ${id}`, `Archived template "${result[0].name}"`);

    return Response.json({ template: result[0] });
  } catch (error: any) {
    console.error('Error archiving template:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
