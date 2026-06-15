import sql from '@/app/api/utils/sql';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { logAudit } from '../utils/audit';
import { notifyRoles } from '../utils/notify';

const EAST_MALAYSIA = ['Sabah', 'Sarawak', 'Labuan'];
const WEST_MALAYSIA = [
  'Johor',
  'Kedah',
  'Kelantan',
  'Melaka',
  'Negeri Sembilan',
  'Pahang',
  'Perak',
  'Perlis',
  'Penang',
  'Selangor',
  'Terengganu',
  'Putrajaya',
  'Kuala Lumpur',
];

function getRole(session: any): string {
  return (session?.user as any)?.role ?? '';
}

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const millId = searchParams.get('millId');
  const yearId = searchParams.get('yearId');
  const status = searchParams.get('status');
  const region = searchParams.get('region'); // 'east' | 'west'
  const stateFilter = searchParams.get('state');
  const supplierType = searchParams.get('supplierType');
  const certificationStatus = searchParams.get('certificationStatus');
  const userRole = getRole(session);
  const userMillId = (session.user as any)?.mill_id;

  const values: any[] = [];
  let query = `
    SELECT a.*, m.name as mill_name, m.code as mill_code, m.state as mill_state, m.country as mill_country, y.year,
      (SELECT COUNT(*) FROM supplier_information si WHERE si.assessment_id = a.id) as supplier_count,
      (SELECT COUNT(*) FROM evidence_uploads eu WHERE eu.assessment_id = a.id) as evidence_count
    FROM assessments a
    JOIN mills m ON a.mill_id = m.id
    JOIN assessment_years y ON a.year_id = y.id
    WHERE 1=1
  `;

  if (userRole === 'mill_user') {
    values.push(userMillId);
    query += ` AND a.mill_id = $${values.length}`;
  } else if (millId) {
    values.push(millId);
    query += ` AND a.mill_id = $${values.length}`;
  }

  if (yearId) {
    values.push(yearId);
    query += ` AND a.year_id = $${values.length}`;
  }

  if (status) {
    values.push(status);
    query += ` AND a.status = $${values.length}`;
  }

  // Region filter
  if (region === 'east') {
    const placeholders = EAST_MALAYSIA.map((_, i) => `$${values.length + i + 1}`).join(', ');
    EAST_MALAYSIA.forEach((s) => values.push(s));
    query += ` AND m.state IN (${placeholders})`;
  } else if (region === 'west') {
    const placeholders = WEST_MALAYSIA.map((_, i) => `$${values.length + i + 1}`).join(', ');
    WEST_MALAYSIA.forEach((s) => values.push(s));
    query += ` AND m.state IN (${placeholders})`;
  }

  // State filter
  if (stateFilter) {
    values.push(stateFilter);
    query += ` AND m.state = $${values.length}`;
  }

  // Supplier type filter — subquery existence check
  if (supplierType) {
    values.push(supplierType);
    query += ` AND EXISTS (
      SELECT 1 FROM supplier_information si2
      WHERE si2.assessment_id = a.id AND si2.type = $${values.length}
    )`;
  }

  // Certification status filter — subquery existence check
  if (certificationStatus) {
    values.push(certificationStatus);
    query += ` AND EXISTS (
      SELECT 1 FROM supplier_information si3
      WHERE si3.assessment_id = a.id AND si3.certification_status = $${values.length}
    )`;
  }

  query += ` ORDER BY a.created_at DESC`;
  const assessments = await sql(query, values);
  return Response.json(assessments);
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const role = getRole(session);
  if (!['master_admin', 'admin'].includes(role)) {
    return Response.json(
      { error: 'Forbidden: only admins can initialize assessments' },
      { status: 403 }
    );
  }

  try {
    const { mill_id, year_id } = await request.json();
    if (!mill_id || !year_id) {
      return Response.json({ error: 'mill_id and year_id are required' }, { status: 400 });
    }

    const existing = await sql`
      SELECT id FROM assessments WHERE mill_id = ${mill_id} AND year_id = ${year_id}
    `;
    if (existing.length > 0) {
      return Response.json(
        { error: 'An assessment already exists for this mill and year' },
        { status: 400 }
      );
    }

    // ── Find the best published template to link ─────────────────────────────
    // 1. Latest published template for this specific year
    // 2. Global fallback: any latest published template (year-agnostic)
    const activeTemplate = await sql(
      `SELECT id FROM assessment_templates 
       WHERE status = 'published' AND year_id = $1
       ORDER BY version_number DESC, created_at DESC 
       LIMIT 1`,
      [year_id]
    );

    let template_id: number | null = null;

    if (activeTemplate.length > 0) {
      template_id = activeTemplate[0].id;
    } else {
      // Global fallback: any published template regardless of year
      const anyTemplate = await sql`
        SELECT id FROM assessment_templates
        WHERE status = 'published'
        ORDER BY version_number DESC, created_at DESC
        LIMIT 1
      `;
      if (anyTemplate.length > 0) template_id = anyTemplate[0].id;
    }

    const [assessment] = await sql`
      INSERT INTO assessments (mill_id, year_id, status, template_id)
      VALUES (${mill_id}, ${year_id}, 'draft', ${template_id})
      RETURNING *
    `;

    const [millRow] = await sql`SELECT name FROM mills WHERE id = ${mill_id}`;
    await logAudit(
      'create',
      'ttp_data',
      `Created TTP Data for mill: ${millRow?.name ?? mill_id}${template_id ? ` (template: ${template_id})` : ''}`
    );
    return Response.json(assessment, { status: 201 });
  } catch (err: any) {
    console.error('POST /api/assessments error:', err);
    return Response.json({ error: err.message || 'Failed to create assessment' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id, status, reason } = await request.json();
    if (!id || !status)
      return Response.json({ error: 'id and status are required' }, { status: 400 });

    const role = getRole(session);
    const userMillId = (session.user as any)?.mill_id;

    const [current] =
      await sql`SELECT a.*, m.name as mill_name FROM assessments a JOIN mills m ON a.mill_id = m.id WHERE a.id = ${id}`;
    if (!current) return Response.json({ error: 'Assessment not found' }, { status: 404 });

    // ── Admin-only transitions ────────────────────────────────────────────
    const adminOnly = ['approved', 'under_review', 'reopened'];
    if (adminOnly.includes(status) && !['master_admin', 'admin'].includes(role)) {
      return Response.json(
        { error: 'Forbidden: only admins can approve or reopen assessments' },
        { status: 403 }
      );
    }

    // ── Mill user recall: submitted → draft ───────────────────────────────
    if (status === 'draft' && current.status === 'submitted') {
      if (role !== 'mill_user') {
        return Response.json(
          { error: 'Forbidden: only mill users can recall a submission' },
          { status: 403 }
        );
      }
      if (current.mill_id !== userMillId) {
        return Response.json(
          { error: 'Forbidden: you can only recall your own mill assessments' },
          { status: 403 }
        );
      }

      // Re-link to the current active published template for this year
      // (handles cases where the assessment was created before a template existed)
      // Fallback 1: year-specific published template
      const [activeTemplateRow] = await sql(
        `SELECT id FROM assessment_templates
         WHERE status = 'published' AND year_id = $1
         ORDER BY version_number DESC, created_at DESC
         LIMIT 1`,
        [current.year_id]
      );

      let newTemplateId = activeTemplateRow ? activeTemplateRow.id : null;

      // Fallback 2: any published template (year-agnostic)
      if (!newTemplateId) {
        const [anyTemplateRow] = await sql`
          SELECT id FROM assessment_templates
          WHERE status = 'published'
          ORDER BY version_number DESC, created_at DESC
          LIMIT 1
        `;
        if (anyTemplateRow) newTemplateId = anyTemplateRow.id;
      }

      // Keep existing template_id if still nothing found
      if (!newTemplateId) newTemplateId = current.template_id;

      await sql(
        `UPDATE assessments
         SET status = 'draft', submitted_at = NULL, updated_at = NOW(),
             template_id = $1
         WHERE id = $2`,
        [newTemplateId, id]
      );

      await logAudit(
        'recall',
        'ttp_data',
        `TTP Data ${id} recalled by ${session.user.name}${reason ? `: ${reason}` : ''}${newTemplateId ? ` — linked to template ${newTemplateId}` : ''}`
      );

      await notifyRoles(
        ['master_admin', 'admin'],
        `TTP Data for ${current.mill_name} has been recalled by ${session.user.name}.`,
        { link: `/assessments/${id}`, entityType: 'assessment', entityId: id }
      );

      const [updated] = await sql`SELECT * FROM assessments WHERE id = ${id}`;
      return Response.json(updated);
    }

    // ── Mill user submit: draft/reopened → submitted ───────────────────────
    if (status === 'submitted' && role === 'mill_user' && current.mill_id !== userMillId) {
      return Response.json(
        { error: 'Forbidden: you can only submit your own mill assessments' },
        { status: 403 }
      );
    }

    // ── Standard transition validation ────────────────────────────────────
    const validTransitions: Record<string, string[]> = {
      draft: ['submitted'],
      submitted: ['under_review', 'approved', 'reopened'],
      under_review: ['approved', 'reopened'],
      reopened: ['submitted'],
      approved: [],
    };
    if (!validTransitions[current.status]?.includes(status)) {
      return Response.json(
        { error: `Cannot transition from '${current.status}' to '${status}'` },
        { status: 400 }
      );
    }

    const [assessment] = await sql`
      UPDATE assessments
      SET
        status = ${status},
        submitted_at = CASE WHEN ${status} = 'submitted' THEN NOW() ELSE submitted_at END,
        approved_at  = CASE WHEN ${status} = 'approved'  THEN NOW() ELSE approved_at  END,
        updated_at   = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    const actionMap: Record<string, string> = {
      submitted: 'submit',
      under_review: 'edit',
      approved: 'approve',
      reopened: 'reopen',
    };
    await logAudit(actionMap[status] ?? 'edit', 'ttp_data', `TTP Data ${id} → ${status}`);

    // Notify admins when mill user submits / resubmits
    if (status === 'submitted' && role === 'mill_user') {
      await notifyRoles(
        ['master_admin', 'admin'],
        `TTP Data for ${current.mill_name} has been submitted by ${session.user.name}.`,
        { link: `/assessments/${id}`, entityType: 'assessment', entityId: id }
      );
    }

    return Response.json(assessment);
  } catch (err: any) {
    console.error('PATCH /api/assessments error:', err);
    return Response.json({ error: err.message || 'Failed to update assessment' }, { status: 500 });
  }
}
