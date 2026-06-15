/**
 * ⚠ ANYTHING PLATFORM — DO NOT REWRITE THIS FILE ⚠
 *
 * Shipped v2 auth scaffolding. Same contract as signup/page.tsx: <form
 * onSubmit>, e.preventDefault(), and window.location.href redirect are all
 * load-bearing for the mobile WebView. DO NOT replace <form onSubmit> with
 * <button onClick> — that broke signin platform-wide in a prior AI rewrite.
 *
 *   Safe:   restyle, rewrite copy, add form fields.
 *   Unsafe: replacing <form>, removing preventDefault, bypassing
 *           authClient.signIn.email, changing the callbackUrl redirect.
 */
'use client';

import { Suspense, useState, type FormEvent } from 'react';
import { authClient } from '@/lib/auth-client';
import { Leaf, Eye, EyeOff, ShieldCheck } from 'lucide-react';

function SignInForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: signInError } = await authClient.signIn.email({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message ?? 'Sign in failed. Please check your credentials.');
      setLoading(false);
      return;
    }

    // Redirect based on role — role-specific dashboards are enforced server-side
    let destination = '/';
    try {
      const { data: freshSession } = await authClient.getSession();
      const role = (freshSession?.user as any)?.role;
      if (role === 'master_admin') destination = '/master-admin/dashboard';
      else if (role === 'admin') destination = '/admin/dashboard';
      else if (role === 'mill_user') destination = '/mill/dashboard';
    } catch {
      // Fall back to root if session read fails — root page will re-redirect
    }

    if (typeof window !== 'undefined') {
      window.location.href = destination;
    } else {
      console.warn('signin: window is undefined; cannot redirect');
    }
  };

  return (
    <main className="flex min-h-screen w-full bg-[#DAD7CD]">
      {/* Left branding panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#344E41] flex-col items-center justify-center p-12 relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute -top-24 -left-24 w-80 h-80 rounded-full bg-[#3A5A40] opacity-50" />
        <div className="absolute -bottom-32 -right-24 w-96 h-96 rounded-full bg-[#3A5A40] opacity-40" />
        <div className="absolute top-1/2 right-8 w-48 h-48 rounded-full bg-[#588157] opacity-20" />

        <div className="relative z-10 flex flex-col items-center text-center max-w-sm">
          {/* Logo */}
          <div className="w-24 h-24 rounded-2xl bg-[#588157] flex items-center justify-center mb-8 shadow-2xl">
            <Leaf size={48} className="text-white" />
          </div>

          <h1 className="text-4xl font-bold text-white mb-3 leading-tight">
            Supplier Data
            <br />
            Collection Portal
          </h1>
          <p className="text-[#A3B18A] text-lg mb-10">
            A centralized platform for palm oil mill supplier assessment and data management.
          </p>

          {/* Feature badges */}
          <div className="space-y-3 w-full">
            {[
              'Role-based secure access',
              'Multi-mill assessment management',
              'Real-time reporting & analytics',
            ].map((feature) => (
              <div
                key={feature}
                className="flex items-center gap-3 bg-[#3A5A40] rounded-xl px-4 py-3 text-left"
              >
                <ShieldCheck size={18} className="text-[#A3B18A] flex-shrink-0" />
                <span className="text-[#DAD7CD] text-sm">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right login panel */}
      <div className="flex flex-1 items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-[#344E41] flex items-center justify-center">
              <Leaf size={20} className="text-white" />
            </div>
            <span className="text-xl font-bold text-[#344E41]">SDCP Portal</span>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-[#344E41]">Welcome back</h2>
              <p className="text-slate-500 mt-1">Sign in to your SDCP account</p>
            </div>

            <form
              onSubmit={(e) => {
                void onSubmit(e);
              }}
              className="space-y-5"
            >
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-[#588157] focus:ring-2 focus:ring-[#588157]/20"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 pr-11 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-[#588157] focus:ring-2 focus:ring-[#588157]/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="rounded-xl bg-red-50 border border-red-100 p-4 text-sm text-red-600">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-[#344E41] py-3 text-sm font-semibold text-white transition hover:bg-[#3A5A40] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    Signing in…
                  </span>
                ) : (
                  'Sign In'
                )}
              </button>
            </form>

            {/* "Need an account?" link removed — public registration is disabled */}
          </div>

          <p className="text-center text-xs text-slate-400 mt-6" suppressHydrationWarning>
            © 2026 SDCP — Supplier Data Collection Portal
          </p>
        </div>
      </div>
    </main>
  );
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  );
}
