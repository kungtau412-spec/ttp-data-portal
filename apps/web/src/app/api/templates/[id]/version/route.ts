import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import sql from '@/app/api/utils/sql';
import { logAudit } from '@/app/api/utils/audit';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = (session.user as any).role;
    if (!['master_admin', 'admin'].includes(userRole)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const templateId = parseInt(id);

    // Get the original template
    const [original] = await sql`
      SELECT * FROM assessment_templates WHERE id = ${templateId}
    `;

    if (!original) {
      return Response.json({ error: 'Template not found' }, { status: 404 });
    }

    if (original.status !== 'published') {
      return Response.json(
        { error: 'Can only create new version from published templates' },
        { status: 400 }
      );
    }

    const newVersionNumber = original.version_number + 1;

    // Create new version template
    const [newVersion] = await sql`
      INSERT INTO assessment_templates (
        name, year_id, version_number, status, created_by, parent_template_id
      ) VALUES (
        ${original.name},
        ${original.year_id},
        ${newVersionNumber},
        'draft',
        ${session.user.id},
        ${templateId}
      )
      RETURNING *
    `;

    // Duplicate sections
    const sections = await sql`
      SELECT * FROM template_sections 
      WHERE template_id = ${templateId}
      ORDER BY sort_order, id
    `;

    for (const section of sections) {
      const [newSection] = await sql`
        INSERT INTO template_sections (
          template_id, name, description, is_required, is_visible, 
          is_editable, sort_order
        ) VALUES (
          ${newVersion.id},
          ${section.name},
          ${section.description},
          ${section.is_required},
          ${section.is_visible},
          ${section.is_editable},
          ${section.sort_order}
        )
        RETURNING *
      `;

      // Duplicate fields for this section
      const fields = await sql`
        SELECT * FROM template_fields 
        WHERE section_id = ${section.id}
        ORDER BY sort_order, id
      `;

      for (const field of fields) {
        await sql`
          INSERT INTO template_fields (
            section_id, template_id, label, field_key, field_type,
            is_required, is_unique, is_read_only, is_visible,
            max_length, min_length, min_value, max_value,
            validation_pattern, placeholder, help_text,
            field_options, conditional_logic, sort_order
          ) VALUES (
            ${newSection.id},
            ${newVersion.id},
            ${field.label},
            ${field.field_key},
            ${field.field_type},
            ${field.is_required},
            ${field.is_unique},
            ${field.is_read_only},
            ${field.is_visible ?? true},
            ${field.max_length},
            ${field.min_length},
            ${field.min_value},
            ${field.max_value},
            ${field.validation_pattern},
            ${field.placeholder},
            ${field.help_text},
            ${field.field_options},
            ${field.conditional_logic},
            ${field.sort_order}
          )
        `;
      }
    }

    await logAudit(
      'template_versioned',
      `Template: ${newVersion.id}`,
      `Created version ${newVersionNumber} from template "${original.name}" (ID: ${templateId})`
    );

    return Response.json({ template: newVersion }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating template version:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
