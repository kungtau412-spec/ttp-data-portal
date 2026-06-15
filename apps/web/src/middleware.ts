/**
 * Next.js middleware — blocks the public-facing Better Auth sign-up HTTP endpoint.
 *
 * Why here and not in auth.ts hooks:
 *   - auth.ts `hooks.before` fires for both HTTP requests AND internal
 *     `auth.api.signUpEmail()` server-to-server calls, so a hook there would
 *     also block the admin user-creation flow.
 *   - Middleware only intercepts real HTTP requests.  The admin panel calls
 *     `auth.api.signUpEmail()` as a direct function call (no HTTP round-trip),
 *     so it is unaffected by this middleware.
 */
import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  // Block all public sign-up attempts (POST to any /api/auth/sign-up/* path)
  if (request.method === 'POST' && request.nextUrl.pathname.startsWith('/api/auth/sign-up')) {
    return NextResponse.json(
      {
        error:
          'Public registration is disabled. Contact your Master Administrator to provision an account.',
      },
      { status: 403 }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/auth/:path*',
};
