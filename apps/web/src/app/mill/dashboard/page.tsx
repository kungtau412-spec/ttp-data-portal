'use client';

import { useQuery } from '@tanstack/react-query';
import {
  ClipboardCheck,
  CheckCircle,
  Clock,
  Upload,
  HardHat,
  AlertCircle,
  TrendingUp,
  FileText,
  ArrowRight,
  History,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { authClient } from '@/lib/auth-client';
import { useEffect, useState } from 'react';
import RoleGuard from '@/components/role-guard';
import Link from 'next/link';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: 'Draft', color: 'text-slate-600', bg: 'bg-slate-100' },
  submitted: { label: 'Submitted', color: 'text-blue-700', bg: 'bg-blue-100' },
  under_review: { label: 'Under Review', color: 'text-amber-700', bg: 'bg-amber-100' },
  reopened: { label: 'Reopened', color: 'text-orange-700', bg: 'bg-orange-100' },
  approved: { label: 'Approved', color: 'text-emerald-700', bg: 'bg-emerald-100' },
};

function formatDate(iso: string) {
  return iso.slice(0, 16).replace('T', ' ');
}

function MillDashboardContent() {
  const [greeting, setGreeting] = useState('Welcome');

  useEffect(() => {
    const h = new Date().getHours();
    if (h < 12) setGreeting('Good morning');
    else if (h < 17) setGreeting('Good afternoon');
    else setGreeting('Good evening');
  }, []);

  const { data: session } = authClient.useSession();
  const firstName = session?.user?.name?.split(' ')[0] || 'User';

  const { data: stats, isLoading } = useQuery({
    queryKey: ['stats'],
    queryFn: async () => {
      const res = await fetch('/api/stats');
      if (!res.ok) throw new Error('Failed to fetch stats');
      return res.json();
    },
  });

  const { data: assessments, isLoading: assessmentsLoading } = useQuery({
    queryKey: ['assessments'],
    queryFn: async () => {
      const res = await fetch('/api/assessments');
      if (!res.ok) throw new Error('Failed to fetch assessments');
      return res.json();
    },
  });

  const statCards = [
    {
      title: 'Total TTP Data',
      value: stats?.total_assessments,
      icon: ClipboardCheck,
      color: 'text-blue-600',
      bg: 'bg-blue-100',
    },
    {
      title: 'Pending',
      value: stats?.pending_assessments,
      icon: Clock,
      color: 'text-amber-600',
      bg: 'bg-amber-100',
    },
    {
      title: 'Submitted',
      value: stats?.submitted_assessments,
      icon: TrendingUp,
      color: 'text-purple-600',
      bg: 'bg-purple-100',
    },
    {
      title: 'Approved',
      value: stats?.approved_assessments,
      icon: CheckCircle,
      color: 'text-emerald-600',
      bg: 'bg-emerald-100',
    },
  ];

  const recentAssessments = (assessments || []).slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <HardHat size={18} className="text-[#588157]" />
            <span className="text-xs font-bold uppercase tracking-widest text-[#588157]">
              Mill User
            </span>
          </div>
          <h2 className="text-2xl font-bold text-[#344E41]">
            {greeting}, {firstName}
          </h2>
          <p className="text-slate-500 text-sm mt-1">Your mill TTP data workspace</p>
        </div>
        <Link
          href="/assessments"
          className="inline-flex items-center gap-2 bg-[#344E41] text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-[#3A5A40] transition self-start sm:self-auto"
        >
          <ClipboardCheck size={16} />
          View All TTP Data
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {isLoading
          ? [...Array(4)].map((_, i) => (
              <div
                key={i}
                className="h-28 rounded-xl bg-white border border-slate-200 opacity-50"
              />
            ))
          : statCards.map((stat, i) => (
              <Card
                key={i}
                className="border border-slate-200 shadow-sm hover:shadow-md transition-shadow"
              >
                <CardContent className="p-4">
                  <div
                    className={`${stat.bg} w-10 h-10 rounded-xl flex items-center justify-center mb-3`}
                  >
                    <stat.icon size={18} className={stat.color} />
                  </div>
                  <div className="text-2xl font-bold text-[#344E41] mb-0.5">{stat.value ?? 0}</div>
                  <p className="text-xs font-medium text-slate-500">{stat.title}</p>
                </CardContent>
              </Card>
            ))}
      </div>

      {/* Recent assessments + Quick actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent assessments */}
        <Card className="lg:col-span-2 border border-slate-200 shadow-sm">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base font-semibold text-[#344E41]">
                Recent TTP Data
              </CardTitle>
              <p className="text-xs text-slate-400 mt-0.5">Your latest submissions</p>
            </div>
            <Link
              href="/assessments"
              className="text-xs text-[#588157] hover:text-[#344E41] font-medium flex items-center gap-1"
            >
              View all <ArrowRight size={12} />
            </Link>
          </CardHeader>
          <CardContent>
            {assessmentsLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-14 rounded-lg bg-slate-100 opacity-50" />
                ))}
              </div>
            ) : recentAssessments.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 gap-3">
                <AlertCircle size={32} className="text-slate-300" />
                <p className="text-sm text-slate-400">No TTP data found</p>
                <Link
                  href="/assessments"
                  className="text-sm text-[#588157] font-medium hover:underline"
                >
                  Start your first TTP data entry
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {recentAssessments.map((assessment: any, i: number) => {
                  const statusConf = STATUS_CONFIG[assessment.status] || STATUS_CONFIG.draft;
                  return (
                    <div
                      key={i}
                      className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-[#344E41]/10 flex items-center justify-center flex-shrink-0">
                          <FileText size={16} className="text-[#344E41]" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">
                            {assessment.mill_name || 'Assessment'} — {assessment.year || ''}
                          </p>
                          <p className="text-xs text-slate-400">
                            {formatDate(assessment.created_at || '')}
                          </p>
                        </div>
                      </div>
                      <Badge
                        className={`${statusConf.bg} ${statusConf.color} border-0 text-[10px] font-semibold flex-shrink-0 ml-2`}
                      >
                        {statusConf.label}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick actions */}
        <Card className="border border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-[#344E41]">Quick Actions</CardTitle>
            <p className="text-xs text-slate-400">Your available tools</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-2.5">
              {[
                {
                  label: 'View TTP Data',
                  description: 'Check status & submit',
                  href: '/assessments',
                  icon: ClipboardCheck,
                  cls: 'bg-blue-50 text-blue-700 hover:bg-blue-100',
                },
                {
                  label: 'Upload Evidence',
                  description: 'Add supporting documents',
                  href: '/assessments',
                  icon: Upload,
                  cls: 'bg-purple-50 text-purple-700 hover:bg-purple-100',
                },
                {
                  label: 'Submit TTP Data',
                  description: 'Send for review',
                  href: '/assessments',
                  icon: TrendingUp,
                  cls: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
                },
              ].map((action) => (
                <Link
                  key={action.label}
                  href={action.href}
                  className={`flex items-center gap-3 rounded-xl p-3 transition ${action.cls}`}
                >
                  <div className="w-8 h-8 rounded-lg bg-white/50 flex items-center justify-center flex-shrink-0">
                    <action.icon size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{action.label}</p>
                    <p className="text-xs opacity-70">{action.description}</p>
                  </div>
                  <ArrowRight size={14} className="flex-shrink-0 ml-auto" />
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* PART 1: My Recent Activity (own logs only) */}
      {stats?.recentActivity && stats.recentActivity.length > 0 && (
        <Card className="border border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <History size={15} className="text-[#588157]" />
              <CardTitle className="text-base font-semibold text-[#344E41]">
                My Recent Activity
              </CardTitle>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">Your own submission and upload history</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(stats.recentActivity as any[]).map((log: any, i: number) => (
                <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-50">
                  <div className="w-8 h-8 rounded-lg bg-[#344E41]/10 flex items-center justify-center flex-shrink-0">
                    <History size={14} className="text-[#344E41]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-700 capitalize truncate">
                      {log.action} {log.target}
                    </p>
                    <p className="text-[11px] text-slate-400">{log.details || ''}</p>
                  </div>
                  <span className="text-[11px] text-slate-400 flex-shrink-0 tabular-nums">
                    {formatDate(log.created_at)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function MillDashboard() {
  return (
    <RoleGuard allowedRoles={['mill_user']}>
      <MillDashboardContent />
    </RoleGuard>
  );
}
