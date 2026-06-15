import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import sql from '@/app/api/utils/sql';
import { logAudit } from '@/app/api/utils/audit';

// GET /api/templates - List all templates (filtered by role)
export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userRole = (session.user as any).role ?? '';
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const yearId = searchParams.get('year_id');

  try {
    let query = `
      SELECT 
        t.*,
        y.year as year_name,
        u.name as created_by_name
      FROM assessment_templates t
      LEFT JOIN assessment_years y ON t.year_id = y.id
      LEFT JOIN "user" u ON t.created_by = u.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramCount = 1;

    // Mill users can only see published templates
    if (userRole === 'mill_user') {
      query += ` AND t.status = $${paramCount}`;
      params.push('published');
      paramCount++;
    }

    if (status) {
      query += ` AND t.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    if (yearId) {
      query += ` AND t.year_id = $${paramCount}`;
      params.push(parseInt(yearId));
      paramCount++;
    }

    query += ` ORDER BY t.created_at DESC`;

    const templates = await sql(query, params);
    return Response.json({ templates });
  } catch (error: any) {
    console.error('Error fetching templates:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/templates - Create new template (master_admin, admin)
export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userRole = (session.user as any).role ?? '';
  if (!['master_admin', 'admin'].includes(userRole)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { name, year_id } = body;

    if (!name) {
      return Response.json({ error: 'Template name is required' }, { status: 400 });
    }

    const result = await sql(
      `INSERT INTO assessment_templates (name, year_id, version_number, status, created_by)
       VALUES ($1, $2, 1, 'draft', $3)
       RETURNING *`,
      [name, year_id || null, session.user.id]
    );

    const template = result[0];

    await logAudit(
      session.user.id,
      userRole,
      'template_created',
      `Template: ${template.id}`,
      `Created template "${name}"`
    );

    return Response.json({ template }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating template:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
