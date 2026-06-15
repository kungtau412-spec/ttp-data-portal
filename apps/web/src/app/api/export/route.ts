import sql from '@/app/api/utils/sql';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

function toCSV(rows: Record<string, any>[], columns: { key: string; header: string }[]): string {
  const headerRow = columns.map((c) => `"${c.header}"`).join(',');
  const dataRows = rows.map((row) =>
    columns
      .map((c) => {
        const val = row[c.key];
        if (val === null || val === undefined) return '""';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      })
      .join(',')
  );
  return [headerRow, ...dataRows].join('\r\n');
}

function csvResponse(csv: string, filename: string): Response {
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const role = (session.user as any)?.role ?? '';
  const isAdmin = ['master_admin', 'admin'].includes(role);
  const millId = (session.user as any)?.mill_id;

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') ?? 'assessments';
  const yearId = searchParams.get('yearId');
  const millFilter = searchParams.get('millId');

  const now = new Date().toISOString().slice(0, 10);

  // ─── Assessments ───
  if (type === 'assessments') {
    const values: any[] = [];
    let query = `
      SELECT
        a.id,
        m.name as mill_name,
        m.code as mill_code,
        m.state,
        m.country,
        y.year,
        a.status,
        a.created_at,
        a.submitted_at,
        a.approved_at,
        (SELECT COUNT(*) FROM supplier_information si WHERE si.assessment_id = a.id)::int as supplier_count,
        (SELECT COUNT(*) FROM evidence_uploads eu WHERE eu.assessment_id = a.id)::int as evidence_count
      FROM assessments a
      JOIN mills m ON a.mill_id = m.id
      JOIN assessment_years y ON a.year_id = y.id
      WHERE 1=1
    `;

    if (!isAdmin) {
      values.push(millId);
      query += ` AND a.mill_id = $${values.length}`;
    } else if (millFilter) {
      values.push(millFilter);
      query += ` AND a.mill_id = $${values.length}`;
    }

    if (yearId) {
      values.push(yearId);
      query += ` AND a.year_id = $${values.length}`;
    }

    query += ` ORDER BY y.year DESC, m.name ASC`;
    const rows = await sql(query, values);

    const csv = toCSV(rows as any[], [
      { key: 'id', header: 'ID' },
      { key: 'mill_name', header: 'Mill Name' },
      { key: 'mill_code', header: 'Mill Code' },
      { key: 'state', header: 'State' },
      { key: 'country', header: 'Country' },
      { key: 'year', header: 'Year' },
      { key: 'status', header: 'Status' },
      { key: 'supplier_count', header: 'Supplier Count' },
      { key: 'evidence_count', header: 'Evidence Files' },
      { key: 'created_at', header: 'Created At' },
      { key: 'submitted_at', header: 'Submitted At' },
      { key: 'approved_at', header: 'Approved At' },
    ]);

    return csvResponse(csv, `assessments_${now}.csv`);
  }

  // ─── Suppliers ─── (updated with new fields)
  if (type === 'suppliers') {
    const values: any[] = [];
    let query = `
      SELECT
        si.id,
        m.name as mill_name,
        m.code as mill_code,
        y.year,
        a.status as assessment_status,
        si.name as supplier_name,
        si.type as supplier_type,
        si.address,
        si.city,
        si.state,
        si.country,
        si.postal_code,
        si.latitude,
        si.longitude,
        si.mpob_license,
        si.certification_status,
        si.volume,
        si.contact_person,
        si.contact_number,
        si.email,
        si.remarks,
        si.created_at
      FROM supplier_information si
      JOIN assessments a ON si.assessment_id = a.id
      JOIN mills m ON a.mill_id = m.id
      JOIN assessment_years y ON a.year_id = y.id
      WHERE 1=1
    `;

    if (!isAdmin) {
      values.push(millId);
      query += ` AND a.mill_id = $${values.length}`;
    } else if (millFilter) {
      values.push(millFilter);
      query += ` AND a.mill_id = $${values.length}`;
    }

    if (yearId) {
      values.push(yearId);
      query += ` AND a.year_id = $${values.length}`;
    }

    query += ` ORDER BY m.name ASC, y.year DESC, si.name ASC`;
    const rows = await sql(query, values);

    const csv = toCSV(rows as any[], [
      { key: 'id', header: 'ID' },
      { key: 'mill_name', header: 'Mill Name' },
      { key: 'mill_code', header: 'Mill Code' },
      { key: 'year', header: 'Year' },
      { key: 'assessment_status', header: 'Assessment Status' },
      { key: 'supplier_name', header: 'Supplier Name' },
      { key: 'supplier_type', header: 'Supplier Type' },
      { key: 'address', header: 'Address' },
      { key: 'city', header: 'City' },
      { key: 'state', header: 'State' },
      { key: 'country', header: 'Country' },
      { key: 'postal_code', header: 'Postal Code' },
      { key: 'latitude', header: 'Latitude' },
      { key: 'longitude', header: 'Longitude' },
      { key: 'mpob_license', header: 'MPOB License' },
      { key: 'certification_status', header: 'Certification Status' },
      { key: 'volume', header: 'Volume (MT)' },
      { key: 'contact_person', header: 'Contact Person' },
      { key: 'contact_number', header: 'Contact Number' },
      { key: 'email', header: 'Email' },
      { key: 'remarks', header: 'Remarks' },
      { key: 'created_at', header: 'Added At' },
    ]);

    return csvResponse(csv, `suppliers_${now}.csv`);
  }

  // ─── Dealer Breakdown ───
  if (type === 'dealers') {
    const values: any[] = [];
    let query = `
      SELECT
        db.id,
        m.name as mill_name,
        m.code as mill_code,
        y.year,
        si.name as supplier_name,
        si.type as supplier_type,
        db.name as dealer_name,
        db.location,
        db.volume,
        db.remarks,
        db.created_at
      FROM dealer_breakdown db
      JOIN supplier_information si ON db.supplier_id = si.id
      JOIN assessments a ON si.assessment_id = a.id
      JOIN mills m ON a.mill_id = m.id
      JOIN assessment_years y ON a.year_id = y.id
      WHERE 1=1
    `;

    if (!isAdmin) {
      values.push(millId);
      query += ` AND a.mill_id = $${values.length}`;
    } else if (millFilter) {
      values.push(millFilter);
      query += ` AND a.mill_id = $${values.length}`;
    }

    if (yearId) {
      values.push(yearId);
      query += ` AND a.year_id = $${values.length}`;
    }

    query += ` ORDER BY m.name ASC, si.name ASC, db.name ASC`;
    const rows = await sql(query, values);

    const csv = toCSV(rows as any[], [
      { key: 'id', header: 'ID' },
      { key: 'mill_name', header: 'Mill Name' },
      { key: 'mill_code', header: 'Mill Code' },
      { key: 'year', header: 'Year' },
      { key: 'supplier_name', header: 'Supplier Name' },
      { key: 'supplier_type', header: 'Supplier Type' },
      { key: 'dealer_name', header: 'Dealer Name' },
      { key: 'location', header: 'Location' },
      { key: 'volume', header: 'Volume (MT)' },
      { key: 'remarks', header: 'Remarks' },
      { key: 'created_at', header: 'Added At' },
    ]);

    return csvResponse(csv, `dealer_breakdown_${now}.csv`);
  }

  // ─── Evidence uploads ───
  if (type === 'evidence') {
    const values: any[] = [];
    let query = `
      SELECT
        eu.id,
        m.name as mill_name,
        m.code as mill_code,
        y.year,
        a.status as assessment_status,
        eu.file_name,
        eu.file_type,
        eu.file_size,
        eu.file_url,
        eu.created_at
      FROM evidence_uploads eu
      JOIN assessments a ON eu.assessment_id = a.id
      JOIN mills m ON a.mill_id = m.id
      JOIN assessment_years y ON a.year_id = y.id
      WHERE 1=1
    `;

    if (!isAdmin) {
      values.push(millId);
      query += ` AND a.mill_id = $${values.length}`;
    } else if (millFilter) {
      values.push(millFilter);
      query += ` AND a.mill_id = $${values.length}`;
    }

    if (yearId) {
      values.push(yearId);
      query += ` AND a.year_id = $${values.length}`;
    }

    query += ` ORDER BY m.name ASC, eu.created_at DESC`;
    const rows = await sql(query, values);

    const csv = toCSV(rows as any[], [
      { key: 'id', header: 'ID' },
      { key: 'mill_name', header: 'Mill Name' },
      { key: 'mill_code', header: 'Mill Code' },
      { key: 'year', header: 'Year' },
      { key: 'assessment_status', header: 'Assessment Status' },
      { key: 'file_name', header: 'File Name' },
      { key: 'file_type', header: 'File Type' },
      { key: 'file_size', header: 'File Size (bytes)' },
      { key: 'file_url', header: 'File URL' },
      { key: 'created_at', header: 'Uploaded At' },
    ]);

    return csvResponse(csv, `evidence_${now}.csv`);
  }

  // ─── Audit Logs — role-based ───
  if (type === 'audit_logs') {
    if (!isAdmin) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const auditValues: any[] = [];
    let auditQuery = `
      SELECT
        l.id,
        u.name as user_name,
        u.email as user_email,
        l.user_role,
        l.action,
        l.target,
        l.details,
        l.old_value,
        l.new_value,
        l.created_at
      FROM audit_logs l
      LEFT JOIN "user" u ON l.user_id = u.id
      WHERE 1=1
    `;

    // Admin: strictly show only admin + mill_user rows.
    // NULL user_role hidden from admin (unknown origin — could be master_admin).
    if (role === 'admin') {
      auditQuery += ` AND l.user_role IN ('admin', 'mill_user')`;
    }
    // master_admin sees everything (no extra clause)

    auditQuery += ` ORDER BY l.created_at DESC LIMIT 5000`;
    const rows = await sql(auditQuery, auditValues);

    const csv = toCSV(rows as any[], [
      { key: 'id', header: 'ID' },
      { key: 'created_at', header: 'Timestamp' },
      { key: 'user_name', header: 'Performed By' },
      { key: 'user_email', header: 'User Email' },
      { key: 'user_role', header: 'Role' },
      { key: 'action', header: 'Action' },
      { key: 'target', header: 'Target' },
      { key: 'details', header: 'Details' },
      { key: 'old_value', header: 'Old Value' },
      { key: 'new_value', header: 'New Value' },
    ]);

    return csvResponse(csv, `audit_logs_${now}.csv`);
  }

  return Response.json({ error: `Unknown export type: ${type}` }, { status: 400 });
}
