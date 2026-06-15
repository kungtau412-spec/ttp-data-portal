import sql from '@/app/api/utils/sql';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { logAudit } from '@/app/api/utils/audit';
import { notifyRoles } from '@/app/api/utils/notify';

/**
 * Shared helper — attaches `template: { id, sections }` to any assessment object.
 *
 * Resolution order:
 *   1. assessment.template_id (already linked)
 *   2. Latest published template matching assessment.year_id  (year-specific)
 *   3. Any latest published template regardless of year      (global fallback)
 *
 * When resolved via fallback (2 or 3), the assessment row is immediately updated
 * in the DB so every subsequent request skips the fallback lookup.
 */
export async function hydrateAssessmentTemplate(assessment: any): Promise<void> {
  let resolvedTemplateId = assessment.template_id ?? null;

  // ── Fallback 1: year-specific published template ──────────────────────────
  if (!resolvedTemplateId && assessment.year_id) {
    const [byYear] = await sql(
      `SELECT id FROM assessment_templates
       WHERE status = 'published' AND year_id = $1
       ORDER BY version_number DESC, created_at DESC
       LIMIT 1`,
      [assessment.year_id]
    );
    if (byYear) resolvedTemplateId = byYear.id;
  }

  // ── Fallback 2: ANY latest published template (year-agnostic) ─────────────
  if (!resolvedTemplateId) {
    const [anyTemplate] = await sql`
      SELECT id FROM assessment_templates
      WHERE status = 'published'
      ORDER BY version_number DESC, created_at DESC
      LIMIT 1
    `;
    if (anyTemplate) resolvedTemplateId = anyTemplate.id;
  }

  if (!resolvedTemplateId) return; // no published template anywhere — leave template undefined

  // ── Auto-link: persist resolved template_id so future GETs skip fallback ──
  if (!assessment.template_id && resolvedTemplateId) {
    try {
      await sql(`UPDATE assessments SET template_id = $1, updated_at = NOW() WHERE id = $2`, [
        resolvedTemplateId,
        assessment.id,
      ]);
      assessment.template_id = resolvedTemplateId;
    } catch (e) {
      // Non-fatal — the template still gets embedded in the response this request
      console.warn('[hydrateAssessmentTemplate] Could not auto-link template_id:', e);
    }
  }

  // ── Fetch sections + fields ───────────────────────────────────────────────
  const sections = await sql(
    `SELECT * FROM template_sections
     WHERE template_id = $1
     ORDER BY sort_order, id`,
    [resolvedTemplateId]
  );

  for (const section of sections) {
    const fields = await sql(
      `SELECT * FROM template_fields
       WHERE section_id = $1
       ORDER BY sort_order, id`,
      [section.id]
    );
    (section as any).fields = fields;
  }

  assessment.template = { id: resolvedTemplateId, sections };
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const role = (session.user as any)?.role ?? '';
  const userMillId = (session.user as any)?.mill_id;

  const [assessment] = await sql`
    SELECT a.*, m.name as mill_name, m.code as mill_code, y.year,
      (SELECT COUNT(*) FROM supplier_information si WHERE si.assessment_id = a.id) as supplier_count,
      (SELECT COUNT(*) FROM evidence_uploads eu WHERE eu.assessment_id = a.id) as evidence_count
    FROM assessments a
    JOIN mills m ON a.mill_id = m.id
    JOIN assessment_years y ON a.year_id = y.id
    WHERE a.id = ${id}
  `;

  if (!assessment) return Response.json({ error: 'Assessment not found' }, { status: 404 });

  if (role === 'mill_user' && assessment.mill_id !== userMillId) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  await hydrateAssessmentTemplate(assessment);

  return Response.json(assessment);
}

/**
 * PATCH /api/assessments/[id]
 * Handles special actions:
 *   { action: 'recall' }               — mill user recalls a submitted assessment → draft
 *   { action: 'request_reopen', reason: string }  — mill user requests reopen of approved assessment
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const role = (session.user as any)?.role ?? '';
  const userMillId = (session.user as any)?.mill_id;

  // ── Recall Submission: submitted → draft (mill user only) ────────────────
  if (body.action === 'recall') {
    if (role !== 'mill_user') {
      return Response.json(
        { error: 'Forbidden: only mill users can recall a submission' },
        { status: 403 }
      );
    }

    const [current] = await sql`
      SELECT a.*, m.name as mill_name, m.code as mill_code, y.year
      FROM assessments a
      JOIN mills m ON a.mill_id = m.id
      JOIN assessment_years y ON a.year_id = y.id
      WHERE a.id = ${id}
    `;
    if (!current) return Response.json({ error: 'Assessment not found' }, { status: 404 });

    if (current.mill_id !== userMillId) {
      return Response.json(
        { error: 'Forbidden: you can only recall your own assessments' },
        { status: 403 }
      );
    }
    if (current.status !== 'submitted') {
      return Response.json(
        { error: `Cannot recall: assessment is '${current.status}', not 'submitted'` },
        { status: 400 }
      );
    }

    // Re-link to the latest published template for this year (handles null template_id)
    // Fallback 1: year-specific published template
    const [activeTemplate] = await sql(
      `SELECT id FROM assessment_templates
       WHERE status = 'published' AND year_id = $1
       ORDER BY version_number DESC, created_at DESC
       LIMIT 1`,
      [current.year_id]
    );

    let newTemplateId = activeTemplate ? activeTemplate.id : null;

    // Fallback 2: any published template (year-agnostic)
    if (!newTemplateId) {
      const [anyTemplate] = await sql`
        SELECT id FROM assessment_templates
        WHERE status = 'published'
        ORDER BY version_number DESC, created_at DESC
        LIMIT 1
      `;
      if (anyTemplate) newTemplateId = anyTemplate.id;
    }

    // Keep existing if still nothing found
    if (!newTemplateId) newTemplateId = current.template_id;

    // Update status + re-link template atomically
    await sql(
      `UPDATE assessments
       SET status = 'draft',
           submitted_at = NULL,
           updated_at   = NOW(),
           template_id  = $1
       WHERE id = $2`,
      [newTemplateId, id]
    );

    // Re-fetch the full assessment row with joins for a consistent response shape
    const [updated] = await sql`
      SELECT a.*, m.name as mill_name, m.code as mill_code, y.year,
        (SELECT COUNT(*) FROM supplier_information si WHERE si.assessment_id = a.id) as supplier_count,
        (SELECT COUNT(*) FROM evidence_uploads eu WHERE eu.assessment_id = a.id) as evidence_count
      FROM assessments a
      JOIN mills m ON a.mill_id = m.id
      JOIN assessment_years y ON a.year_id = y.id
      WHERE a.id = ${id}
    `;

    // Hydrate the template so the frontend gets the full assessment in one shot —
    // no cache-merging or secondary refetch needed.
    await hydrateAssessmentTemplate(updated);

    await logAudit(
      'recall',
      'ttp_data',
      `TTP Data ${id} recalled by ${session.user.name}${newTemplateId ? ` — linked to template ${newTemplateId}` : ''}`
    );

    await notifyRoles(
      ['master_admin', 'admin'],
      `TTP Data for ${current.mill_name} has been recalled by ${session.user.name}.`,
      { link: `/assessments/${id}`, entityType: 'assessment', entityId: parseInt(id) }
    );

    return Response.json(updated);
  }

  // ── Request Reopen (approved assessment) ──────────────────────────────────
  if (body.action === 'request_reopen') {
    if (role !== 'mill_user') {
      return Response.json(
        { error: 'Forbidden: only mill users can request reopen' },
        { status: 403 }
      );
    }
    if (!body.reason?.trim()) {
      return Response.json({ error: 'A reason is required to request reopen' }, { status: 400 });
    }

    const [assessment] = await sql`
      SELECT a.*, m.name as mill_name FROM assessments a
      JOIN mills m ON a.mill_id = m.id
      WHERE a.id = ${id}
    `;
    if (!assessment) return Response.json({ error: 'Assessment not found' }, { status: 404 });
    if (assessment.mill_id !== userMillId) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (assessment.status !== 'approved') {
      return Response.json(
        { error: 'Only approved assessments can be requested for reopen' },
        { status: 400 }
      );
    }

    // Insert reopen request
    await sql(
      `INSERT INTO reopen_requests (assessment_id, requested_by, reason)
       VALUES ($1, $2, $3)`,
      [id, session.user.id, body.reason.trim()]
    );

    await logAudit(
      'request_reopen',
      'ttp_data',
      `TTP Data ${id} reopen requested by ${session.user.name}: ${body.reason}`
    );

    await notifyRoles(
      ['master_admin', 'admin'],
      `${session.user.name} has requested to reopen the approved TTP Data entry for ${assessment.mill_name}. Reason: ${body.reason}`,
      { link: `/assessments/${id}`, entityType: 'assessment', entityId: parseInt(id) }
    );

    return Response.json({ success: true, message: 'Reopen request submitted to administrators.' });
  }

  return Response.json({ error: 'Unknown action' }, { status: 400 });
}
