import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import sql from '@/app/api/utils/sql';

// GET /api/templates/active - Get the latest published template (optionally for a specific year)
export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const yearId = searchParams.get('yearId');

  try {
    let query = `
      SELECT * FROM assessment_templates
      WHERE status = 'published'
    `;
    const values: any[] = [];

    if (yearId) {
      values.push(parseInt(yearId));
      query += ` AND year_id = $${values.length}`;
    }

    query += ` ORDER BY version_number DESC, created_at DESC LIMIT 1`;

    const result = await sql(query, values);

    if (result.length === 0) {
      return Response.json(
        { error: 'No published template found' + (yearId ? ' for this year' : '') },
        { status: 404 }
      );
    }

    const template = result[0];
    const templateId = template.id;

    // Get sections
    const sections = await sql(
      `SELECT * FROM template_sections 
       WHERE template_id = $1 
       ORDER BY sort_order, id`,
      [templateId]
    );

    // Get fields for each section
    for (const section of sections) {
      const fields = await sql(
        `SELECT * FROM template_fields 
         WHERE section_id = $1 
         ORDER BY sort_order, id`,
        [section.id]
      );
      (section as any).fields = fields;
    }

    (template as any).sections = sections;

    return Response.json(template);
  } catch (error: any) {
    console.error('Error fetching active template:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
