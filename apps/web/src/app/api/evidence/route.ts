import sql from '@/app/api/utils/sql';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { logAudit } from '../utils/audit';

function getRole(session: any): string {
  return (session?.user as any)?.role ?? '';
}

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const assessmentId = searchParams.get('assessmentId');
  if (!assessmentId) return Response.json({ error: 'Missing assessmentId' }, { status: 400 });

  const evidence = await sql`
    SELECT * FROM evidence_uploads
    WHERE assessment_id = ${assessmentId}
    ORDER BY created_at DESC
  `;

  return Response.json(evidence);
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { assessment_id, file_name, file_url, file_type, file_size } = await request.json();

    if (!assessment_id || !file_url || !file_name) {
      return Response.json(
        { error: 'assessment_id, file_name, and file_url are required' },
        { status: 400 }
      );
    }

    // Verify the assessment exists and belongs to this user (if mill_user)
    const role = getRole(session);
    const millId = (session.user as any)?.mill_id;

    const [assessment] =
      await sql`SELECT id, mill_id, status FROM assessments WHERE id = ${assessment_id}`;
    if (!assessment) return Response.json({ error: 'Assessment not found' }, { status: 404 });

    if (role === 'mill_user' && assessment.mill_id !== millId) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!['draft', 'reopened'].includes(assessment.status)) {
      return Response.json(
        { error: 'Evidence can only be uploaded to draft or reopened assessments' },
        { status: 400 }
      );
    }

    const [evidence] = await sql`
      INSERT INTO evidence_uploads (assessment_id, file_name, file_url, file_type, file_size)
      VALUES (${assessment_id}, ${file_name}, ${file_url}, ${file_type || 'unknown'}, ${file_size || 0})
      RETURNING *
    `;

    await logAudit(
      'upload',
      'evidence',
      `Uploaded file: ${file_name} to assessment ${assessment_id}`
    );
    return Response.json(evidence, { status: 201 });
  } catch (err: any) {
    console.error('POST /api/evidence error:', err);
    return Response.json({ error: err.message || 'Failed to save evidence' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await request.json();
    if (!id) return Response.json({ error: 'Evidence ID required' }, { status: 400 });

    const [evidence] = await sql`DELETE FROM evidence_uploads WHERE id = ${id} RETURNING *`;
    if (!evidence) return Response.json({ error: 'Evidence not found' }, { status: 404 });

    await logAudit('delete', 'evidence', `Deleted file: ${evidence.file_name}`);
    return Response.json({ success: true });
  } catch (err: any) {
    console.error('DELETE /api/evidence error:', err);
    return Response.json({ error: err.message || 'Failed to delete evidence' }, { status: 500 });
  }
}
