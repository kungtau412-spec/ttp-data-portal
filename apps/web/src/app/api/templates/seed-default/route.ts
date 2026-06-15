import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import sql from '@/app/api/utils/sql';
import { logAudit } from '@/app/api/utils/audit';

// ─── Seed data definitions ────────────────────────────────────────────────────

const SUPPLIER_INFO_FIELDS = [
  {
    label: 'Supplier Type',
    field_key: 'supplier_type',
    field_type: 'dropdown',
    is_required: true,
    is_unique: false,
    is_read_only: false,
    is_visible: true,
    placeholder: 'Select supplier type',
    help_text: 'Select the category that best describes this supplier.',
    field_options: [
      'Dealer',
      'Collection Centre',
      'Estate',
      'Smallholder',
      'External Supplier',
      'In-House',
    ],
    conditional_logic: {},
  },
  {
    label: 'Supplier Name',
    field_key: 'supplier_name',
    field_type: 'short_text',
    is_required: true,
    is_unique: false,
    is_read_only: false,
    is_visible: true,
    placeholder: 'e.g., Ahmad bin Abdullah',
    help_text: 'Full name of the individual supplier or contact person.',
    field_options: [],
    conditional_logic: {},
  },
  {
    label: 'Company Name',
    field_key: 'company_name',
    field_type: 'short_text',
    is_required: false,
    is_unique: false,
    is_read_only: false,
    is_visible: true,
    placeholder: 'e.g., Ladang Hijau Sdn. Bhd.',
    help_text: 'Registered legal company name, if applicable.',
    field_options: [],
    conditional_logic: {},
  },
  {
    label: 'Parent Company Name',
    field_key: 'parent_company_name',
    field_type: 'short_text',
    is_required: false,
    is_unique: false,
    is_read_only: false,
    is_visible: true,
    placeholder: 'e.g., Holding Group Berhad',
    help_text: 'Parent or holding company name, if this supplier is a subsidiary.',
    field_options: [],
    conditional_logic: {},
  },
  {
    label: 'MPOB License Number',
    field_key: 'mpob_license_number',
    field_type: 'short_text',
    is_required: false,
    is_unique: true,
    is_read_only: false,
    is_visible: true,
    placeholder: 'e.g., 000123456789',
    help_text: 'Malaysian Palm Oil Board (MPOB) license number. Must be unique per supplier.',
    field_options: [],
    conditional_logic: {},
  },
  {
    label: 'Latitude',
    field_key: 'latitude',
    field_type: 'number',
    is_required: false,
    is_unique: false,
    is_read_only: false,
    is_visible: true,
    placeholder: 'e.g., 3.1390',
    help_text: 'GPS latitude coordinate of the supplier location (decimal degrees).',
    min_value: -90,
    max_value: 90,
    field_options: [],
    conditional_logic: {},
  },
  {
    label: 'Longitude',
    field_key: 'longitude',
    field_type: 'number',
    is_required: false,
    is_unique: false,
    is_read_only: false,
    is_visible: true,
    placeholder: 'e.g., 101.6869',
    help_text: 'GPS longitude coordinate of the supplier location (decimal degrees).',
    min_value: -180,
    max_value: 180,
    field_options: [],
    conditional_logic: {},
  },
  {
    label: 'Address',
    field_key: 'address',
    field_type: 'long_text',
    is_required: false,
    is_unique: false,
    is_read_only: false,
    is_visible: true,
    placeholder: 'Enter full postal address',
    help_text: 'Full mailing/operational address of the supplier.',
    field_options: [],
    conditional_logic: {},
  },
  {
    label: 'Email Address',
    field_key: 'email_address',
    field_type: 'email',
    is_required: false,
    is_unique: false,
    is_read_only: false,
    is_visible: true,
    placeholder: 'e.g., supplier@example.com',
    help_text: 'Primary contact email address.',
    field_options: [],
    conditional_logic: {},
  },
  {
    label: 'Total Hectarage (Ha)',
    field_key: 'total_hectarage',
    field_type: 'number',
    is_required: false,
    is_unique: false,
    is_read_only: false,
    is_visible: true,
    placeholder: 'e.g., 250.50',
    help_text: 'Total land area owned or managed by the supplier (in hectares).',
    min_value: 0,
    field_options: [],
    conditional_logic: {},
  },
  {
    label: 'Planted Hectarage (Ha)',
    field_key: 'planted_hectarage',
    field_type: 'number',
    is_required: false,
    is_unique: false,
    is_read_only: false,
    is_visible: true,
    placeholder: 'e.g., 200.00',
    help_text: 'Area of land actively planted with oil palm (in hectares).',
    min_value: 0,
    field_options: [],
    conditional_logic: {},
  },
  {
    label: 'Total FFB Supplied (MT)',
    field_key: 'total_ffb_supplied',
    field_type: 'number',
    is_required: false,
    is_unique: false,
    is_read_only: false,
    is_visible: true,
    placeholder: 'e.g., 1500.00',
    help_text: 'Total Fresh Fruit Bunches supplied to the mill (metric tonnes).',
    min_value: 0,
    field_options: [],
    conditional_logic: {},
  },
  {
    label: 'RSPO Certification',
    field_key: 'rspo_certification',
    field_type: 'yes_no',
    is_required: false,
    is_unique: false,
    is_read_only: false,
    is_visible: true,
    placeholder: null,
    help_text: 'Is the supplier Roundtable on Sustainable Palm Oil (RSPO) certified?',
    field_options: [],
    conditional_logic: {},
  },
  {
    label: 'MSPO Certification',
    field_key: 'mspo_certification',
    field_type: 'yes_no',
    is_required: false,
    is_unique: false,
    is_read_only: false,
    is_visible: true,
    placeholder: null,
    help_text: 'Is the supplier Malaysian Sustainable Palm Oil (MSPO) certified?',
    field_options: [],
    conditional_logic: {},
  },
  {
    label: 'Other Certification',
    field_key: 'other_certification',
    field_type: 'short_text',
    is_required: false,
    is_unique: false,
    is_read_only: false,
    is_visible: true,
    placeholder: 'e.g., ISCC, ISPO',
    help_text: 'List any other sustainability certifications held by the supplier.',
    field_options: [],
    conditional_logic: {},
  },
];

const DEALER_BREAKDOWN_FIELDS = [
  {
    label: 'FFB Supplier Name',
    field_key: 'dealer_ffb_supplier_name',
    field_type: 'short_text',
    is_required: true,
    is_unique: false,
    is_read_only: false,
    is_visible: true,
    placeholder: 'e.g., Ahmad bin Abdullah',
    help_text:
      'Full name of the individual or entity supplying FFB through this dealer/collection centre.',
    field_options: [],
    conditional_logic: {
      show_when: {
        field: 'supplier_type',
        operator: 'in',
        values: ['Dealer', 'Collection Centre'],
      },
    },
  },
  {
    label: 'Company Name',
    field_key: 'dealer_company_name',
    field_type: 'short_text',
    is_required: false,
    is_unique: false,
    is_read_only: false,
    is_visible: true,
    placeholder: 'e.g., Ladang Hijau Sdn. Bhd.',
    help_text: 'Registered company name of the FFB supplier.',
    field_options: [],
    conditional_logic: {
      show_when: {
        field: 'supplier_type',
        operator: 'in',
        values: ['Dealer', 'Collection Centre'],
      },
    },
  },
  {
    label: 'MPOB License Number',
    field_key: 'dealer_mpob_license',
    field_type: 'short_text',
    is_required: false,
    is_unique: false,
    is_read_only: false,
    is_visible: true,
    placeholder: 'e.g., 000123456789',
    help_text: 'MPOB license number of the FFB supplier under this dealer/collection centre.',
    field_options: [],
    conditional_logic: {
      show_when: {
        field: 'supplier_type',
        operator: 'in',
        values: ['Dealer', 'Collection Centre'],
      },
    },
  },
  {
    label: 'Latitude',
    field_key: 'dealer_latitude',
    field_type: 'number',
    is_required: false,
    is_unique: false,
    is_read_only: false,
    is_visible: true,
    placeholder: 'e.g., 3.1390',
    help_text: 'GPS latitude of the FFB supplier farm or premises.',
    min_value: -90,
    max_value: 90,
    field_options: [],
    conditional_logic: {
      show_when: {
        field: 'supplier_type',
        operator: 'in',
        values: ['Dealer', 'Collection Centre'],
      },
    },
  },
  {
    label: 'Longitude',
    field_key: 'dealer_longitude',
    field_type: 'number',
    is_required: false,
    is_unique: false,
    is_read_only: false,
    is_visible: true,
    placeholder: 'e.g., 101.6869',
    help_text: 'GPS longitude of the FFB supplier farm or premises.',
    min_value: -180,
    max_value: 180,
    field_options: [],
    conditional_logic: {
      show_when: {
        field: 'supplier_type',
        operator: 'in',
        values: ['Dealer', 'Collection Centre'],
      },
    },
  },
  {
    label: 'Address',
    field_key: 'dealer_address',
    field_type: 'long_text',
    is_required: false,
    is_unique: false,
    is_read_only: false,
    is_visible: true,
    placeholder: 'Enter full address',
    help_text: 'Full address of the FFB supplier.',
    field_options: [],
    conditional_logic: {
      show_when: {
        field: 'supplier_type',
        operator: 'in',
        values: ['Dealer', 'Collection Centre'],
      },
    },
  },
  {
    label: 'District',
    field_key: 'dealer_district',
    field_type: 'short_text',
    is_required: false,
    is_unique: false,
    is_read_only: false,
    is_visible: true,
    placeholder: 'e.g., Kuala Langat',
    help_text: 'Administrative district where the FFB supplier is located.',
    field_options: [],
    conditional_logic: {
      show_when: {
        field: 'supplier_type',
        operator: 'in',
        values: ['Dealer', 'Collection Centre'],
      },
    },
  },
  {
    label: 'Negligible Risk Area',
    field_key: 'dealer_negligible_risk',
    field_type: 'yes_no',
    is_required: false,
    is_unique: false,
    is_read_only: false,
    is_visible: true,
    placeholder: null,
    help_text: 'Is this supplier located in a designated negligible risk area?',
    field_options: [],
    conditional_logic: {
      show_when: {
        field: 'supplier_type',
        operator: 'in',
        values: ['Dealer', 'Collection Centre'],
      },
    },
  },
  {
    label: 'Total Hectarage (Ha)',
    field_key: 'dealer_total_hectarage',
    field_type: 'number',
    is_required: false,
    is_unique: false,
    is_read_only: false,
    is_visible: true,
    placeholder: 'e.g., 50.00',
    help_text: 'Total land area of the FFB supplier (in hectares).',
    min_value: 0,
    field_options: [],
    conditional_logic: {
      show_when: {
        field: 'supplier_type',
        operator: 'in',
        values: ['Dealer', 'Collection Centre'],
      },
    },
  },
  {
    label: 'Planted Hectarage (Ha)',
    field_key: 'dealer_planted_hectarage',
    field_type: 'number',
    is_required: false,
    is_unique: false,
    is_read_only: false,
    is_visible: true,
    placeholder: 'e.g., 42.00',
    help_text: 'Actively planted oil palm area of the FFB supplier (in hectares).',
    min_value: 0,
    field_options: [],
    conditional_logic: {
      show_when: {
        field: 'supplier_type',
        operator: 'in',
        values: ['Dealer', 'Collection Centre'],
      },
    },
  },
  {
    label: 'Total FFB Supplied (MT)',
    field_key: 'dealer_total_ffb_supplied',
    field_type: 'number',
    is_required: false,
    is_unique: false,
    is_read_only: false,
    is_visible: true,
    placeholder: 'e.g., 320.00',
    help_text:
      'Total FFB supplied by this supplier through the dealer/collection centre (metric tonnes).',
    min_value: 0,
    field_options: [],
    conditional_logic: {
      show_when: {
        field: 'supplier_type',
        operator: 'in',
        values: ['Dealer', 'Collection Centre'],
      },
    },
  },
  {
    label: 'MSPO Certification',
    field_key: 'dealer_mspo_certification',
    field_type: 'yes_no',
    is_required: false,
    is_unique: false,
    is_read_only: false,
    is_visible: true,
    placeholder: null,
    help_text: 'Is this FFB supplier MSPO certified?',
    field_options: [],
    conditional_logic: {
      show_when: {
        field: 'supplier_type',
        operator: 'in',
        values: ['Dealer', 'Collection Centre'],
      },
    },
  },
  {
    label: 'Other Certification',
    field_key: 'dealer_other_certification',
    field_type: 'short_text',
    is_required: false,
    is_unique: false,
    is_read_only: false,
    is_visible: true,
    placeholder: 'e.g., ISCC, ISPO',
    help_text: 'Any other sustainability certifications held by this FFB supplier.',
    field_options: [],
    conditional_logic: {
      show_when: {
        field: 'supplier_type',
        operator: 'in',
        values: ['Dealer', 'Collection Centre'],
      },
    },
  },
];

// ─── Route handler ────────────────────────────────────────────────────────────

/**
 * POST /api/templates/seed-default
 * Creates the default SDCP Assessment Template with all sections and fields.
 * Safe to call multiple times — checks for existing template first.
 * Query param: ?force=true to create a duplicate even if one exists.
 */
export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userRole = (session.user as any).role ?? '';
  if (!['master_admin', 'admin'].includes(userRole)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const force = searchParams.get('force') === 'true';

  try {
    // ── 1. Guard: check if default already exists ──────────────────────────
    if (!force) {
      const existing = await sql(
        `SELECT id, name FROM assessment_templates WHERE name = $1 LIMIT 1`,
        ['SDCP Assessment Template']
      );
      if (existing.length > 0) {
        return Response.json(
          {
            alreadyExists: true,
            template: existing[0],
            message: 'Default SDCP template already exists.',
          },
          { status: 200 }
        );
      }
    }

    // ── 2. Create template ─────────────────────────────────────────────────
    const templateRows = await sql(
      `INSERT INTO assessment_templates (name, version_number, status, created_by)
       VALUES ($1, 1, 'draft', $2)
       RETURNING *`,
      ['SDCP Assessment Template', session.user.id]
    );
    const template = templateRows[0];
    const templateId = template.id;

    // ── 3. Create Section 1: Supplier Information ──────────────────────────
    const sec1Rows = await sql(
      `INSERT INTO template_sections
         (template_id, name, description, is_required, is_visible, is_editable, sort_order)
       VALUES ($1, $2, $3, true, true, true, 0)
       RETURNING *`,
      [
        templateId,
        'Supplier Information',
        "Core details about each FFB supplier in the mill's supply base. " +
          'Required for SDCP traceability and sustainability compliance reporting.',
      ]
    );
    const section1Id = sec1Rows[0].id;

    // ── 4. Insert Supplier Information fields ──────────────────────────────
    for (let i = 0; i < SUPPLIER_INFO_FIELDS.length; i++) {
      const f = SUPPLIER_INFO_FIELDS[i];
      await sql(
        `INSERT INTO template_fields
           (section_id, template_id, label, field_key, field_type,
            is_required, is_unique, is_read_only, is_visible,
            min_value, max_value,
            placeholder, help_text, field_options, conditional_logic, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
        [
          section1Id,
          templateId,
          f.label,
          f.field_key,
          f.field_type,
          f.is_required,
          f.is_unique,
          f.is_read_only,
          f.is_visible,
          (f as any).min_value ?? null,
          (f as any).max_value ?? null,
          f.placeholder ?? null,
          f.help_text ?? null,
          JSON.stringify(f.field_options),
          JSON.stringify(f.conditional_logic),
          i,
        ]
      );
    }

    // ── 5. Create Section 2: Dealer / Collection Centre Breakdown ──────────
    const sec2Rows = await sql(
      `INSERT INTO template_sections
         (template_id, name, description, is_required, is_visible, is_editable, sort_order)
       VALUES ($1, $2, $3, false, true, true, 1)
       RETURNING *`,
      [
        templateId,
        'Dealer / Collection Centre Breakdown',
        'Detailed breakdown of individual FFB suppliers aggregated under a Dealer or Collection Centre. ' +
          'Displayed only when Supplier Type is "Dealer" or "Collection Centre".',
      ]
    );
    const section2Id = sec2Rows[0].id;

    // ── 6. Insert Dealer Breakdown fields ─────────────────────────────────
    for (let i = 0; i < DEALER_BREAKDOWN_FIELDS.length; i++) {
      const f = DEALER_BREAKDOWN_FIELDS[i];
      await sql(
        `INSERT INTO template_fields
           (section_id, template_id, label, field_key, field_type,
            is_required, is_unique, is_read_only, is_visible,
            min_value, max_value,
            placeholder, help_text, field_options, conditional_logic, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
        [
          section2Id,
          templateId,
          f.label,
          f.field_key,
          f.field_type,
          f.is_required,
          f.is_unique,
          f.is_read_only,
          f.is_visible,
          (f as any).min_value ?? null,
          (f as any).max_value ?? null,
          f.placeholder ?? null,
          f.help_text ?? null,
          JSON.stringify(f.field_options),
          JSON.stringify(f.conditional_logic),
          i,
        ]
      );
    }

    // ── 7. Audit log ───────────────────────────────────────────────────────
    await logAudit(
      'default_template_seeded',
      `Template: ${templateId}`,
      `Seeded default SDCP Assessment Template with ${SUPPLIER_INFO_FIELDS.length} supplier fields and ${DEALER_BREAKDOWN_FIELDS.length} dealer breakdown fields`
    );

    return Response.json(
      {
        success: true,
        template: { id: templateId, name: 'SDCP Assessment Template' },
        sections: [
          { name: 'Supplier Information', fields: SUPPLIER_INFO_FIELDS.length },
          { name: 'Dealer / Collection Centre Breakdown', fields: DEALER_BREAKDOWN_FIELDS.length },
        ],
        message: 'Default SDCP template created successfully.',
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error seeding default template:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * GET /api/templates/seed-default
 * Check whether the default template already exists.
 */
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const existing = await sql(
      `SELECT id, name, status, version_number, created_at
       FROM assessment_templates
       WHERE name = $1
       LIMIT 1`,
      ['SDCP Assessment Template']
    );

    return Response.json({
      exists: existing.length > 0,
      template: existing[0] ?? null,
    });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
