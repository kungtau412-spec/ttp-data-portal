import sql from '@/app/api/utils/sql';

/**
 * Send an in-app notification to all users matching the given roles.
 */
export async function notifyRoles(
  roles: string[],
  message: string,
  options: { link?: string; entityType?: string; entityId?: number } = {}
) {
  try {
    const placeholders = roles.map((_, i) => `$${i + 1}`).join(', ');
    const admins = await sql(
      `SELECT id FROM "user" WHERE role IN (${placeholders}) AND status = 'active' AND locked = false`,
      roles
    );
    if (admins.length === 0) return;

    for (const admin of admins) {
      await sql(
        `INSERT INTO notifications (user_id, message, link, entity_type, entity_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          admin.id,
          message,
          options.link ?? null,
          options.entityType ?? null,
          options.entityId ?? null,
        ]
      );
    }
  } catch (err) {
    // Non-fatal — log but don't break the main flow
    console.error('notifyRoles error:', err);
  }
}
