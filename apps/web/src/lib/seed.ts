/**
 * One-time idempotent seed — creates the default Master Admin account.
 * Called from the root layout (server component) on every cold start;
 * exits immediately if the account already exists so there is no overhead
 * on subsequent renders.
 *
 * Password is read from MASTER_ADMIN_PASSWORD environment variable —
 * never hardcoded in source.
 */
import sql from '@/app/api/utils/sql';
import { auth } from '@/lib/auth';

const MASTER_EMAIL = 'dex@master.com';
const MASTER_NAME = 'Master Admin';

export async function initMasterAdmin(): Promise<void> {
  try {
    // Fast path — if account already exists, do nothing
    const existing = await sql`
      SELECT id FROM "user" WHERE email = ${MASTER_EMAIL} LIMIT 1
    `;
    if (existing.length > 0) return;

    const password = process.env.MASTER_ADMIN_PASSWORD;
    if (!password) {
      console.warn(
        '[seed] MASTER_ADMIN_PASSWORD env var is not set — skipping master admin creation.'
      );
      return;
    }

    // Create via Better Auth so the password is hashed correctly
    await auth.api.signUpEmail({
      body: { email: MASTER_EMAIL, password, name: MASTER_NAME },
    });

    // Promote to master_admin
    await sql`
      UPDATE "user"
      SET role = 'master_admin', status = 'active'
      WHERE email = ${MASTER_EMAIL}
    `;

    console.log(`[seed] Master admin account created for ${MASTER_EMAIL}`);
  } catch (err) {
    // Log but never crash the application
    console.error('[seed] Failed to initialise master admin:', err);
  }
}
