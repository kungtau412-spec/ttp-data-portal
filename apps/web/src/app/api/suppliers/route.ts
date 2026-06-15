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

  const suppliers = await sql`
    SELECT * FROM supplier_information
    WHERE assessment_id = ${assessmentId}
    ORDER BY created_at ASC
  `;

  const suppliersWithBreakdown = await Promise.all(
    suppliers.map(async (s) => {
      if (['dealer', 'collection_centre'].includes(s.type)) {
        const breakdown = await sql`
          SELECT * FROM dealer_breakdown WHERE supplier_id = ${s.id} ORDER BY id ASC
        `;
        return { ...s, breakdown };
      }
      return { ...s, breakdown: [] };
    })
  );

  return Response.json(suppliersWithBreakdown);
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const {
      assessment_id,
      name,
      type,
      latitude,
      longitude,
      volume,
      address,
      city,
      state,
      country,
      postal_code,
      mpob_license,
      certification_status,
      contact_person,
      contact_number,
      email,
      remarks,
      custom_fields,
      breakdown,
    } = body;

    if (!assessment_id || !name || !type) {
      return Response.json(
        { error: 'assessment_id, name, and type are required' },
        { status: 400 }
      );
    }

    const role = getRole(session);
    const userMillId = (session.user as any)?.mill_id;

    const [assessment] = await sql`
      SELECT id, mill_id, status FROM assessments WHERE id = ${assessment_id}
    `;
    if (!assessment) return Response.json({ error: 'Assessment not found' }, { status: 404 });

    if (role === 'mill_user' && assessment.mill_id !== userMillId) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!['draft', 'reopened'].includes(assessment.status)) {
      return Response.json(
        { error: 'Suppliers can only be added to draft or reopened assessments' },
        { status: 400 }
      );
    }

    const certStatus = certification_status || 'NONE';
    const customFieldsJson = custom_fields ? JSON.stringify(custom_fields) : '{}';

    const [supplier] = await sql`
      INSERT INTO supplier_information
        (assessment_id, name, type, latitude, longitude, volume,
         address, city, state, country, postal_code,
         mpob_license, certification_status,
         contact_person, contact_number, email, remarks, custom_fields)
      VALUES (
        ${assessment_id}, ${name}, ${type},
        ${latitude || null}, ${longitude || null}, ${volume || null},
        ${address || null}, ${city || null}, ${state || null}, ${country || null}, ${postal_code || null},
        ${mpob_license || null}, ${certStatus},
        ${contact_person || null}, ${contact_number || null}, ${email || null}, ${remarks || null},
        ${customFieldsJson}
      )
      RETURNING *
    `;

    if (['dealer', 'collection_centre'].includes(type) && Array.isArray(breakdown)) {
      for (const b of breakdown) {
        if (b.name?.trim()) {
          await sql`
            INSERT INTO dealer_breakdown (supplier_id, name, location, volume, remarks)
            VALUES (${supplier.id}, ${b.name}, ${b.location || null}, ${b.volume || null}, ${b.remarks || null})
          `;
        }
      }
    }

    const newSnapshot = `name=${name}, type=${type}, cert=${certStatus}, volume=${volume || 0}`;
    await logAudit(
      'create',
      'supplier',
      `Added supplier: ${name} (${type}) to assessment ${assessment_id}`,
      undefined,
      newSnapshot
    );

    const breakdownRows = ['dealer', 'collection_centre'].includes(type)
      ? await sql`SELECT * FROM dealer_breakdown WHERE supplier_id = ${supplier.id} ORDER BY id ASC`
      : [];

    return Response.json({ ...supplier, breakdown: breakdownRows }, { status: 201 });
  } catch (err: any) {
    console.error('POST /api/suppliers error:', err);
    return Response.json({ error: err.message || 'Failed to add supplier' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { supplier_id, breakdown } = await request.json();
    if (!supplier_id) return Response.json({ error: 'supplier_id required' }, { status: 400 });

    await sql`DELETE FROM dealer_breakdown WHERE supplier_id = ${supplier_id}`;

    const inserted: any[] = [];
    if (Array.isArray(breakdown)) {
      for (const b of breakdown) {
        if (b.name?.trim()) {
          const [row] = await sql`
            INSERT INTO dealer_breakdown (supplier_id, name, location, volume, remarks)
            VALUES (${supplier_id}, ${b.name}, ${b.location || null}, ${b.volume || null}, ${b.remarks || null})
            RETURNING *
          `;
          inserted.push(row);
        }
      }
    }

    return Response.json(inserted);
  } catch (err: any) {
    console.error('PUT /api/suppliers error:', err);
    return Response.json({ error: err.message || 'Failed to update breakdown' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await request.json();
    if (!id) return Response.json({ error: 'Supplier ID required' }, { status: 400 });

    const [deleted] = await sql`
      DELETE FROM supplier_information WHERE id = ${id}
      RETURNING name, type, certification_status, volume
    `;
    if (!deleted) return Response.json({ error: 'Supplier not found' }, { status: 404 });

    const oldSnapshot = `name=${deleted.name}, type=${deleted.type}, cert=${deleted.certification_status}, volume=${deleted.volume}`;
    await logAudit(
      'delete',
      'supplier',
      `Removed supplier: ${deleted.name} (${deleted.type})`,
      oldSnapshot,
      undefined
    );
    return Response.json({ success: true });
  } catch (err: any) {
    console.error('DELETE /api/suppliers error:', err);
    return Response.json({ error: err.message || 'Failed to delete supplier' }, { status: 500 });
  }
}
