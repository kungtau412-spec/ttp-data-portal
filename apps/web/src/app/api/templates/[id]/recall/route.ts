import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import sql from '@/app/api/utils/sql';
import { logAudit } from '@/app/api/utils/audit';

/**
 * POST /api/templates/[id]/recall
 * Recalls a published template back to draft status.
 * Allowed roles: master_admin, admin
 * Workflow: published → draft
 *
 * Note: Assessments already linked to this template retain their template_id.
 * Their existing template data is preserved — only NEW assessment template lookups
 * will stop finding this template (since it is no longer published).
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userRole = (session.user as any).role ?? '';
  if (!['master_admin', 'admin'].includes(userRole)) {
    return Response.json(
      { error: 'Forbidden: only admins can recall a published template' },
      { status: 403 }
    );
  }

  const { id } = await params;

  try {
    const [template] = await sql(`SELECT * FROM assessment_templates WHERE id = $1`, [
      parseInt(id),
    ]);

    if (!template) {
      return Response.json({ error: 'Template not found' }, { status: 404 });
    }

    if (template.status !== 'published') {
      return Response.json(
        {
          error:
            'Only published templates can be recalled. This template is currently: ' +
            template.status,
        },
        { status: 400 }
      );
    }

    // Count linked assessments so we can warn (but not block — admin may still want to recall)
    const [{ count }] = await sql(
      `SELECT COUNT(*) as count FROM assessments WHERE template_id = $1`,
      [parseInt(id)]
    );
    const linkedCount = parseInt(count as string);

    const [result] = await sql(
      `UPDATE assessment_templates
       SET status = 'draft', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [parseInt(id)]
    );

    await logAudit(
      'template_recalled',
      `Template: ${id}`,
      `Recalled template "${template.name}" from published → draft${linkedCount > 0 ? ` (${linkedCount} assessment(s) still linked)` : ''}`
    );

    return Response.json({
      template: result,
      linkedAssessments: linkedCount,
      message:
        linkedCount > 0
          ? `Template recalled to draft. Note: ${linkedCount} assessment(s) still reference this template and will continue to use it for editing.`
          : 'Template recalled to draft successfully.',
    });
  } catch (error: any) {
    console.error('Error recalling template:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
