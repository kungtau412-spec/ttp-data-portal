import sql from '@/app/api/utils/sql';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { logAudit } from '../utils/audit';

function getRole(session: any): string {
  return (session?.user as any)?.role ?? '';
}

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const years = await sql`
    SELECT ay.*,
      (SELECT COUNT(*) FROM assessments a WHERE a.year_id = ay.id) as assessment_count,
      (
        SELECT row_to_json(t)
        FROM (
          SELECT at.id, at.name, at.version_number, at.status
          FROM assessment_templates at
          WHERE at.year_id = ay.id AND at.status = 'published'
          ORDER BY at.version_number DESC, at.created_at DESC
          LIMIT 1
        ) t
      ) as assigned_template
    FROM assessment_years ay
    ORDER BY ay.year DESC
  `;
  return Response.json(years);
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const role = getRole(session);
  if (role !== 'master_admin') {
    return Response.json(
      { error: 'Forbidden: only Master Admin can create assessment years' },
      { status: 403 }
    );
  }

  try {
    const {
      year,
      start_date,
      end_date,
      status = 'active',
      extension_reason,
    } = await request.json();

    if (!year || !start_date || !end_date) {
      return Response.json(
        { error: 'Year, start date, and end date are required' },
        { status: 400 }
      );
    }

    const parsedYear = parseInt(year, 10);
    if (isNaN(parsedYear) || parsedYear < 2000 || parsedYear > 2100) {
      return Response.json(
        { error: 'Year must be a valid number between 2000 and 2100' },
        { status: 400 }
      );
    }

    const existing = await sql`SELECT id FROM assessment_years WHERE year = ${parsedYear}`;
    if (existing.length > 0) {
      return Response.json(
        { error: `Assessment year ${parsedYear} already exists` },
        { status: 400 }
      );
    }

    const [newYear] = await sql`
      INSERT INTO assessment_years (year, start_date, end_date, status, extension_reason)
      VALUES (${parsedYear}, ${start_date}, ${end_date}, ${status}, ${extension_reason || null})
      RETURNING *
    `;

    await logAudit('create', 'ttp_year', `Created TTP year ${parsedYear}`);
    return Response.json(newYear, { status: 201 });
  } catch (err: any) {
    console.error('POST /api/years error:', err);
    return Response.json({ error: err.message || 'Failed to create year' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const role = getRole(session);
  if (role !== 'master_admin') {
    return Response.json(
      { error: 'Forbidden: only Master Admin can edit assessment years' },
      { status: 403 }
    );
  }

  try {
    const { id, start_date, end_date, status, extension_reason, template_id } =
      await request.json();

    if (!id) return Response.json({ error: 'Year ID is required' }, { status: 400 });

    // ── Optional: assign a published template to this year ────────────────
    if (template_id !== undefined) {
      if (template_id === null) {
        // Unlink: clear year_id from any templates currently linked to this year
        await sql(
          `UPDATE assessment_templates SET year_id = NULL, updated_at = CURRENT_TIMESTAMP
           WHERE year_id = $1`,
          [id]
        );
      } else {
        // Link: set year_id on the chosen template
        // First verify the template exists and is published
        const [tmpl] = await sql(`SELECT id, status FROM assessment_templates WHERE id = $1`, [
          template_id,
        ]);
        if (!tmpl) {
          return Response.json({ error: 'Template not found' }, { status: 404 });
        }
        if (tmpl.status !== 'published') {
          return Response.json(
            { error: 'Only published templates can be assigned to a year' },
            { status: 400 }
          );
        }
        // Unlink any previously assigned template for this year first
        await sql(
          `UPDATE assessment_templates SET year_id = NULL, updated_at = CURRENT_TIMESTAMP
           WHERE year_id = $1 AND id != $2`,
          [id, template_id]
        );
        // Link the new one
        await sql(
          `UPDATE assessment_templates SET year_id = $1, updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [id, template_id]
        );
        await logAudit(
          'edit',
          'ttp_year',
          `Assigned template ID ${template_id} to TTP year ID ${id}`
        );
      }

      // If only template assignment was requested (no date/status), return early
      if (start_date === undefined && end_date === undefined && status === undefined) {
        const [updatedYear] = await sql(
          `SELECT ay.*,
            (SELECT COUNT(*) FROM assessments a WHERE a.year_id = ay.id) as assessment_count
           FROM assessment_years ay WHERE ay.id = $1`,
          [id]
        );
        return Response.json(updatedYear);
      }
    }

    const [updatedYear] = await sql`
      UPDATE assessment_years
      SET start_date = ${start_date},
          end_date = ${end_date},
          status = ${status},
          extension_reason = ${extension_reason || null}
      WHERE id = ${id}
      RETURNING *
    `;

    if (!updatedYear) return Response.json({ error: 'Assessment year not found' }, { status: 404 });

    await logAudit('edit', 'ttp_year', `Updated TTP year ID ${id} to status: ${status}`);
    return Response.json(updatedYear);
  } catch (err: any) {
    console.error('PATCH /api/years error:', err);
    return Response.json({ error: err.message || 'Failed to update year' }, { status: 500 });
  }
}
