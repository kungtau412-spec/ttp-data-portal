import sql from '@/app/api/utils/sql';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { logAudit } from '../utils/audit';

// ─── Region helpers ────────────────────────────────────────────────────────
const EAST_STATES = new Set(['Sabah', 'Sarawak', 'Labuan']);

export function computeRegion(state: string | null | undefined): 'east' | 'west' | null {
  if (!state) return null;
  return EAST_STATES.has(state) ? 'east' : 'west';
}

// ─── Supplier type → category mapping ─────────────────────────────────────
// dealer            → Dealer
// collection_centre → External Supplier
// estate            → In-House
// smallholder       → Smallholder
// external_supplier → External Supplier
// in_house          → In-House

function getRole(session: any): string {
  return (session?.user as any)?.role ?? '';
}

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const stateParam = searchParams.get('state');
  const countryParam = searchParams.get('country');
  const regionParam = searchParams.get('region'); // 'east' | 'west'

  const values: any[] = [];
  let whereClause = 'WHERE 1=1';

  if (countryParam) {
    values.push(countryParam);
    whereClause += ` AND m.country = $${values.length}`;
  }

  if (stateParam) {
    const states = stateParam
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (states.length > 0) {
      const placeholders = states.map((_, i) => `$${values.length + i + 1}`).join(', ');
      states.forEach((s) => values.push(s));
      whereClause += ` AND m.state IN (${placeholders})`;
    }
  }

  if (regionParam === 'east') {
    whereClause += ` AND COALESCE(m.region, CASE WHEN m.state IN ('Sabah','Sarawak','Labuan') THEN 'east' ELSE 'west' END) = 'east'`;
  } else if (regionParam === 'west') {
    whereClause += ` AND COALESCE(m.region, CASE WHEN m.state IN ('Sabah','Sarawak','Labuan') THEN 'east' ELSE 'west' END) = 'west'`;
  }

  const query = `
    SELECT
      m.*,
      -- effective region (stored override or computed from state)
      COALESCE(m.region, CASE WHEN m.state IN ('Sabah','Sarawak','Labuan') THEN 'east' ELSE 'west' END) AS effective_region,
      COALESCE(u.user_count, 0)       AS user_count,
      COALESCE(a.assessment_count, 0) AS assessment_count,
      -- Category-mapped supplier counts:
      -- Smallholder: type = 'smallholder'
      -- Dealer:      type = 'dealer'
      -- External Supplier: type IN ('external_supplier', 'collection_centre')
      -- In-House:    type IN ('in_house', 'estate')
      COALESCE(sc.smallholder_count, 0)       AS smallholder_count,
      COALESCE(sc.dealer_count, 0)            AS dealer_count,
      COALESCE(sc.external_supplier_count, 0) AS external_supplier_count,
      COALESCE(sc.in_house_count, 0)          AS in_house_count,
      COALESCE(sc.total_supplier_count, 0)    AS total_supplier_count,
      COALESCE(sc.total_volume, 0)            AS total_volume
    FROM mills m
    LEFT JOIN (
      SELECT mill_id, COUNT(*) AS user_count
      FROM "user" WHERE mill_id IS NOT NULL GROUP BY mill_id
    ) u ON u.mill_id = m.id
    LEFT JOIN (
      SELECT mill_id, COUNT(*) AS assessment_count
      FROM assessments GROUP BY mill_id
    ) a ON a.mill_id = m.id
    LEFT JOIN (
      SELECT
        ass.mill_id,
        COUNT(*) FILTER (WHERE si.type = 'smallholder')                               AS smallholder_count,
        COUNT(*) FILTER (WHERE si.type = 'dealer')                                    AS dealer_count,
        COUNT(*) FILTER (WHERE si.type IN ('external_supplier','collection_centre'))  AS external_supplier_count,
        COUNT(*) FILTER (WHERE si.type IN ('in_house','estate'))                      AS in_house_count,
        COUNT(*) FILTER (WHERE si.type IN ('smallholder','dealer','external_supplier','collection_centre','in_house','estate')) AS total_supplier_count,
        COALESCE(SUM(si.volume), 0)                                                   AS total_volume
      FROM supplier_information si
      JOIN assessments ass ON si.assessment_id = ass.id
      GROUP BY ass.mill_id
    ) sc ON sc.mill_id = m.id
    ${whereClause}
    ORDER BY m.name ASC
  `;

  const mills = await sql(query, values);
  return Response.json(mills);
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const role = getRole(session);
  if (!['master_admin', 'admin'].includes(role)) {
    return Response.json({ error: 'Forbidden: only admins can create mills' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { name, code, state, country, latitude, longitude, region: regionOverride } = body;

    if (!name || !code) {
      return Response.json({ error: 'Mill name and code are required' }, { status: 400 });
    }
    if (!state) {
      return Response.json({ error: 'State is required' }, { status: 400 });
    }
    if (!country) {
      return Response.json({ error: 'Country is required' }, { status: 400 });
    }
    if (!latitude) {
      return Response.json({ error: 'Latitude is required' }, { status: 400 });
    }
    if (!longitude) {
      return Response.json({ error: 'Longitude is required' }, { status: 400 });
    }

    const existing = await sql`SELECT id FROM mills WHERE code = ${code}`;
    if (existing.length > 0) {
      return Response.json({ error: `Mill code "${code}" already exists` }, { status: 400 });
    }

    // Determine region: master_admin can override, otherwise auto-compute
    const autoRegion = computeRegion(state);
    const finalRegion = role === 'master_admin' && regionOverride ? regionOverride : autoRegion;

    const [mill] = await sql`
      INSERT INTO mills (name, code, state, country, latitude, longitude, region)
      VALUES (${name}, ${code}, ${state}, ${country}, ${latitude}, ${longitude}, ${finalRegion})
      RETURNING *
    `;

    await logAudit(
      'create',
      'mill',
      `Created mill: ${name} (${code})`,
      undefined,
      `state=${state}, region=${finalRegion}, country=${country}`
    );
    return Response.json(mill, { status: 201 });
  } catch (err: any) {
    console.error('POST /api/mills error:', err);
    return Response.json({ error: err.message || 'Failed to create mill' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const role = getRole(session);
  if (!['master_admin', 'admin'].includes(role)) {
    return Response.json({ error: 'Forbidden: only admins can edit mills' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { id, name, code, state, country, latitude, longitude, region: regionOverride } = body;

    if (!id) return Response.json({ error: 'Mill ID is required' }, { status: 400 });
    if (!state) return Response.json({ error: 'State is required' }, { status: 400 });
    if (!country) return Response.json({ error: 'Country is required' }, { status: 400 });
    if (!latitude) return Response.json({ error: 'Latitude is required' }, { status: 400 });
    if (!longitude) return Response.json({ error: 'Longitude is required' }, { status: 400 });

    const codeConflict = await sql`SELECT id FROM mills WHERE code = ${code} AND id != ${id}`;
    if (codeConflict.length > 0) {
      return Response.json(
        { error: `Mill code "${code}" is already used by another mill` },
        { status: 400 }
      );
    }

    // Fetch old values for audit
    const [old] = await sql`SELECT * FROM mills WHERE id = ${id}`;
    if (!old) return Response.json({ error: 'Mill not found' }, { status: 404 });

    // Determine region: master_admin can override, otherwise auto-compute from state
    const autoRegion = computeRegion(state);
    const finalRegion = role === 'master_admin' && regionOverride ? regionOverride : autoRegion;

    const [mill] = await sql`
      UPDATE mills
      SET name = ${name}, code = ${code}, state = ${state}, country = ${country},
          latitude = ${latitude}, longitude = ${longitude}, region = ${finalRegion}
      WHERE id = ${id}
      RETURNING *
    `;

    // Log changes with old/new values
    const changes: string[] = [];
    if (old.state !== state) changes.push(`state: ${old.state} → ${state}`);
    if ((old.region || computeRegion(old.state)) !== finalRegion)
      changes.push(`region: ${old.region || computeRegion(old.state)} → ${finalRegion}`);
    if (old.name !== name) changes.push(`name: ${old.name} → ${name}`);
    if (old.code !== code) changes.push(`code: ${old.code} → ${code}`);

    const oldSnap = `state=${old.state}, region=${old.region || computeRegion(old.state)}, name=${old.name}`;
    const newSnap = `state=${state}, region=${finalRegion}, name=${name}`;

    await logAudit(
      'edit',
      'mill',
      `Updated mill: ${name} (${code})${changes.length ? ' — ' + changes.join(', ') : ''}`,
      oldSnap,
      newSnap
    );

    // Extra targeted audit entries for state/region changes
    if (old.state !== state) {
      await logAudit(
        'state_change',
        'mill',
        `Mill "${name}" state changed`,
        old.state || '(none)',
        state
      );
    }
    if ((old.region || computeRegion(old.state)) !== finalRegion) {
      await logAudit(
        'region_change',
        'mill',
        `Mill "${name}" region changed`,
        old.region || computeRegion(old.state) || '(none)',
        finalRegion || '(none)'
      );
    }

    return Response.json(mill);
  } catch (err: any) {
    console.error('PATCH /api/mills error:', err);
    return Response.json({ error: err.message || 'Failed to update mill' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const role = getRole(session);
  if (role !== 'master_admin') {
    return Response.json(
      { error: 'Forbidden: only Master Admin can delete mills' },
      { status: 403 }
    );
  }

  try {
    const { id } = await request.json();
    if (!id) return Response.json({ error: 'Mill ID is required' }, { status: 400 });

    const linked = await sql`SELECT id FROM assessments WHERE mill_id = ${id} LIMIT 1`;
    if (linked.length > 0) {
      return Response.json(
        { error: 'Cannot delete a mill that has existing assessments' },
        { status: 400 }
      );
    }

    const [mill] = await sql`DELETE FROM mills WHERE id = ${id} RETURNING *`;
    if (!mill) return Response.json({ error: 'Mill not found' }, { status: 404 });

    await logAudit('delete', 'mill', `Deleted mill: ${mill.name} (${mill.code})`);
    return Response.json({ success: true });
  } catch (err: any) {
    console.error('DELETE /api/mills error:', err);
    return Response.json({ error: err.message || 'Failed to delete mill' }, { status: 500 });
  }
}
