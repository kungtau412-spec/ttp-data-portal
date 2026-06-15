import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import sql from '@/app/api/utils/sql';
import { logAudit } from '@/app/api/utils/audit';

// POST /api/templates/[id]/publish - Publish template
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
    // Get current template
    const templateResult = await sql(`SELECT * FROM assessment_templates WHERE id = $1`, [
      parseInt(id),
    ]);

    if (templateResult.length === 0) {
      return Response.json({ error: 'Template not found' }, { status: 404 });
    }

    const currentTemplate = templateResult[0];

    // If already published, increment version
    let newVersion = currentTemplate.version_number;
    if (currentTemplate.status === 'published') {
      newVersion = currentTemplate.version_number + 1;
    }

    // Update to published
    const result = await sql(
      `UPDATE assessment_templates 
       SET status = 'published', 
           version_number = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 
       RETURNING *`,
      [newVersion, parseInt(id)]
    );

    await logAudit(
      'template_published',
      `Template: ${id}`,
      `Published template "${currentTemplate.name}" (v${newVersion})`
    );

    return Response.json({ template: result[0] });
  } catch (error: any) {
    console.error('Error publishing template:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
