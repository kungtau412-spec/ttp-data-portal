'use client';

import { authClient } from '@/lib/auth-client';
import { ROLE_LABELS, type UserRole } from '@/lib/permissions';
import Sidebar from './sidebar';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { Loader2, Bell, AlertTriangle, KeyRound, Check, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ── Client-only relative time chip ───────────────────────────────────────────
function RelativeTime({ raw }: { raw: string }) {
  const [label, setLabel] = useState('');
  useEffect(() => {
    const compute = () => {
      try {
        const parsed = new Date(raw);
        const ms = new Date().getTime() - parsed.getTime();
        if (ms < 60000) return 'just now';
        if (ms < 3600000) return `${Math.floor(ms / 60000)}m ago`;
        if (ms < 86400000) return `${Math.floor(ms / 3600000)}h ago`;
        return parsed.toLocaleDateString();
      } catch {
        return '';
      }
    };
    setLabel(compute());
    const t = setInterval(() => setLabel(compute()), 60000);
    return () => clearInterval(t);
  }, [raw]);
  return <span suppressHydrationWarning>{label}</span>;
}

// ── Notification Bell ─────────────────────────────────────────────────────────
function NotificationBell({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data } = useQuery({
    queryKey: ['notifications', userId],
    queryFn: async () => {
      const res = await fetch('/api/notifications');
      if (!res.ok) return { notifications: [], unread: 0 };
      return res.json();
    },
    refetchInterval: 30000,
    enabled: !!userId,
  });

  const markReadMutation = useMutation({
    mutationFn: async (ids?: number[]) => {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ids ? { ids } : { all: true }),
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications', userId] }),
  });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const unread: number = data?.unread ?? 0;
  const notifications: any[] = data?.notifications ?? [];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition"
      >
        <Bell size={16} />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 w-80 bg-white rounded-xl border border-slate-200 shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <p className="text-sm font-bold text-slate-700">Notifications</p>
            {unread > 0 && (
              <button
                onClick={() => markReadMutation.mutate(undefined)}
                className="flex items-center gap-1 text-xs text-[#344E41] hover:underline font-medium"
              >
                <Check size={11} /> Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-slate-50">
            {notifications.length === 0 ? (
              <div className="py-10 text-center text-slate-400 text-xs">No notifications yet</div>
            ) : (
              notifications.slice(0, 20).map((n: any) => (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition ${!n.is_read ? 'bg-blue-50/40' : ''}`}
                >
                  <div
                    className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${!n.is_read ? 'bg-blue-500' : 'bg-transparent'}`}
                  />
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-xs leading-relaxed ${!n.is_read ? 'text-slate-800 font-medium' : 'text-slate-600'}`}
                    >
                      {n.message}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-[10px] text-slate-400">
                        <RelativeTime raw={n.created_at} />
                      </p>
                      {n.link && (
                        <Link
                          href={n.link}
                          onClick={() => {
                            markReadMutation.mutate([n.id]);
                            setOpen(false);
                          }}
                          className="flex items-center gap-0.5 text-[10px] text-[#344E41] hover:underline font-semibold"
                        >
                          View <ExternalLink size={9} />
                        </Link>
                      )}
                    </div>
                  </div>
                  {!n.is_read && (
                    <button
                      onClick={() => markReadMutation.mutate([n.id])}
                      className="flex-shrink-0 text-slate-300 hover:text-slate-500 mt-0.5"
                    >
                      <Check size={13} />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main layout ──────────────────────────────────────────────────────────────
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = authClient.useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [forceChangePending, setForceChangePending] = useState(false);

  useEffect(() => {
    if (!isPending && !session && !pathname.startsWith('/account')) {
      router.push('/account/signin');
    }
  }, [session, isPending, router, pathname]);

  useEffect(() => {
    if (session?.user?.id && !pathname.startsWith('/account') && !pathname.startsWith('/profile')) {
      fetch('/api/profile')
        .then((r) => r.json())
        .then((data) => {
          if (data?.locked) {
            authClient.signOut().then(() => router.push('/account/signin'));
            return;
          }
          setForceChangePending(!!data?.force_password_change);
        })
        .catch(() => {});
    }
  }, [session, pathname, router]);

  if (isPending) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#DAD7CD]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="animate-spin text-[#344E41]" size={40} />
          <p className="text-sm text-[#588157] font-medium">Loading TTP Portal…</p>
        </div>
      </div>
    );
  }

  if (pathname.startsWith('/account')) return <>{children}</>;
  if (!session) return null;

  const userRole = ((session.user as any).role ?? '') as UserRole;
  const roleLabel = ROLE_LABELS[userRole] ?? userRole;
  const initials = session.user.name
    ? session.user.name
        .split(' ')
        .map((n: string) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'U';

  return (
    <div className="flex h-screen bg-[#F0EDE8] overflow-hidden">
      <Sidebar userRole={userRole} />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <header className="h-16 bg-white border-b border-[#D4CFC8] flex items-center justify-between px-6 shadow-sm flex-shrink-0">
          <div className="hidden md:block">
            <h1 className="text-base font-semibold text-[#344E41] leading-none">
              TTP Data Collection System
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">TTP Supplier Monitoring System</p>
          </div>

          <div className="flex items-center gap-3">
            {forceChangePending && (
              <Link
                href="/profile"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-100 text-amber-700 text-xs font-semibold hover:bg-amber-200 transition"
              >
                <AlertTriangle size={13} />
                Change password required
              </Link>
            )}

            <NotificationBell userId={session.user.id} />

            <div className="h-6 w-px bg-slate-200" />

            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold text-[#344E41] leading-none">
                  {session.user.name}
                </p>
                <p className="text-xs text-[#588157] capitalize mt-0.5">{roleLabel}</p>
              </div>
              <Link href="/profile">
                <div className="w-9 h-9 rounded-full bg-[#344E41] flex items-center justify-center text-white font-bold text-sm flex-shrink-0 hover:bg-[#3A5A40] transition">
                  {initials}
                </div>
              </Link>
            </div>
          </div>
        </header>

        {forceChangePending && pathname !== '/profile' && (
          <div className="absolute inset-0 z-50 bg-black/50 flex items-center justify-center">
            <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 text-center">
              <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
                <KeyRound size={28} className="text-amber-600" />
              </div>
              <h2 className="text-xl font-bold text-slate-800 mb-2">Password Change Required</h2>
              <p className="text-slate-500 text-sm mb-6">
                An administrator has reset your password. You must set a new password before you can
                continue using the system.
              </p>
              <Link
                href="/profile"
                className="inline-flex items-center gap-2 bg-[#344E41] hover:bg-[#3A5A40] text-white font-semibold px-6 py-3 rounded-xl transition"
              >
                <KeyRound size={16} />
                Change Password Now
              </Link>
            </div>
          </div>
        )}

        <main className="flex-1 overflow-y-auto p-6 md:p-8">{children}</main>
      </div>
    </div>
  );
}
