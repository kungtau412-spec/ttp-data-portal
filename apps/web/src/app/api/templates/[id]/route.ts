import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import sql from '@/app/api/utils/sql';
import { logAudit } from '@/app/api/utils/audit';

// GET /api/templates/[id] - Get full template with sections and fields
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const templateResult = await sql(
      `SELECT 
        t.*,
        y.year as year_name,
        u.name as created_by_name
       FROM assessment_templates t
       LEFT JOIN assessment_years y ON t.year_id = y.id
       LEFT JOIN "user" u ON t.created_by = u.id
       WHERE t.id = $1`,
      [parseInt(id)]
    );

    if (templateResult.length === 0) {
      return Response.json({ error: 'Template not found' }, { status: 404 });
    }

    const template = templateResult[0];

    // Fetch sections
    const sections = await sql(
      `SELECT * FROM template_sections 
       WHERE template_id = $1 
       ORDER BY sort_order, id`,
      [parseInt(id)]
    );

    // Fetch fields for each section
    const fields = await sql(
      `SELECT * FROM template_fields 
       WHERE template_id = $1 
       ORDER BY section_id, sort_order, id`,
      [parseInt(id)]
    );

    // Group fields by section
    const sectionsWithFields = sections.map((section: any) => ({
      ...section,
      fields: fields.filter((field: any) => field.section_id === section.id),
    }));

    return Response.json({
      template: {
        ...template,
        sections: sectionsWithFields,
      },
    });
  } catch (error: any) {
    console.error('Error fetching template:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// PUT /api/templates/[id] - Update template metadata
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
    const { name, year_id } = body;

    // Check if template is published
    const [existingTemplate] = await sql(`SELECT status FROM assessment_templates WHERE id = $1`, [
      parseInt(id),
    ]);

    if (!existingTemplate) {
      return Response.json({ error: 'Template not found' }, { status: 404 });
    }

    if (existingTemplate.status === 'published') {
      return Response.json(
        { error: 'Cannot edit published template. Create a new version instead.' },
        { status: 400 }
      );
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramCount}`);
      values.push(name);
      paramCount++;
    }

    if (year_id !== undefined) {
      updates.push(`year_id = $${paramCount}`);
      values.push(year_id || null);
      paramCount++;
    }

    if (updates.length === 0) {
      return Response.json({ error: 'No fields to update' }, { status: 400 });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(parseInt(id));

    const result = await sql(
      `UPDATE assessment_templates 
       SET ${updates.join(', ')} 
       WHERE id = $${paramCount} 
       RETURNING *`,
      values
    );

    if (result.length === 0) {
      return Response.json({ error: 'Template not found' }, { status: 404 });
    }

    await logAudit('template_edited', `Template: ${id}`, `Updated template "${result[0].name}"`);

    return Response.json({ template: result[0] });
  } catch (error: any) {
    console.error('Error updating template:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/templates/[id] - Delete template (master_admin only)
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userRole = (session.user as any).role ?? '';
  if (userRole !== 'master_admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;

  try {
    // Protection: block deletion if template is linked to any assessments
    const [{ count }] = await sql(
      `SELECT COUNT(*) as count FROM assessments WHERE template_id = $1`,
      [parseInt(id)]
    );
    const linkedCount = parseInt(count as string);
    if (linkedCount > 0) {
      return Response.json(
        {
          error: `Template is currently in use by ${linkedCount} assessment${linkedCount !== 1 ? 's' : ''} and cannot be deleted. Use Archive, Create New Version, or Duplicate instead.`,
          inUse: true,
          linkedCount,
        },
        { status: 400 }
      );
    }

    const result = await sql(`DELETE FROM assessment_templates WHERE id = $1 RETURNING *`, [
      parseInt(id),
    ]);

    if (result.length === 0) {
      return Response.json({ error: 'Template not found' }, { status: 404 });
    }

    await logAudit('template_deleted', `Template: ${id}`, `Deleted template "${result[0].name}"`);

    return Response.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting template:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
