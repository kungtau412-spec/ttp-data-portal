import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import sql from '@/app/api/utils/sql';
import { logAudit } from '@/app/api/utils/audit';

// POST /api/templates/[id]/sections/[sectionId]/fields - Add field
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; sectionId: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userRole = (session.user as any).role ?? '';
  if (!['master_admin', 'admin'].includes(userRole)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id, sectionId } = await params;

  try {
    const body = await request.json();
    const {
      label,
      field_key,
      field_type,
      is_required = false,
      is_unique = false,
      is_read_only = false,
      is_visible = true,
      max_length,
      min_length,
      min_value,
      max_value,
      validation_pattern,
      placeholder,
      help_text,
      field_options = [],
      conditional_logic = {},
    } = body;

    if (!label || !field_key || !field_type) {
      return Response.json(
        { error: 'Label, field_key, and field_type are required' },
        { status: 400 }
      );
    }

    // Validate field_type (15 types)
    const validTypes = [
      'short_text',
      'long_text',
      'number',
      'currency',
      'percentage',
      'date',
      'dropdown',
      'multiple_choice',
      'checkbox',
      'radio',
      'yes_no',
      'gps',
      'file_upload',
      'email',
      'phone',
    ];
    if (!validTypes.includes(field_type)) {
      return Response.json({ error: 'Invalid field type' }, { status: 400 });
    }

    // Get max sort_order
    const maxOrderResult = await sql(
      `SELECT COALESCE(MAX(sort_order), -1) as max_order 
       FROM template_fields 
       WHERE section_id = $1`,
      [parseInt(sectionId)]
    );
    const nextOrder = maxOrderResult[0].max_order + 1;

    const result = await sql(
      `INSERT INTO template_fields 
       (section_id, template_id, label, field_key, field_type, is_required, is_unique, 
        is_read_only, is_visible, max_length, min_length, min_value, max_value,
        validation_pattern, placeholder, help_text, field_options, conditional_logic, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
       RETURNING *`,
      [
        parseInt(sectionId),
        parseInt(id),
        label,
        field_key,
        field_type,
        is_required,
        is_unique,
        is_read_only,
        is_visible,
        max_length || null,
        min_length || null,
        min_value || null,
        max_value || null,
        validation_pattern || null,
        placeholder || null,
        help_text || null,
        JSON.stringify(field_options),
        JSON.stringify(conditional_logic),
        nextOrder,
      ]
    );

    await logAudit(
      'field_added',
      `Section: ${sectionId}`,
      `Added field "${label}" (${field_type})`
    );

    return Response.json({ field: result[0] }, { status: 201 });
  } catch (error: any) {
    console.error('Error adding field:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
