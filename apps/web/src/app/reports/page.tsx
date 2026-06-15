'use client';

import { useQuery } from '@tanstack/react-query';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  Download,
  Users,
  Factory,
  BarChart2,
  TrendingUp,
  ClipboardList,
  FileText,
  Filter,
  AlertCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { authClient } from '@/lib/auth-client';
import { useState } from 'react';
import RoleGuard from '@/components/role-guard';

const STATUS_COLORS: Record<string, string> = {
  draft: '#94A3B8',
  submitted: '#60A5FA',
  under_review: '#FBBF24',
  reopened: '#F97316',
  approved: '#34D399',
};
const TYPE_COLORS: Record<string, string> = {
  dealer: '#8B5CF6',
  collection_centre: '#3B82F6',
  estate: '#10B981',
  smallholder: '#F59E0B',
};
const TYPE_LABELS: Record<string, string> = {
  dealer: 'Dealer',
  collection_centre: 'Collection Centre',
  estate: 'Estate',
  smallholder: 'Smallholder',
};

function fmtMonth(ym: string): string {
  const [year, month] = ym.split('-');
  const names = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  return `${names[parseInt(month, 10) - 1]} ${year.slice(2)}`;
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-52 gap-3">
      <AlertCircle size={28} className="text-slate-300" />
      <p className="text-sm text-slate-400">{message}</p>
    </div>
  );
}

export default function ReportsPage() {
  return (
    <RoleGuard allowedRoles={['master_admin', 'admin']}>
      <ReportsContent />
    </RoleGuard>
  );
}

function ReportsContent() {
  const [millFilter, setMillFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');

  const { data: session } = authClient.useSession();
  const isMasterAdmin = (session?.user as any)?.role === 'master_admin';

  const { data: stats, isLoading } = useQuery({
    queryKey: ['stats'],
    queryFn: async () => {
      const res = await fetch('/api/stats');
      if (!res.ok) throw new Error('Failed to fetch analytics');
      return res.json();
    },
  });

  const { data: mills = [] } = useQuery({
    queryKey: ['mills'],
    queryFn: async () => {
      const res = await fetch('/api/mills');
      if (!res.ok) throw new Error('Failed to fetch mills');
      return res.json();
    },
  });

  const { data: years = [] } = useQuery({
    queryKey: ['years'],
    queryFn: async () => {
      const res = await fetch('/api/years');
      if (!res.ok) throw new Error('Failed to fetch years');
      return res.json();
    },
  });

  const buildExportUrl = (type: string) => {
    const params = new URLSearchParams({ type });
    if (millFilter !== 'all') params.set('millId', millFilter);
    if (yearFilter !== 'all') params.set('yearId', yearFilter);
    return `/api/export?${params.toString()}`;
  };

  const handleExport = async (type: string, label: string) => {
    try {
      toast.info(`Preparing ${label} export…`);
      const res = await fetch(buildExportUrl(type));
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Export failed');
      }
      const blob = await res.blob();
      // Use the server-supplied filename from Content-Disposition
      const disposition = res.headers.get('Content-Disposition') ?? '';
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match ? match[1] : `${type}.csv`;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success(`${label} exported successfully`);
    } catch (err: any) {
      toast.error(err.message || 'Export failed');
    }
  };

  // Chart data
  const pieData = (stats?.statusBreakdown ?? []).map((item: any) => ({
    name: item.status.replace('_', ' '),
    value: Number(item.count),
    color: STATUS_COLORS[item.status] ?? '#CBD5E1',
  }));

  const millBarData = (stats?.assessmentsByMill ?? [])
    .filter((m: any) => m.total > 0)
    .map((m: any) => ({
      name: m.mill_code || m.mill_name,
      Draft: m.draft,
      Submitted: m.submitted,
      'Under Review': m.under_review,
      Approved: m.approved,
      Reopened: m.reopened,
    }));

  const supplierPieData = (stats?.suppliersByType ?? []).map((s: any) => ({
    name: TYPE_LABELS[s.type] ?? s.type,
    value: Number(s.count),
    volume: Number(s.total_volume),
    color: TYPE_COLORS[s.type] ?? '#CBD5E1',
  }));

  const volumeBarData = (stats?.volumeByMill ?? [])
    .filter((m: any) => Number(m.total_volume) > 0)
    .map((m: any) => ({
      name: m.mill_code || m.mill_name,
      'Volume (MT)': Number(m.total_volume),
    }));

  const monthlyData = (stats?.monthlySubmissions ?? []).map((m: any) => ({
    month: fmtMonth(m.month),
    Submissions: m.count,
  }));

  const EXPORT_CARDS = [
    {
      type: 'assessments',
      label: 'TTP Data',
      description: 'All TTP data entries with mill, year, status, supplier count and timestamps',
      icon: ClipboardList,
      color: 'bg-blue-100 text-blue-600',
    },
    {
      type: 'suppliers',
      label: 'Suppliers',
      description: 'All suppliers with GPS coordinates, volume and assessment status',
      icon: Users,
      color: 'bg-emerald-100 text-emerald-600',
    },
    {
      type: 'dealers',
      label: 'Dealer Breakdown',
      description: 'Individual dealer/collection centre breakdown per supplier',
      icon: Factory,
      color: 'bg-purple-100 text-purple-600',
    },
    {
      type: 'evidence',
      label: 'Evidence Files',
      description: 'All uploaded evidence files with size and storage URL',
      icon: FileText,
      color: 'bg-amber-100 text-amber-600',
    },
    ...(isMasterAdmin
      ? [
          {
            type: 'audit_logs',
            label: 'Audit Logs',
            description: 'Full system audit trail — all user actions (master admin only)',
            icon: BarChart2,
            color: 'bg-red-100 text-red-600',
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#344E41]">Reports & Analytics</h2>
          <p className="text-slate-500 text-sm mt-0.5">Live data insights and CSV exports</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Select value={millFilter} onValueChange={setMillFilter}>
            <SelectTrigger className="w-44 border-slate-200 bg-white text-sm">
              <Factory className="h-3.5 w-3.5 mr-1.5 text-slate-400" />
              <SelectValue placeholder="All mills" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Mills</SelectItem>
              {(mills as any[]).map((m) => (
                <SelectItem key={m.id} value={m.id.toString()}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={yearFilter} onValueChange={setYearFilter}>
            <SelectTrigger className="w-36 border-slate-200 bg-white text-sm">
              <Filter className="h-3.5 w-3.5 mr-1.5 text-slate-400" />
              <SelectValue placeholder="All years" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Years</SelectItem>
              {(years as any[]).map((y) => (
                <SelectItem key={y.id} value={y.id.toString()}>
                  {y.year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          {
            label: 'Total TTP Data',
            value: stats?.total_assessments ?? 0,
            icon: ClipboardList,
            cls: 'text-blue-600',
            bg: 'bg-blue-100',
          },
          {
            label: 'Total Suppliers',
            value: stats?.total_suppliers ?? 0,
            icon: Users,
            cls: 'text-emerald-600',
            bg: 'bg-emerald-100',
          },
          {
            label: 'Evidence Files',
            value: stats?.total_evidence ?? 0,
            icon: FileText,
            cls: 'text-amber-600',
            bg: 'bg-amber-100',
          },
          {
            label: 'Active Mills',
            value: stats?.total_mills ?? 0,
            icon: Factory,
            cls: 'text-[#344E41]',
            bg: 'bg-[#344E41]/10',
          },
        ].map((s) => (
          <Card key={s.label} className="border border-slate-200 shadow-sm">
            <CardContent className="p-4">
              <div className={`${s.bg} w-9 h-9 rounded-xl flex items-center justify-center mb-3`}>
                <s.icon size={18} className={s.cls} />
              </div>
              <p className="text-2xl font-bold text-[#344E41]">{isLoading ? '—' : s.value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <Card className="lg:col-span-2 border border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-[#344E41]">Status Distribution</CardTitle>
            <CardDescription>TTP Data pipeline overview</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading || pieData.length === 0 ? (
              <EmptyChart message="No TTP data yet" />
            ) : (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={82}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {pieData.map((e: any, i: number) => (
                        <Cell key={i} fill={e.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: any) => [v, 'TTP Data']}
                      contentStyle={{
                        borderRadius: '8px',
                        border: '1px solid #E2E8F0',
                        fontSize: '12px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-x-3 gap-y-2 mt-2 justify-center">
                  {pieData.map((e: any) => (
                    <div key={e.name} className="flex items-center gap-1.5">
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: e.color }}
                      />
                      <span className="text-xs text-slate-500 capitalize">{e.name}</span>
                      <span className="text-xs font-bold text-slate-700">{e.value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3 border border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-[#344E41]">Monthly Submissions</CardTitle>
            <CardDescription>TTP Data submitted over the last 12 months</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading || monthlyData.length === 0 ? (
              <EmptyChart message="No submission history yet" />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={monthlyData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: '#94A3B8' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#94A3B8' }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid #E2E8F0',
                      fontSize: '12px',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="Submissions"
                    stroke="#588157"
                    strokeWidth={2.5}
                    dot={{ fill: '#344E41', r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-[#344E41]">TTP Data by Mill</CardTitle>
            <CardDescription>Stacked by status</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading || millBarData.length === 0 ? (
              <EmptyChart message="No TTP data yet" />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={millBarData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10, fill: '#94A3B8' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#94A3B8' }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid #E2E8F0',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="Approved" stackId="s" fill={STATUS_COLORS.approved} />
                  <Bar dataKey="Submitted" stackId="s" fill={STATUS_COLORS.submitted} />
                  <Bar dataKey="Under Review" stackId="s" fill={STATUS_COLORS.under_review} />
                  <Bar dataKey="Reopened" stackId="s" fill={STATUS_COLORS.reopened} />
                  <Bar
                    dataKey="Draft"
                    stackId="s"
                    fill={STATUS_COLORS.draft}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-[#344E41]">Suppliers by Type</CardTitle>
            <CardDescription>Count and total FFB volume per supplier type</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading || supplierPieData.length === 0 ? (
              <EmptyChart message="No supplier data yet" />
            ) : (
              <div className="flex flex-col gap-4">
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie
                      data={supplierPieData}
                      cx="50%"
                      cy="50%"
                      outerRadius={70}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {supplierPieData.map((e: any, i: number) => (
                        <Cell key={i} fill={e.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        borderRadius: '8px',
                        border: '1px solid #E2E8F0',
                        fontSize: '12px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  {supplierPieData.map((e: any) => (
                    <div key={e.name} className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-sm flex-shrink-0"
                        style={{ backgroundColor: e.color }}
                      />
                      <span className="text-xs text-slate-600 flex-1">{e.name}</span>
                      <span className="text-xs font-semibold text-slate-700">{e.value}</span>
                      <span className="text-xs text-slate-400 w-24 text-right">
                        {Number(e.volume).toFixed(1)} MT
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Volume by mill */}
      {volumeBarData.length > 0 && (
        <Card className="border border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-[#344E41]">Volume by Mill</CardTitle>
            <CardDescription>Total FFB volume (MT) per mill</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={volumeBarData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: '#94A3B8' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} tickLine={false} axisLine={false} />
                <Tooltip
                  formatter={(v: any) => [`${Number(v).toLocaleString()} MT`, 'Volume']}
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid #E2E8F0',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="Volume (MT)" fill="#588157" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Export cards */}
      <div>
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-[#344E41]">Data Exports</h3>
          <p className="text-sm text-slate-500 mt-0.5">
            Download CSV files — mill and year filters above are applied to scoped exports
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {EXPORT_CARDS.map((card) => (
            <Card
              key={card.type}
              className="border border-slate-200 shadow-sm hover:shadow-md transition-shadow"
            >
              <CardHeader className="pb-3 flex flex-row items-start gap-4">
                <div className={`${card.color} p-2.5 rounded-xl flex-shrink-0`}>
                  <card.icon size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-sm text-[#344E41]">{card.label}</CardTitle>
                  <CardDescription className="text-xs mt-1 leading-snug">
                    {card.description}
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <Button
                  className="w-full bg-[#344E41] hover:bg-[#3A5A40] text-sm h-9"
                  onClick={() => handleExport(card.type, card.label)}
                >
                  <Download className="mr-2 h-3.5 w-3.5" />
                  Export CSV
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
