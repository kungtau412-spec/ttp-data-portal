import sql from '@/app/api/utils/sql';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const userRole = (session.user as any).role || 'mill_user';
  const userMillId = (session.user as any).mill_id;
  const isAdmin = ['master_admin', 'admin'].includes(userRole);

  // Filter params (Issue 8)
  const { searchParams } = new URL(request.url);
  const _filterMillId = searchParams.get('millId');
  const _filterYearId = searchParams.get('yearId');
  const _filterRegion = searchParams.get('region');
  const _filterState = searchParams.get('state');
  const _filterCategory = searchParams.get('category');

  let counts;
  if (userRole === 'mill_user' && userMillId) {
    const [row] = await sql(
      `SELECT
        (SELECT COUNT(*) FROM mills) as total_mills,
        (SELECT COUNT(*) FROM assessments WHERE mill_id = $1) as total_assessments,
        (SELECT COUNT(*) FROM assessments WHERE status = 'submitted' AND mill_id = $1) as submitted_assessments,
        (SELECT COUNT(*) FROM assessments WHERE status = 'draft' AND mill_id = $1) as pending_assessments,
        (SELECT COUNT(*) FROM assessments WHERE status = 'approved' AND mill_id = $1) as approved_assessments,
        (SELECT COUNT(*) FROM assessments WHERE status = 'under_review' AND mill_id = $1) as under_review_assessments,
        (SELECT COUNT(*) FROM supplier_information si JOIN assessments a ON si.assessment_id = a.id WHERE a.mill_id = $1) as total_suppliers,
        (SELECT COUNT(*) FROM evidence_uploads eu JOIN assessments a ON eu.assessment_id = a.id WHERE a.mill_id = $1) as total_evidence,
        0 as total_users`,
      [userMillId]
    );
    counts = row;
  } else {
    const [row] = await sql`
      SELECT
        (SELECT COUNT(*) FROM mills) as total_mills,
        (SELECT COUNT(*) FROM assessments) as total_assessments,
        (SELECT COUNT(*) FROM assessments WHERE status = 'submitted') as submitted_assessments,
        (SELECT COUNT(*) FROM assessments WHERE status = 'draft') as pending_assessments,
        (SELECT COUNT(*) FROM assessments WHERE status = 'approved') as approved_assessments,
        (SELECT COUNT(*) FROM assessments WHERE status = 'under_review') as under_review_assessments,
        (SELECT COUNT(*) FROM supplier_information) as total_suppliers,
        (SELECT COUNT(*) FROM evidence_uploads) as total_evidence,
        (SELECT COUNT(*) FROM "user") as total_users
    `;
    counts = row;
  }

  // Status breakdown for pie chart
  const statusBreakdown = await sql`
    SELECT status, COUNT(*)::int as count
    FROM assessments
    GROUP BY status ORDER BY count DESC
  `;

  // Assessments per mill with status breakdown (admin only)
  let assessmentsByMill: any[] = [];
  if (isAdmin) {
    assessmentsByMill = await sql`
      SELECT
        m.name as mill_name,
        m.code as mill_code,
        COUNT(a.id)::int as total,
        COUNT(CASE WHEN a.status = 'draft' THEN 1 END)::int as draft,
        COUNT(CASE WHEN a.status = 'submitted' THEN 1 END)::int as submitted,
        COUNT(CASE WHEN a.status = 'under_review' THEN 1 END)::int as under_review,
        COUNT(CASE WHEN a.status = 'approved' THEN 1 END)::int as approved,
        COUNT(CASE WHEN a.status = 'reopened' THEN 1 END)::int as reopened
      FROM mills m
      LEFT JOIN assessments a ON a.mill_id = m.id
      GROUP BY m.id, m.name, m.code
      ORDER BY total DESC
      LIMIT 12
    `;
  }

  // Suppliers by category (with type→category mapping: collection_centre→external_supplier, estate→in_house)
  let suppliersByType: any[] = [];
  if (isAdmin) {
    suppliersByType = await sql`
      SELECT
        CASE
          WHEN type IN ('external_supplier','collection_centre') THEN 'external_supplier'
          WHEN type IN ('in_house','estate') THEN 'in_house'
          ELSE type
        END AS type,
        COUNT(*)::int as count,
        COALESCE(SUM(volume), 0)::numeric(15,2) as total_volume
      FROM supplier_information
      WHERE type IN ('smallholder','dealer','external_supplier','collection_centre','in_house','estate')
      GROUP BY 1 ORDER BY count DESC
    `;
  } else if (userMillId) {
    suppliersByType = await sql`
      SELECT
        CASE
          WHEN si.type IN ('external_supplier','collection_centre') THEN 'external_supplier'
          WHEN si.type IN ('in_house','estate') THEN 'in_house'
          ELSE si.type
        END AS type,
        COUNT(*)::int as count,
        COALESCE(SUM(si.volume), 0)::numeric(15,2) as total_volume
      FROM supplier_information si
      JOIN assessments a ON si.assessment_id = a.id
      WHERE a.mill_id = ${userMillId}
        AND si.type IN ('smallholder','dealer','external_supplier','collection_centre','in_house','estate')
      GROUP BY 1 ORDER BY count DESC
    `;
  }

  // Volume by mill (top 10)
  let volumeByMill: any[] = [];
  if (isAdmin) {
    volumeByMill = await sql`
      SELECT m.name as mill_name, m.code as mill_code,
        COALESCE(SUM(si.volume), 0)::numeric(15,2) as total_volume,
        COUNT(DISTINCT si.id)::int as supplier_count
      FROM mills m
      LEFT JOIN assessments a ON a.mill_id = m.id
      LEFT JOIN supplier_information si ON si.assessment_id = a.id
      GROUP BY m.id, m.name, m.code
      ORDER BY total_volume DESC
      LIMIT 10
    `;
  }

  // Regional stats — uses effective_region (stored override or computed from state) + category mapping
  const EAST_STATES = ['Sabah', 'Sarawak', 'Labuan'];
  const WEST_STATES = [
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
  // All 6 types that map to the 4 required categories — inlined in queries below

  let regionalStats: any = null;

  if (isAdmin) {
    // East Malaysia — mill count + category breakdown (with region override support)
    const [eastRow] = await sql`
      SELECT
        COUNT(DISTINCT m.id)::int AS mill_count,
        COUNT(DISTINCT si.id)::int AS supplier_count,
        COALESCE(SUM(si.volume), 0)::numeric(15,2) AS total_volume
      FROM mills m
      LEFT JOIN assessments a ON a.mill_id = m.id
      LEFT JOIN supplier_information si
        ON si.assessment_id = a.id
        AND si.type IN ('smallholder','dealer','external_supplier','collection_centre','in_house','estate')
      WHERE COALESCE(m.region, CASE WHEN m.state IN ('Sabah','Sarawak','Labuan') THEN 'east' ELSE 'west' END) = 'east'
    `;

    const eastBreakdown = await sql`
      SELECT
        CASE
          WHEN si.type IN ('external_supplier','collection_centre') THEN 'external_supplier'
          WHEN si.type IN ('in_house','estate') THEN 'in_house'
          ELSE si.type
        END AS type,
        COUNT(*)::int AS count,
        COALESCE(SUM(si.volume), 0)::numeric(15,2) AS total_volume
      FROM supplier_information si
      JOIN assessments a ON si.assessment_id = a.id
      JOIN mills m ON a.mill_id = m.id
      WHERE COALESCE(m.region, CASE WHEN m.state IN ('Sabah','Sarawak','Labuan') THEN 'east' ELSE 'west' END) = 'east'
        AND si.type IN ('smallholder','dealer','external_supplier','collection_centre','in_house','estate')
      GROUP BY 1 ORDER BY count DESC
    `;

    // West Malaysia — mill count + category breakdown
    const [westRow] = await sql`
      SELECT
        COUNT(DISTINCT m.id)::int AS mill_count,
        COUNT(DISTINCT si.id)::int AS supplier_count,
        COALESCE(SUM(si.volume), 0)::numeric(15,2) AS total_volume
      FROM mills m
      LEFT JOIN assessments a ON a.mill_id = m.id
      LEFT JOIN supplier_information si
        ON si.assessment_id = a.id
        AND si.type IN ('smallholder','dealer','external_supplier','collection_centre','in_house','estate')
      WHERE COALESCE(m.region, CASE WHEN m.state IN ('Sabah','Sarawak','Labuan') THEN 'east' ELSE 'west' END) = 'west'
    `;

    const westBreakdown = await sql`
      SELECT
        CASE
          WHEN si.type IN ('external_supplier','collection_centre') THEN 'external_supplier'
          WHEN si.type IN ('in_house','estate') THEN 'in_house'
          ELSE si.type
        END AS type,
        COUNT(*)::int AS count,
        COALESCE(SUM(si.volume), 0)::numeric(15,2) AS total_volume
      FROM supplier_information si
      JOIN assessments a ON si.assessment_id = a.id
      JOIN mills m ON a.mill_id = m.id
      WHERE COALESCE(m.region, CASE WHEN m.state IN ('Sabah','Sarawak','Labuan') THEN 'east' ELSE 'west' END) = 'west'
        AND si.type IN ('smallholder','dealer','external_supplier','collection_centre','in_house','estate')
      GROUP BY 1 ORDER BY count DESC
    `;

    regionalStats = {
      east: {
        label: 'East Malaysia',
        states: EAST_STATES,
        mill_count: eastRow?.mill_count ?? 0,
        supplier_count: eastRow?.supplier_count ?? 0,
        total_volume: eastRow?.total_volume ?? 0,
        breakdown: eastBreakdown,
      },
      west: {
        label: 'West Malaysia',
        states: WEST_STATES,
        mill_count: westRow?.mill_count ?? 0,
        supplier_count: westRow?.supplier_count ?? 0,
        total_volume: westRow?.total_volume ?? 0,
        breakdown: westBreakdown,
      },
    };
  }

  // Monthly submissions — last 12 months
  const monthlySubmissions = await sql`
    SELECT
      TO_CHAR(submitted_at, 'YYYY-MM') as month,
      COUNT(*)::int as count
    FROM assessments
    WHERE submitted_at IS NOT NULL
      AND submitted_at >= NOW() - INTERVAL '12 months'
    GROUP BY month ORDER BY month ASC
  `;

  // User role counts (admin+ only)
  let userRoleCounts: any[] = [];
  if (isAdmin) {
    userRoleCounts = await sql`
      SELECT role, COUNT(*)::int as count
      FROM "user" GROUP BY role ORDER BY count DESC
    `;
  }

  // Recent activity
  let recentActivity: any[] = [];
  if (userRole === 'master_admin') {
    recentActivity = await sql`
      SELECT l.action, l.target, l.details, l.created_at, l.user_role, u.name as user_name
      FROM audit_logs l
      LEFT JOIN "user" u ON l.user_id = u.id
      ORDER BY l.created_at DESC LIMIT 10
    `;
  } else if (userRole === 'admin') {
    recentActivity = await sql`
      SELECT l.action, l.target, l.details, l.created_at, l.user_role, u.name as user_name
      FROM audit_logs l
      LEFT JOIN "user" u ON l.user_id = u.id
      WHERE l.user_role IN ('admin', 'mill_user')
      ORDER BY l.created_at DESC LIMIT 10
    `;
  } else {
    recentActivity = await sql(
      `SELECT l.action, l.target, l.details, l.created_at, l.user_role, u.name as user_name
       FROM audit_logs l
       LEFT JOIN "user" u ON l.user_id = u.id
       WHERE l.user_id = $1
       ORDER BY l.created_at DESC LIMIT 10`,
      [session.user.id]
    );
  }

  // Certification stats
  let certificationStats: any = null;
  if (isAdmin) {
    const [certRow] = await sql`
      SELECT
        COUNT(CASE WHEN certification_status LIKE '%RSPO%' THEN 1 END)::int as rspo_count,
        COUNT(CASE WHEN certification_status LIKE '%MSPO%' THEN 1 END)::int as mspo_count,
        COUNT(CASE WHEN certification_status LIKE '%ISCC%' THEN 1 END)::int as iscc_count,
        COUNT(CASE WHEN certification_status = 'NONE' OR certification_status IS NULL THEN 1 END)::int as none_count,
        COALESCE(SUM(CASE WHEN certification_status LIKE '%RSPO%' THEN volume ELSE 0 END), 0)::numeric(15,2) as rspo_volume,
        COALESCE(SUM(CASE WHEN certification_status LIKE '%MSPO%' THEN volume ELSE 0 END), 0)::numeric(15,2) as mspo_volume,
        COALESCE(SUM(CASE WHEN certification_status LIKE '%ISCC%' THEN volume ELSE 0 END), 0)::numeric(15,2) as iscc_volume,
        COALESCE(SUM(CASE WHEN certification_status = 'NONE' OR certification_status IS NULL THEN volume ELSE 0 END), 0)::numeric(15,2) as none_volume,
        COUNT(*)::int as total_certified_suppliers
      FROM supplier_information
    `;
    const certBreakdown = await sql`
      SELECT certification_status, COUNT(*)::int as count,
        COALESCE(SUM(volume), 0)::numeric(15,2) as total_volume
      FROM supplier_information
      GROUP BY certification_status ORDER BY count DESC
    `;
    certificationStats = { ...certRow, breakdown: certBreakdown };
  } else if (userMillId) {
    const [certRow] = await sql(
      `SELECT
        COUNT(CASE WHEN si.certification_status LIKE '%RSPO%' THEN 1 END)::int as rspo_count,
        COUNT(CASE WHEN si.certification_status LIKE '%MSPO%' THEN 1 END)::int as mspo_count,
        COUNT(CASE WHEN si.certification_status LIKE '%ISCC%' THEN 1 END)::int as iscc_count,
        COUNT(CASE WHEN si.certification_status = 'NONE' OR si.certification_status IS NULL THEN 1 END)::int as none_count,
        COALESCE(SUM(CASE WHEN si.certification_status LIKE '%RSPO%' THEN si.volume ELSE 0 END), 0)::numeric(15,2) as rspo_volume,
        COALESCE(SUM(CASE WHEN si.certification_status LIKE '%MSPO%' THEN si.volume ELSE 0 END), 0)::numeric(15,2) as mspo_volume,
        COALESCE(SUM(CASE WHEN si.certification_status LIKE '%ISCC%' THEN si.volume ELSE 0 END), 0)::numeric(15,2) as iscc_volume,
        COALESCE(SUM(CASE WHEN si.certification_status = 'NONE' OR si.certification_status IS NULL THEN si.volume ELSE 0 END), 0)::numeric(15,2) as none_volume,
        COUNT(*)::int as total_certified_suppliers
       FROM supplier_information si
       JOIN assessments a ON si.assessment_id = a.id
       WHERE a.mill_id = $1`,
      [userMillId]
    );
    certificationStats = { ...certRow };
  }

  return Response.json({
    ...counts,
    statusBreakdown,
    assessmentsByMill,
    suppliersByType,
    volumeByMill,
    regionalStats,
    monthlySubmissions,
    userRoleCounts,
    recentActivity,
    certificationStats,
  });
}
