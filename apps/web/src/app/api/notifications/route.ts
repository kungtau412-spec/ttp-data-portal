import sql from '@/app/api/utils/sql';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

/**
 * GET /api/notifications
 * Returns the authenticated user's notifications (most recent 50).
 */
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const notifications = await sql(
    `SELECT id, message, link, entity_type, entity_id, is_read, created_at
     FROM notifications
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 50`,
    [session.user.id]
  );

  const unread = notifications.filter((n: any) => !n.is_read).length;

  return Response.json({ notifications, unread });
}

/**
 * PATCH /api/notifications
 * Mark notifications as read.
 * Body: { ids: number[] } — specific IDs, or { all: true } to mark all read.
 */
export async function PATCH(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();

  if (body.all) {
    await sql(`UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false`, [
      session.user.id,
    ]);
    return Response.json({ success: true });
  }

  if (Array.isArray(body.ids) && body.ids.length > 0) {
    const placeholders = body.ids.map((_: any, i: number) => `$${i + 2}`).join(', ');
    await sql(
      `UPDATE notifications SET is_read = true
       WHERE user_id = $1 AND id IN (${placeholders})`,
      [session.user.id, ...body.ids]
    );
    return Response.json({ success: true });
  }

  return Response.json({ error: 'Provide ids array or all:true' }, { status: 400 });
}
