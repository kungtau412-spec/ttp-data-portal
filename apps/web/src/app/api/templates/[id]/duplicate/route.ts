import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import sql from '@/app/api/utils/sql';
import { logAudit } from '@/app/api/utils/audit';

/**
 * Safely serialize a value to a JSON string for JSONB columns.
 * DB query results return parsed JS objects — passing them raw via template
 * literals gives PostgreSQL "[object Object]" which throws:
 *   "invalid input syntax for type json"
 * Explicitly JSON.stringify ensures the driver always sends a valid JSON string.
 */
function toJsonb(value: unknown, fallback: unknown = null): string | null {
  if (value === null || value === undefined) {
    return fallback !== null ? JSON.stringify(fallback) : null;
  }
  if (typeof value === 'string') {
    // Already a JSON string (some drivers return text columns as-is)
    try {
      JSON.parse(value); // validate it's actually parseable
      return value;
    } catch {
      // Not valid JSON — wrap it as a JSON string
      return JSON.stringify(value);
    }
  }
  return JSON.stringify(value);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = (session.user as any).role;
    if (!['master_admin', 'admin'].includes(userRole)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const templateId = parseInt(id);

    // ── 1. Fetch original template ────────────────────────────────────────
    const [original] = await sql`
      SELECT * FROM assessment_templates WHERE id = ${templateId}
    `;

    if (!original) {
      return Response.json({ error: 'Template not found' }, { status: 404 });
    }

    // ── 2. Create duplicate header ────────────────────────────────────────
    const [duplicate] = await sql`
      INSERT INTO assessment_templates (
        name, year_id, version_number, status, created_by, parent_template_id
      ) VALUES (
        ${original.name + ' (Copy)'},
        ${original.year_id},
        1,
        'draft',
        ${session.user.id},
        ${templateId}
      )
      RETURNING *
    `;

    // ── 3. Fetch all sections ordered by position ─────────────────────────
    const sections = await sql`
      SELECT * FROM template_sections
      WHERE template_id = ${templateId}
      ORDER BY sort_order, id
    `;

    const diagnostics: {
      sectionId: number;
      sectionName: string;
      fieldId?: number;
      fieldLabel?: string;
      jsonField?: string;
      error: string;
    }[] = [];

    // ── 4. Duplicate each section + its fields ────────────────────────────
    for (const section of sections) {
      let newSection: any;

      try {
        const [inserted] = await sql`
          INSERT INTO template_sections (
            template_id, name, description, is_required, is_visible,
            is_editable, sort_order
          ) VALUES (
            ${duplicate.id},
            ${section.name},
            ${section.description},
            ${section.is_required},
            ${section.is_visible},
            ${section.is_editable},
            ${section.sort_order}
          )
          RETURNING *
        `;
        newSection = inserted;
      } catch (sectionErr: any) {
        const diag = {
          sectionId: section.id,
          sectionName: section.name,
          error: sectionErr?.message ?? String(sectionErr),
        };
        diagnostics.push(diag);
        console.error('[duplicate-template] Failed to insert section:', diag);
        continue;
      }

      // ── 5. Fetch fields for this section ──────────────────────────────
      const fields = await sql`
        SELECT * FROM template_fields
        WHERE section_id = ${section.id}
        ORDER BY sort_order, id
      `;

      for (const field of fields) {
        // Serialize JSONB fields. The DB driver returns parsed JS objects —
        // they MUST be re-serialized to strings for the INSERT binding.
        const fieldOptionsJson = toJsonb(field.field_options, []);
        const conditionalLogicJson = toJsonb(field.conditional_logic, {});

        try {
          await sql(
            `INSERT INTO template_fields (
              section_id, template_id, label, field_key, field_type,
              is_required, is_unique, is_read_only, is_visible,
              max_length, min_length, min_value, max_value,
              validation_pattern, placeholder, help_text, default_value,
              field_options, conditional_logic, sort_order
            ) VALUES (
              $1,  $2,  $3,  $4,  $5,
              $6,  $7,  $8,  $9,
              $10, $11, $12, $13,
              $14, $15, $16, $17,
              $18::jsonb, $19::jsonb, $20
            )`,
            [
              newSection.id, // $1  section_id
              duplicate.id, // $2  template_id
              field.label, // $3  label
              field.field_key, // $4  field_key
              field.field_type, // $5  field_type
              field.is_required, // $6  is_required
              field.is_unique, // $7  is_unique
              field.is_read_only, // $8  is_read_only
              field.is_visible ?? true, // $9 is_visible
              field.max_length, // $10 max_length
              field.min_length, // $11 min_length
              field.min_value, // $12 min_value
              field.max_value, // $13 max_value
              field.validation_pattern, // $14
              field.placeholder, // $15
              field.help_text, // $16
              field.default_value, // $17
              fieldOptionsJson, // $18 ::jsonb  ← explicit cast, always a JSON string
              conditionalLogicJson, // $19 ::jsonb ← explicit cast, always a JSON string
              field.sort_order, // $20
            ]
          );
        } catch (fieldErr: any) {
          const errMsg = fieldErr?.message ?? String(fieldErr);

          // Identify which JSON column most likely caused the parse error
          let jsonField: string | undefined;
          if (errMsg.includes('json')) {
            if (fieldOptionsJson !== null) {
              try {
                JSON.parse(fieldOptionsJson);
              } catch {
                jsonField = 'field_options';
              }
            }
            if (!jsonField && conditionalLogicJson !== null) {
              try {
                JSON.parse(conditionalLogicJson);
              } catch {
                jsonField = 'conditional_logic';
              }
            }
            if (!jsonField) jsonField = 'field_options or conditional_logic';
          }

          const diag = {
            sectionId: section.id,
            sectionName: section.name,
            fieldId: field.id,
            fieldLabel: field.label,
            jsonField,
            error: errMsg,
          };
          diagnostics.push(diag);

          console.error('[duplicate-template] Failed to insert field:', {
            templateId,
            duplicateId: duplicate.id,
            ...diag,
            fieldOptionsRaw: field.field_options,
            conditionalLogicRaw: field.conditional_logic,
            fieldOptionsSerialized: fieldOptionsJson,
            conditionalLogicSerialized: conditionalLogicJson,
          });
        }
      }
    }

    // ── 6. If any field/section failed, clean up the partial duplicate ────
    if (diagnostics.length > 0) {
      try {
        await sql`DELETE FROM assessment_templates WHERE id = ${duplicate.id}`;
      } catch (cleanupErr) {
        console.error('[duplicate-template] Cleanup after partial failure failed:', cleanupErr);
      }

      const firstFailure = diagnostics[0];
      const detail = firstFailure.fieldLabel
        ? `Field "${firstFailure.fieldLabel}" in section "${firstFailure.sectionName}"${firstFailure.jsonField ? ` — JSON column: ${firstFailure.jsonField}` : ''}: ${firstFailure.error}`
        : `Section "${firstFailure.sectionName}": ${firstFailure.error}`;

      return Response.json(
        {
          error: 'Template duplication failed',
          detail,
          diagnostics,
          templateId,
        },
        { status: 500 }
      );
    }

    // ── 7. Audit log ──────────────────────────────────────────────────────
    await logAudit(
      'template_duplicated',
      `Template: ${duplicate.id}`,
      `Duplicated template "${original.name}" (ID: ${templateId}) → "${duplicate.name}" (ID: ${duplicate.id}) with ${sections.length} section(s)`
    );

    return Response.json({ template: duplicate }, { status: 201 });
  } catch (error: any) {
    const errMsg = error?.message ?? String(error);
    console.error('[duplicate-template] Unhandled error:', errMsg);
    return Response.json(
      {
        error: 'Template duplication failed',
        detail: errMsg,
      },
      { status: 500 }
    );
  }
}
