'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  Factory,
  ClipboardCheck,
  FileSpreadsheet,
  History,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Leaf,
  Settings2,
  UserCircle2,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { authClient } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';
import { hasRole, type UserRole } from '@/lib/permissions';

export default function Sidebar({ userRole }: { userRole: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  // Each role has its own dashboard route
  const dashboardHref =
    userRole === 'master_admin'
      ? '/master-admin/dashboard'
      : userRole === 'admin'
        ? '/admin/dashboard'
        : '/mill/dashboard';

  const NAV_SECTIONS = [
    {
      label: 'Main',
      items: [
        {
          name: 'Dashboard',
          href: dashboardHref,
          icon: LayoutDashboard,
          roles: ['master_admin', 'admin', 'mill_user'],
        },
      ],
    },
    {
      label: 'Management',
      items: [
        { name: 'Users', href: '/users', icon: Users, roles: ['master_admin', 'admin'] },
        { name: 'Mills', href: '/mills', icon: Factory, roles: ['master_admin', 'admin'] },
        {
          name: 'TTP Data',
          href: '/assessments',
          icon: ClipboardCheck,
          roles: ['master_admin', 'admin', 'mill_user'],
        },
      ],
    },
    {
      label: 'Configuration',
      items: [
        {
          name: 'TTP Years',
          href: '/years',
          icon: CalendarDays,
          roles: ['master_admin'],
        },
        {
          name: 'TTP Templates',
          href: '/templates',
          icon: FileText,
          roles: ['master_admin', 'admin'],
        },
        {
          name: 'Supplier Fields',
          href: '/supplier-fields',
          icon: Settings2,
          roles: ['master_admin', 'admin'],
        },
      ],
    },
    {
      label: 'Reporting',
      items: [
        {
          name: 'Reports',
          href: '/reports',
          icon: FileSpreadsheet,
          roles: ['master_admin', 'admin'],
        },
        {
          name: 'Audit Logs',
          href: '/audit-logs',
          icon: History,
          roles: ['master_admin', 'admin'],
        },
      ],
    },
    {
      label: 'Account',
      items: [
        {
          name: 'My Profile',
          href: '/profile',
          icon: UserCircle2,
          roles: ['master_admin', 'admin', 'mill_user'],
        },
      ],
    },
  ];

  const handleLogout = async () => {
    await authClient.signOut();
    router.push('/account/signin');
  };

  const isActive = (href: string) => {
    // Dashboard links: active when on any page within that role's section
    if (href === '/master-admin/dashboard') return pathname.startsWith('/master-admin');
    if (href === '/admin/dashboard') return pathname.startsWith('/admin');
    if (href === '/mill/dashboard') return pathname.startsWith('/mill');
    return pathname.startsWith(href);
  };

  return (
    <div
      className={cn(
        'flex flex-col h-screen bg-[#2D4A3E] text-white transition-all duration-300 ease-in-out flex-shrink-0',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo header */}
      <div
        className={cn(
          'flex items-center border-b border-[#3A5A40]/60 h-16 flex-shrink-0',
          collapsed ? 'justify-center px-2' : 'justify-between px-4'
        )}
      >
        {!collapsed && (
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[#588157] flex items-center justify-center flex-shrink-0">
              <Leaf size={16} className="text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-white leading-none truncate">SDCP Portal</p>
              <p className="text-[10px] text-[#A3B18A] mt-0.5">v2.0</p>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="w-8 h-8 rounded-lg bg-[#588157] flex items-center justify-center">
            <Leaf size={16} className="text-white" />
          </div>
        )}
        {!collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[#A3B18A] hover:bg-[#3A5A40] hover:text-white transition flex-shrink-0"
          >
            <ChevronLeft size={16} />
          </button>
        )}
      </div>

      {/* Collapsed expand button */}
      {collapsed && (
        <button
          onClick={() => setCollapsed(false)}
          className="mx-auto mt-2 w-7 h-7 rounded-lg flex items-center justify-center text-[#A3B18A] hover:bg-[#3A5A40] hover:text-white transition"
        >
          <ChevronRight size={16} />
        </button>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 space-y-1 px-2">
        {NAV_SECTIONS.map((section) => {
          const visibleItems = section.items.filter((item) =>
            item.roles.some((r) => hasRole(userRole, r as UserRole))
          );
          if (visibleItems.length === 0) return null;

          return (
            <div key={section.label} className="mb-2">
              {!collapsed && (
                <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[#6B8F71] mb-1">
                  {section.label}
                </p>
              )}
              {visibleItems.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={collapsed ? item.name : undefined}
                    className={cn(
                      'flex items-center rounded-xl transition-all duration-150 mb-0.5',
                      collapsed ? 'justify-center p-2.5 mx-1' : 'gap-3 px-3 py-2.5',
                      active
                        ? 'bg-[#588157] text-white shadow-sm'
                        : 'text-[#A3B18A] hover:bg-[#3A5A40] hover:text-white'
                    )}
                  >
                    <item.icon
                      size={18}
                      className={cn('flex-shrink-0', active ? 'text-white' : '')}
                    />
                    {!collapsed && (
                      <span className="text-sm font-medium truncate">{item.name}</span>
                    )}
                  </Link>
                );
              })}
              {!collapsed && <div className="h-px bg-[#3A5A40]/40 mt-2" />}
            </div>
          );
        })}
      </nav>

      {/* Logout */}
      <div className={cn('border-t border-[#3A5A40]/60 p-2 flex-shrink-0')}>
        <button
          onClick={handleLogout}
          title={collapsed ? 'Logout' : undefined}
          className={cn(
            'flex items-center rounded-xl text-[#A3B18A] hover:bg-red-900/30 hover:text-red-300 transition w-full',
            collapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5'
          )}
        >
          <LogOut size={18} className="flex-shrink-0" />
          {!collapsed && <span className="text-sm font-medium">Logout</span>}
        </button>
      </div>
    </div>
  );
}
