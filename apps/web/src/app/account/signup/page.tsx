/**
 * Public self-registration is DISABLED.
 * All accounts must be provisioned by a Master Admin via the admin panel.
 * This page replaces the former sign-up form.
 */
'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Leaf, ShieldCheck, Lock, ArrowRight } from 'lucide-react';

function NoRegistrationContent() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/';

  return (
    <main className="flex min-h-screen w-full bg-[#DAD7CD]">
      {/* Left branding panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#344E41] flex-col items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute -top-24 -left-24 w-80 h-80 rounded-full bg-[#3A5A40] opacity-50" />
        <div className="absolute -bottom-32 -right-24 w-96 h-96 rounded-full bg-[#3A5A40] opacity-40" />
        <div className="absolute top-1/2 right-8 w-48 h-48 rounded-full bg-[#588157] opacity-20" />

        <div className="relative z-10 flex flex-col items-center text-center max-w-sm">
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

      {/* Right panel */}
      <div className="flex flex-1 items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-[#344E41] flex items-center justify-center">
              <Leaf size={20} className="text-white" />
            </div>
            <span className="text-xl font-bold text-[#344E41]">SDCP Portal</span>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            {/* Lock icon */}
            <div className="w-16 h-16 rounded-2xl bg-[#344E41]/10 flex items-center justify-center mx-auto mb-6">
              <Lock size={32} className="text-[#344E41]" />
            </div>

            <h2 className="text-2xl font-bold text-[#344E41] mb-2">Access by Invitation Only</h2>
            <p className="text-slate-500 text-sm leading-relaxed mb-6">
              Public registration is not available. All SDCP Portal accounts are provisioned
              exclusively by a <strong className="text-[#344E41]">Master Administrator</strong>.
            </p>

            <div className="bg-[#344E41]/5 border border-[#344E41]/15 rounded-xl p-4 mb-6 text-left space-y-2.5">
              <p className="text-xs font-semibold text-[#344E41] uppercase tracking-wide mb-1">
                How to get access
              </p>
              {[
                "Contact your organisation's Master Admin",
                'They will create your account and assign your role',
                'You will receive your login credentials directly',
              ].map((step, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-[#344E41] text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <span className="text-sm text-slate-600">{step}</span>
                </div>
              ))}
            </div>

            <a
              href={`/account/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`}
              className="inline-flex items-center justify-center gap-2 w-full rounded-xl bg-[#344E41] py-3 text-sm font-semibold text-white transition hover:bg-[#3A5A40]"
            >
              Back to Sign In
              <ArrowRight size={16} />
            </a>
          </div>

          <p className="text-center text-xs text-slate-400 mt-6">
            © 2026 SDCP — Supplier Data Collection Portal
          </p>
        </div>
      </div>
    </main>
  );
}

export default function SignUpPage() {
  return (
    <Suspense>
      <NoRegistrationContent />
    </Suspense>
  );
}
