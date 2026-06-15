'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
import { Loader2 } from 'lucide-react';

export default function RootPage() {
  const { data: session, isPending } = authClient.useSession();
  const router = useRouter();

  useEffect(() => {
    if (isPending) return;
    if (!session) return; // dashboard-layout handles the signin redirect
    const role = (session.user as any)?.role;
    if (role === 'master_admin') router.replace('/master-admin/dashboard');
    else if (role === 'admin') router.replace('/admin/dashboard');
    else router.replace('/mill/dashboard');
  }, [session, isPending, router]);

  return (
    <div className="flex h-full items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-slate-400">
        <Loader2 className="animate-spin" size={28} />
        <p className="text-sm">Redirecting to your dashboard…</p>
      </div>
    </div>
  );
}
