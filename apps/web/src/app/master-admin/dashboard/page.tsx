'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Factory,
  ClipboardCheck,
  CheckCircle,
  Clock,
  Users,
  TrendingUp,
  RefreshCw,
  AlertCircle,
  ShieldCheck,
  Eye,
  CalendarDays,
  FileSpreadsheet,
  History,
  Award,
  Filter,
  X,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { authClient } from '@/lib/auth-client';
import { useEffect, useState } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import RoleGuard from '@/components/role-guard';
import Link from 'next/link';

const STATUS_COLORS: Record<string, string> = {
  draft: '#94A3B8',
  submitted: '#60A5FA',
  under_review: '#FBBF24',
  reopened: '#F97316',
  approved: '#34D399',
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  under_review: 'Under Review',
  reopened: 'Reopened',
  approved: 'Approved',
};

const ACTION_STYLES: Record<string, { bg: string; text: string }> = {
  create: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  edit: { bg: 'bg-blue-100', text: 'text-blue-700' },
  delete: { bg: 'bg-red-100', text: 'text-red-700' },
  submit: { bg: 'bg-purple-100', text: 'text-purple-700' },
  approve: { bg: 'bg-green-100', text: 'text-green-700' },
  reopen: { bg: 'bg-orange-100', text: 'text-orange-700' },
  upload: { bg: 'bg-indigo-100', text: 'text-indigo-700' },
  state_change: { bg: 'bg-amber-100', text: 'text-amber-700' },
  region_change: { bg: 'bg-teal-100', text: 'text-teal-700' },
};

function formatDate(iso: string) {
  return iso.slice(0, 16).replace('T', ' ');
}

function MasterAdminDashboardContent() {
  const [greeting, setGreeting] = useState('Welcome');
  const [filterRegion, setFilterRegion] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterMillId, setFilterMillId] = useState('all');
  const [filterYearId, setFilterYearId] = useState('all');

  useEffect(() => {
    const h = new Date().getHours();
    if (h < 12) setGreeting('Good morning');
    else if (h < 17) setGreeting('Good afternoon');
    else setGreeting('Good evening');
  }, []);

  const { data: session } = authClient.useSession();
  const firstName = session?.user?.name?.split(' ')[0] || 'Admin';

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

  const { data: stats, isLoading } = useQuery({
    queryKey: ['stats', filterRegion, filterCategory, filterMillId, filterYearId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterRegion !== 'all') params.set('region', filterRegion);
      if (filterCategory !== 'all') params.set('category', filterCategory);
      if (filterMillId !== 'all') params.set('millId', filterMillId);
      if (filterYearId !== 'all') params.set('yearId', filterYearId);
      const qs = params.toString();
      const res = await fetch(`/api/stats${qs ? '?' + qs : ''}`);
      if (!res.ok) throw new Error('Failed to fetch stats');
      return res.json();
    },
  });

  const hasFilters =
    filterRegion !== 'all' ||
    filterCategory !== 'all' ||
    filterMillId !== 'all' ||
    filterYearId !== 'all';
  const clearFilters = () => {
    setFilterRegion('all');
    setFilterCategory('all');
    setFilterMillId('all');
    setFilterYearId('all');
  };

  const statCards = [
    {
      title: 'Total Mills',
      value: stats?.total_mills,
      icon: Factory,
      color: 'text-[#344E41]',
      bg: 'bg-[#344E41]/10',
    },
    {
      title: 'TTP Data',
      value: stats?.total_assessments,
      icon: ClipboardCheck,
      color: 'text-blue-600',
      bg: 'bg-blue-100',
    },
    {
      title: 'Submitted',
      value: stats?.submitted_assessments,
      icon: TrendingUp,
      color: 'text-purple-600',
      bg: 'bg-purple-100',
    },
    {
      title: 'Pending',
      value: stats?.pending_assessments,
      icon: Clock,
      color: 'text-amber-600',
      bg: 'bg-amber-100',
    },
    {
      title: 'Approved',
      value: stats?.approved_assessments,
      icon: CheckCircle,
      color: 'text-emerald-600',
      bg: 'bg-emerald-100',
    },
    {
      title: 'Suppliers',
      value: stats?.total_suppliers,
      icon: Users,
      color: 'text-indigo-600',
      bg: 'bg-indigo-100',
    },
  ];

  const pieData = (stats?.statusBreakdown || []).map((item: any) => ({
    name: STATUS_LABELS[item.status] || item.status,
    value: Number(item.count),
    color: STATUS_COLORS[item.status] || '#CBD5E1',
  }));

  const quickActions = [
    {
      label: 'Manage Users',
      href: '/users',
      icon: Users,
      cls: 'bg-blue-50 text-blue-700 hover:bg-blue-100',
    },
    {
      label: 'Manage Mills',
      href: '/mills',
      icon: Factory,
      cls: 'bg-[#344E41]/8 text-[#344E41] hover:bg-[#344E41]/15',
    },
    {
      label: 'TTP Data',
      href: '/assessments',
      icon: ClipboardCheck,
      cls: 'bg-purple-50 text-purple-700 hover:bg-purple-100',
    },
    {
      label: 'Reports',
      href: '/reports',
      icon: FileSpreadsheet,
      cls: 'bg-amber-50 text-amber-700 hover:bg-amber-100',
    },
    {
      label: 'TTP Years',
      href: '/years',
      icon: CalendarDays,
      cls: 'bg-teal-50 text-teal-700 hover:bg-teal-100',
    },
    {
      label: 'Audit Logs',
      href: '/audit-logs',
      icon: History,
      cls: 'bg-slate-50 text-slate-700 hover:bg-slate-100',
    },
  ];

  const REGIONAL_TYPE_LABELS: Record<string, string> = {
    in_house: 'In-House',
    external_supplier: 'External Supplier',
    smallholder: 'Smallholder',
    dealer: 'Dealer',
  };
  const REGIONAL_TYPES = ['in_house', 'external_supplier', 'smallholder', 'dealer'];
  const REGIONAL_TYPE_COLORS: Record<string, string> = {
    in_house: '#344E41',
    external_supplier: '#588157',
    smallholder: '#A3B18A',
    dealer: '#3A7D44',
  };

  const getBreakdownRow = (breakdown: any[], type: string) => {
    const row = (breakdown || []).find((r: any) => r.type === type);
    return { count: row?.count ?? 0, volume: Number(row?.total_volume ?? 0) };
  };

  const globalCategoryData = REGIONAL_TYPES.map((t) => {
    const row = (stats?.suppliersByType || []).find((r: any) => r.type === t);
    return {
      name: REGIONAL_TYPE_LABELS[t],
      count: row?.count ?? 0,
      volume: Number(row?.total_volume ?? 0),
    };
  });

  const eastBreakdown = stats?.regionalStats?.east?.breakdown ?? [];
  const westBreakdown = stats?.regionalStats?.west?.breakdown ?? [];

  const regionChartData = [
    {
      name: 'East Malaysia',
      suppliers: stats?.regionalStats?.east?.supplier_count ?? 0,
      volume: Number(stats?.regionalStats?.east?.total_volume ?? 0),
    },
    {
      name: 'West Malaysia',
      suppliers: stats?.regionalStats?.west?.supplier_count ?? 0,
      volume: Number(stats?.regionalStats?.west?.total_volume ?? 0),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck size={20} className="text-red-500" />
            <span className="text-xs font-bold uppercase tracking-widest text-red-500">
              Master Admin
            </span>
          </div>
          <h2 className="text-2xl font-bold text-[#344E41]">
            {greeting}, {firstName}
          </h2>
          <p className="text-slate-500 text-sm mt-1">Full system overview and control</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500 bg-white rounded-lg px-3 py-2 border border-slate-200 self-start sm:self-auto">
          <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
          System operational
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {isLoading
          ? [...Array(6)].map((_, i) => (
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
                  <div className="flex items-start justify-between mb-3">
                    <div className={`${stat.bg} p-2 rounded-lg`}>
                      <stat.icon size={18} className={stat.color} />
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-[#344E41] mb-0.5">{stat.value ?? 0}</div>
                  <p className="text-xs font-medium text-slate-500">{stat.title}</p>
                </CardContent>
              </Card>
            ))}
      </div>

      {/* ── Supplier Regional Summary ── */}
      {stats?.regionalStats && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">
              Supplier Regional Summary
            </span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          {/* Filter bar (Issue 8) */}
          <div className="flex flex-wrap gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium self-center">
              <Filter size={13} /> Filters:
            </div>
            <Select value={filterRegion} onValueChange={setFilterRegion}>
              <SelectTrigger className="h-8 w-36 text-xs border-slate-200 bg-white">
                <SelectValue placeholder="All Regions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Regions</SelectItem>
                <SelectItem value="east">East Malaysia</SelectItem>
                <SelectItem value="west">West Malaysia</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="h-8 w-40 text-xs border-slate-200 bg-white">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="smallholder">Smallholder</SelectItem>
                <SelectItem value="dealer">Dealer</SelectItem>
                <SelectItem value="external_supplier">External Supplier</SelectItem>
                <SelectItem value="in_house">In-House</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterMillId} onValueChange={setFilterMillId}>
              <SelectTrigger className="h-8 w-40 text-xs border-slate-200 bg-white">
                <SelectValue placeholder="All Mills" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Mills</SelectItem>
                {(mills as any[]).map((m: any) => (
                  <SelectItem key={m.id} value={m.id.toString()}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterYearId} onValueChange={setFilterYearId}>
              <SelectTrigger className="h-8 w-32 text-xs border-slate-200 bg-white">
                <SelectValue placeholder="All Years" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Years</SelectItem>
                {(years as any[]).map((y: any) => (
                  <SelectItem key={y.id} value={y.id.toString()}>
                    {y.year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-slate-500 px-2"
                onClick={clearFilters}
              >
                <X size={12} className="mr-1" /> Clear
              </Button>
            )}
          </div>

          {/* 6 summary cards (Issue 5) */}
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            {[
              {
                label: 'East Malaysia Mills',
                value: stats.regionalStats.east?.mill_count ?? 0,
                sub: 'Sabah · Sarawak · Labuan',
                cls: 'border-blue-200 bg-blue-50',
                val: 'text-blue-700',
                icon: Factory,
              },
              {
                label: 'West Malaysia Mills',
                value: stats.regionalStats.west?.mill_count ?? 0,
                sub: 'Peninsular Malaysia',
                cls: 'border-purple-200 bg-purple-50',
                val: 'text-purple-700',
                icon: Factory,
              },
              {
                label: 'East MY Suppliers',
                value: stats.regionalStats.east?.supplier_count ?? 0,
                sub: 'Active records',
                cls: 'border-blue-200 bg-blue-50',
                val: 'text-blue-700',
                icon: Users,
              },
              {
                label: 'West MY Suppliers',
                value: stats.regionalStats.west?.supplier_count ?? 0,
                sub: 'Active records',
                cls: 'border-purple-200 bg-purple-50',
                val: 'text-purple-700',
                icon: Users,
              },
              {
                label: 'East MY Volume',
                value: `${Number(stats.regionalStats.east?.total_volume ?? 0).toFixed(1)} MT`,
                sub: 'Total FFB',
                cls: 'border-blue-200 bg-blue-50',
                val: 'text-blue-700',
                icon: TrendingUp,
              },
              {
                label: 'West MY Volume',
                value: `${Number(stats.regionalStats.west?.total_volume ?? 0).toFixed(1)} MT`,
                sub: 'Total FFB',
                cls: 'border-purple-200 bg-purple-50',
                val: 'text-purple-700',
                icon: TrendingUp,
              },
            ].map((card) => (
              <Card key={card.label} className={`border ${card.cls} shadow-sm`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <p className="text-[11px] font-medium text-slate-500 leading-tight">
                      {card.label}
                    </p>
                    <card.icon size={13} className={`${card.val} flex-shrink-0`} />
                  </div>
                  <p className={`text-xl font-bold ${card.val}`}>{card.value}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{card.sub}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Breakdown tables: East | West */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[
              { label: 'East Malaysia', breakdown: eastBreakdown, hdr: 'bg-blue-100/60' },
              { label: 'West Malaysia', breakdown: westBreakdown, hdr: 'bg-purple-100/60' },
            ].map(({ label, breakdown, hdr }) => (
              <Card key={label} className="border border-slate-200 shadow-sm overflow-hidden">
                <CardHeader className={`pb-2 pt-4 px-4 ${hdr}`}>
                  <CardTitle className="text-sm font-semibold text-slate-700">
                    {label} — Supplier Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">
                          Category
                        </th>
                        <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500">
                          Suppliers
                        </th>
                        <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500">
                          Volume (MT)
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {REGIONAL_TYPES.map((t) => {
                        const row = getBreakdownRow(breakdown, t);
                        return (
                          <tr key={t} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span
                                  className="w-2 h-2 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: REGIONAL_TYPE_COLORS[t] }}
                                />
                                <span className="text-slate-700 font-medium text-xs">
                                  {REGIONAL_TYPE_LABELS[t]}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-slate-800 tabular-nums">
                              {row.count}
                            </td>
                            <td className="px-4 py-3 text-right text-slate-500 tabular-nums">
                              {row.volume.toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-slate-200 bg-slate-50">
                        <td className="px-4 py-2.5 text-xs font-bold text-slate-600">Total</td>
                        <td className="px-4 py-2.5 text-right text-xs font-bold text-slate-800 tabular-nums">
                          {REGIONAL_TYPES.reduce(
                            (s, t) => s + getBreakdownRow(breakdown, t).count,
                            0
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right text-xs font-bold text-slate-800 tabular-nums">
                          {REGIONAL_TYPES.reduce(
                            (s, t) => s + getBreakdownRow(breakdown, t).volume,
                            0
                          ).toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* 4 charts in 2×2 grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Chart 1: Supplier Count by Category */}
            <Card className="border border-slate-200 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-slate-700">
                  Supplier Count by Category
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart
                    data={globalCategoryData}
                    margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 10, fill: '#94A3B8' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#94A3B8' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      formatter={((v: any) => [v, 'Suppliers']) as any}
                      contentStyle={{
                        borderRadius: '8px',
                        border: '1px solid #E2E8F0',
                        fontSize: '11px',
                      }}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {globalCategoryData.map((_entry, idx) => (
                        <Cell
                          key={idx}
                          fill={REGIONAL_TYPE_COLORS[REGIONAL_TYPES[idx]] ?? '#94A3B8'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Chart 2: Supplier Volume by Category */}
            <Card className="border border-slate-200 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-slate-700">
                  Supplier Volume by Category (MT)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart
                    data={globalCategoryData}
                    margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 10, fill: '#94A3B8' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#94A3B8' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      formatter={((v: any) => [Number(v).toFixed(2) + ' MT', 'Volume']) as any}
                      contentStyle={{
                        borderRadius: '8px',
                        border: '1px solid #E2E8F0',
                        fontSize: '11px',
                      }}
                    />
                    <Bar dataKey="volume" radius={[4, 4, 0, 0]}>
                      {globalCategoryData.map((_entry, idx) => (
                        <Cell
                          key={idx}
                          fill={REGIONAL_TYPE_COLORS[REGIONAL_TYPES[idx]] ?? '#94A3B8'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Chart 3: Supplier Count by Region */}
            <Card className="border border-slate-200 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-slate-700">
                  Supplier Count by Region
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart
                    data={regionChartData}
                    margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 10, fill: '#94A3B8' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#94A3B8' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      formatter={((v: any) => [v, 'Suppliers']) as any}
                      contentStyle={{
                        borderRadius: '8px',
                        border: '1px solid #E2E8F0',
                        fontSize: '11px',
                      }}
                    />
                    <Bar dataKey="suppliers" radius={[4, 4, 0, 0]}>
                      <Cell fill="#3B82F6" />
                      <Cell fill="#8B5CF6" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Chart 4: Supplier Volume by Region */}
            <Card className="border border-slate-200 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-slate-700">
                  Supplier Volume by Region (MT)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart
                    data={regionChartData}
                    margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 10, fill: '#94A3B8' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#94A3B8' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      formatter={((v: any) => [Number(v).toFixed(2) + ' MT', 'Volume']) as any}
                      contentStyle={{
                        borderRadius: '8px',
                        border: '1px solid #E2E8F0',
                        fontSize: '11px',
                      }}
                    />
                    <Bar dataKey="volume" radius={[4, 4, 0, 0]}>
                      <Cell fill="#3B82F6" />
                      <Cell fill="#8B5CF6" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Chart + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <Card className="lg:col-span-2 border border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-[#344E41]">
              TTP Data Status
            </CardTitle>
            <p className="text-xs text-slate-400">Distribution overview</p>
          </CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-52 gap-3">
                <AlertCircle size={32} className="text-slate-300" />
                <p className="text-sm text-slate-400">No TTP data yet</p>
              </div>
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
                      {pieData.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: any) => [value, 'TTP Data']}
                      contentStyle={{
                        borderRadius: '8px',
                        border: '1px solid #E2E8F0',
                        fontSize: '12px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-x-3 gap-y-2 mt-2 justify-center">
                  {pieData.map((entry: any) => (
                    <div key={entry.name} className="flex items-center gap-1.5">
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: entry.color }}
                      />
                      <span className="text-xs text-slate-500">{entry.name}</span>
                      <span className="text-xs font-bold text-slate-700">{entry.value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3 border border-slate-200 shadow-sm">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base font-semibold text-[#344E41]">
                Recent Activity
              </CardTitle>
              <p className="text-xs text-slate-400 mt-0.5">Latest system actions</p>
            </div>
            <RefreshCw size={14} className="text-slate-300" />
          </CardHeader>
          <CardContent>
            {!stats?.recentActivity || stats.recentActivity.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-52 gap-3">
                <Eye size={32} className="text-slate-300" />
                <p className="text-sm text-slate-400">No activity recorded yet</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-52 overflow-y-auto">
                {stats.recentActivity.map((log: any, i: number) => {
                  const style = ACTION_STYLES[log.action] || {
                    bg: 'bg-slate-100',
                    text: 'text-slate-600',
                  };
                  return (
                    <div key={i} className="flex items-start gap-3">
                      <Badge
                        className={`${style.bg} ${style.text} border-0 text-[10px] font-semibold uppercase tracking-wide flex-shrink-0 mt-0.5`}
                      >
                        {log.action}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-700 truncate">
                          {log.details || log.target}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {log.user_name || 'System'}
                        </p>
                      </div>
                      <span className="text-[11px] text-slate-400 flex-shrink-0 tabular-nums">
                        {formatDate(log.created_at)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick actions */}
      <Card className="border border-slate-200 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold text-[#344E41]">Quick Actions</CardTitle>
          <p className="text-xs text-slate-400">Full system access</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {quickActions.map((action) => (
              <Link
                key={action.label}
                href={action.href}
                className={`flex flex-col items-center gap-2 rounded-xl p-4 transition text-center ${action.cls}`}
              >
                <action.icon size={20} className="flex-shrink-0" />
                <span className="text-xs font-medium">{action.label}</span>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* PART 5: Certification Dashboard */}
      <Card className="border border-slate-200 shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Award size={16} className="text-[#588157]" />
            <CardTitle className="text-base font-semibold text-[#344E41]">
              Certification Overview
            </CardTitle>
          </div>
          <p className="text-xs text-slate-400">Supplier certification status distribution</p>
        </CardHeader>
        <CardContent>
          {!stats?.certificationStats ? (
            <div className="flex items-center justify-center h-32 text-slate-400 text-sm">
              No supplier data yet
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Cert summary cards */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  {
                    label: 'RSPO',
                    count: stats.certificationStats.rspo_count,
                    volume: stats.certificationStats.rspo_volume,
                    color: 'bg-green-100 text-green-700',
                    dot: 'bg-green-500',
                  },
                  {
                    label: 'MSPO',
                    count: stats.certificationStats.mspo_count,
                    volume: stats.certificationStats.mspo_volume,
                    color: 'bg-blue-100 text-blue-700',
                    dot: 'bg-blue-500',
                  },
                  {
                    label: 'ISCC',
                    count: stats.certificationStats.iscc_count,
                    volume: stats.certificationStats.iscc_volume,
                    color: 'bg-purple-100 text-purple-700',
                    dot: 'bg-purple-500',
                  },
                  {
                    label: 'Non-Certified',
                    count: stats.certificationStats.none_count,
                    volume: stats.certificationStats.none_volume,
                    color: 'bg-slate-100 text-slate-600',
                    dot: 'bg-slate-400',
                  },
                ].map((cert) => {
                  const total = stats.certificationStats.total_certified_suppliers || 1;
                  const pct = total > 0 ? Math.round((cert.count / total) * 100) : 0;
                  return (
                    <div key={cert.label} className={`rounded-xl p-3 ${cert.color}`}>
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className={`w-2 h-2 rounded-full ${cert.dot}`} />
                        <span className="text-xs font-bold uppercase tracking-wide">
                          {cert.label}
                        </span>
                      </div>
                      <p className="text-2xl font-bold">{cert.count ?? 0}</p>
                      <p className="text-[10px] opacity-70 mt-0.5">
                        {pct}% · {Number(cert.volume || 0).toFixed(1)} MT
                      </p>
                    </div>
                  );
                })}
              </div>
              {/* Cert bar chart */}
              <div>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart
                    data={[
                      {
                        name: 'RSPO',
                        count: stats.certificationStats.rspo_count || 0,
                        volume: Number(stats.certificationStats.rspo_volume || 0),
                      },
                      {
                        name: 'MSPO',
                        count: stats.certificationStats.mspo_count || 0,
                        volume: Number(stats.certificationStats.mspo_volume || 0),
                      },
                      {
                        name: 'ISCC',
                        count: stats.certificationStats.iscc_count || 0,
                        volume: Number(stats.certificationStats.iscc_volume || 0),
                      },
                      {
                        name: 'None',
                        count: stats.certificationStats.none_count || 0,
                        volume: Number(stats.certificationStats.none_volume || 0),
                      },
                    ]}
                    margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fill: '#94A3B8' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#94A3B8' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      formatter={
                        ((value: any, name: string) => [
                          value,
                          name === 'count' ? 'Suppliers' : 'Volume (MT)',
                        ]) as any
                      }
                      contentStyle={{
                        borderRadius: '8px',
                        border: '1px solid #E2E8F0',
                        fontSize: '12px',
                      }}
                    />
                    <Bar dataKey="count" fill="#588157" radius={[4, 4, 0, 0]} name="count" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function MasterAdminDashboard() {
  return (
    <RoleGuard allowedRoles={['master_admin']}>
      <MasterAdminDashboardContent />
    </RoleGuard>
  );
}
