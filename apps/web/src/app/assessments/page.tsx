'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Eye,
  FileEdit,
  CheckCircle,
  RotateCcw,
  Search,
  ClipboardCheck,
  Clock,
  Send,
  Filter,
  X,
  Users,
  FileText,
  Factory,
  MoreVertical,
} from 'lucide-react';
import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { authClient } from '@/lib/auth-client';
import Link from 'next/link';

const ALL_STATES = [
  'Johor',
  'Kedah',
  'Kelantan',
  'Melaka',
  'Negeri Sembilan',
  'Pahang',
  'Perak',
  'Perlis',
  'Penang',
  'Selangor',
  'Terengganu',
  'Sabah',
  'Sarawak',
  'Labuan',
  'Putrajaya',
  'Kuala Lumpur',
];

const SUPPLIER_TYPES = [
  { value: 'smallholder', label: 'Smallholder' },
  { value: 'dealer', label: 'Dealer' },
  { value: 'collection_centre', label: 'Collection Centre' },
  { value: 'estate', label: 'Estate' },
  { value: 'external_supplier', label: 'External Supplier' },
  { value: 'in_house', label: 'In-House Plantation' },
];

const CERT_STATUSES = [
  'RSPO',
  'MSPO',
  'ISCC',
  'RSPO + MSPO',
  'RSPO + ISCC',
  'MSPO + ISCC',
  'RSPO + MSPO + ISCC',
  'NONE',
];

const STATUS_CONFIG: Record<string, { label: string; cls: string; dot: string }> = {
  draft: { label: 'Draft', cls: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' },
  submitted: { label: 'Submitted', cls: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
  under_review: { label: 'Under Review', cls: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  reopened: { label: 'Reopened', cls: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500' },
  approved: { label: 'Approved', cls: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
};

const STATUS_TABS = ['all', 'draft', 'submitted', 'under_review', 'reopened', 'approved'];

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.cls}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function fmtDate(raw: string | null | undefined): string {
  if (!raw) return '—';
  return raw.replace('T', ' ').slice(0, 16);
}

export default function AssessmentList() {
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const [millFilter, setMillFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const [regionFilter, setRegionFilter] = useState('all');
  const [stateFilter, setStateFilter] = useState('all');
  const [supplierTypeFilter, setSupplierTypeFilter] = useState('all');
  const [certFilter, setCertFilter] = useState('all');

  const { data: session } = authClient.useSession();
  const userRole = (session?.user as any)?.role ?? '';
  const isAdmin = ['master_admin', 'admin'].includes(userRole);

  const { data: assessments = [], isLoading } = useQuery({
    queryKey: ['assessments', supplierTypeFilter, certFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (supplierTypeFilter !== 'all') params.set('supplierType', supplierTypeFilter);
      if (certFilter !== 'all') params.set('certificationStatus', certFilter);
      const url = `/api/assessments${params.toString() ? `?${params}` : ''}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch assessments');
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
    enabled: isAdmin,
  });

  const { data: years = [] } = useQuery({
    queryKey: ['years'],
    queryFn: async () => {
      const res = await fetch('/api/years');
      if (!res.ok) throw new Error('Failed to fetch years');
      return res.json();
    },
    enabled: isAdmin,
  });

  const createMutation = useMutation({
    mutationFn: async (body: any) => {
      const res = await fetch('/api/assessments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create assessment');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assessments'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      toast.success('TTP Data entry created');
      setIsCreateOpen(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await fetch('/api/assessments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update status');
      return data;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['assessments'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      const labels: Record<string, string> = {
        approved: 'TTP Data Approved',
        reopened: 'TTP Data Reopened',
        under_review: 'Moved to Under Review',
      };
      toast.success(labels[vars.status] ?? `Status updated to ${vars.status}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    createMutation.mutate(Object.fromEntries(fd.entries()));
  };

  const allList = assessments as any[];
  const counts = {
    all: allList.length,
    draft: allList.filter((a) => a.status === 'draft').length,
    submitted: allList.filter((a) => a.status === 'submitted').length,
    under_review: allList.filter((a) => a.status === 'under_review').length,
    approved: allList.filter((a) => a.status === 'approved').length,
    reopened: allList.filter((a) => a.status === 'reopened').length,
  };

  const EAST_SET = new Set(['Sabah', 'Sarawak', 'Labuan']);

  const filtered = allList.filter((a) => {
    const matchTab = activeTab === 'all' || a.status === activeTab;
    const matchSearch =
      !search ||
      a.mill_name?.toLowerCase().includes(search.toLowerCase()) ||
      a.mill_code?.toLowerCase().includes(search.toLowerCase());
    const matchMill = millFilter === 'all' || String(a.mill_id) === millFilter;
    const matchYear = yearFilter === 'all' || String(a.year_id) === yearFilter;
    const matchRegion =
      regionFilter === 'all' ||
      (regionFilter === 'east' ? EAST_SET.has(a.mill_state) : !EAST_SET.has(a.mill_state));
    const matchState = stateFilter === 'all' || a.mill_state === stateFilter;
    return matchTab && matchSearch && matchMill && matchYear && matchRegion && matchState;
  });

  const hasFilters =
    Boolean(search) ||
    millFilter !== 'all' ||
    yearFilter !== 'all' ||
    regionFilter !== 'all' ||
    stateFilter !== 'all' ||
    supplierTypeFilter !== 'all' ||
    certFilter !== 'all';

  const tabLabel = (tab: string) => {
    if (tab === 'all') return 'All';
    return STATUS_CONFIG[tab]?.label ?? tab;
  };

  const clearFilters = () => {
    setSearch('');
    setMillFilter('all');
    setYearFilter('all');
    setRegionFilter('all');
    setStateFilter('all');
    setSupplierTypeFilter('all');
    setCertFilter('all');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#344E41]">TTP Data</h2>
          <p className="text-slate-500 text-sm mt-0.5">
            Monitor and manage supplier TTP data submissions
          </p>
        </div>
        {isAdmin && (
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#344E41] hover:bg-[#3A5A40] shadow-sm self-start sm:self-auto">
                <Plus className="mr-2 h-4 w-4" />
                Create TTP Data
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-[#344E41]">Create New TTP Data Entry</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-slate-500 mt-1">
                Select a mill and TTP year to create a new draft TTP data entry.
              </p>
              <form onSubmit={handleCreate} className="space-y-4 mt-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Palm Oil Mill</label>
                  <Select name="mill_id" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose mill…" />
                    </SelectTrigger>
                    <SelectContent>
                      {(mills as any[]).map((m) => (
                        <SelectItem key={m.id} value={m.id.toString()}>
                          {m.name} <span className="text-slate-400 text-xs ml-1">({m.code})</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">TTP Year</label>
                  <Select name="year_id" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose year…" />
                    </SelectTrigger>
                    <SelectContent>
                      {(years as any[])
                        .filter((y) => y.status === 'active')
                        .map((y) => (
                          <SelectItem key={y.id} value={y.id.toString()}>
                            {y.year}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-3 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setIsCreateOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 bg-[#344E41] hover:bg-[#3A5A40]"
                    disabled={createMutation.isPending}
                  >
                    {createMutation.isPending ? 'Creating…' : 'Create TTP Data'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          {
            key: 'all',
            label: 'Total',
            icon: ClipboardCheck,
            cls: 'text-slate-600',
            bg: 'bg-slate-100',
          },
          {
            key: 'draft',
            label: 'Draft',
            icon: FileEdit,
            cls: 'text-slate-500',
            bg: 'bg-slate-100',
          },
          {
            key: 'submitted',
            label: 'Submitted',
            icon: Send,
            cls: 'text-blue-600',
            bg: 'bg-blue-100',
          },
          {
            key: 'under_review',
            label: 'In Review',
            icon: Clock,
            cls: 'text-amber-600',
            bg: 'bg-amber-100',
          },
          {
            key: 'approved',
            label: 'Approved',
            icon: CheckCircle,
            cls: 'text-emerald-600',
            bg: 'bg-emerald-100',
          },
          {
            key: 'reopened',
            label: 'Reopened',
            icon: RotateCcw,
            cls: 'text-orange-600',
            bg: 'bg-orange-100',
          },
        ].map((s) => {
          const count = counts[s.key as keyof typeof counts] ?? 0;
          const isActive = activeTab === s.key;
          return (
            <Card
              key={s.key}
              className={`border shadow-sm cursor-pointer transition-all ${isActive ? 'border-[#344E41] ring-1 ring-[#344E41]/20' : 'border-slate-200 hover:border-slate-300'}`}
              onClick={() => setActiveTab(s.key)}
            >
              <CardContent className="p-3">
                <div className={`${s.bg} w-7 h-7 rounded-lg flex items-center justify-center mb-2`}>
                  <s.icon size={14} className={s.cls} />
                </div>
                <p className="text-xl font-bold text-[#344E41]">{count}</p>
                <p className="text-xs text-slate-500">{s.label}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        {STATUS_TABS.map((tab) => {
          const count = counts[tab as keyof typeof counts] ?? 0;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                activeTab === tab
                  ? 'bg-[#344E41] text-white shadow-sm'
                  : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              {tabLabel(tab)}
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${activeTab === tab ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filters row (admin only) */}
      {isAdmin && (
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
          {/* Row 1: Search + Mill + Year */}
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
              <Input
                placeholder="Search by mill name or code…"
                className="pl-10 border-slate-200"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={millFilter} onValueChange={setMillFilter}>
              <SelectTrigger className="w-44 border-slate-200">
                <Factory className="h-3.5 w-3.5 mr-1 text-slate-400" />
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
              <SelectTrigger className="w-32 border-slate-200">
                <Filter className="h-3.5 w-3.5 mr-1 text-slate-400" />
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
          {/* Row 2: Region + State + Supplier Type + Cert Status + Clear */}
          <div className="flex flex-wrap gap-3 items-center">
            <Select
              value={regionFilter}
              onValueChange={(v) => {
                setRegionFilter(v);
                setStateFilter('all');
              }}
            >
              <SelectTrigger className="w-40 border-slate-200">
                <SelectValue placeholder="All Regions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Regions</SelectItem>
                <SelectItem value="east">East Malaysia</SelectItem>
                <SelectItem value="west">West Malaysia</SelectItem>
              </SelectContent>
            </Select>
            <Select value={stateFilter} onValueChange={setStateFilter}>
              <SelectTrigger className="w-44 border-slate-200">
                <SelectValue placeholder="All States" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All States</SelectItem>
                <SelectItem value="__hdr_west__" disabled>
                  — West Malaysia —
                </SelectItem>
                {ALL_STATES.filter((s) => !['Sabah', 'Sarawak', 'Labuan'].includes(s)).map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
                <SelectItem value="__hdr_east__" disabled>
                  — East Malaysia —
                </SelectItem>
                {['Sabah', 'Sarawak', 'Labuan'].map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={supplierTypeFilter} onValueChange={setSupplierTypeFilter}>
              <SelectTrigger className="w-44 border-slate-200">
                <SelectValue placeholder="All Supplier Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {SUPPLIER_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={certFilter} onValueChange={setCertFilter}>
              <SelectTrigger className="w-44 border-slate-200">
                <SelectValue placeholder="All Certifications" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Certifications</SelectItem>
                {CERT_STATUSES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="mr-1 h-3.5 w-3.5" /> Clear all
              </Button>
            )}
            <span className="text-xs text-slate-400 ml-auto">
              {filtered.length} of {counts.all} shown
            </span>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
            Loading assessments…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <ClipboardCheck size={32} className="text-slate-300" />
            <p className="text-sm text-slate-400">
              {hasFilters || activeTab !== 'all'
                ? 'No TTP data matches your filters'
                : 'No TTP data entries yet'}
            </p>
            {isAdmin && activeTab === 'all' && !hasFilters && (
              <Button size="sm" variant="outline" onClick={() => setIsCreateOpen(true)}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Create first TTP data entry
              </Button>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="font-semibold text-slate-600">Mill</TableHead>
                <TableHead className="font-semibold text-slate-600">Year</TableHead>
                <TableHead className="font-semibold text-slate-600">Status</TableHead>
                <TableHead className="font-semibold text-slate-600">Suppliers</TableHead>
                <TableHead className="font-semibold text-slate-600">Evidence</TableHead>
                <TableHead className="font-semibold text-slate-600">Submitted</TableHead>
                <TableHead className="text-right font-semibold text-slate-600">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((a: any) => {
                const canEdit = ['draft', 'reopened'].includes(a.status);
                const canApprove = isAdmin && a.status === 'submitted';
                const canReview = isAdmin && a.status === 'submitted';
                const canReopen = isAdmin && ['submitted', 'under_review'].includes(a.status);

                return (
                  <TableRow key={a.id} className="hover:bg-slate-50/80 transition-colors">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#344E41]/10 flex items-center justify-center flex-shrink-0">
                          <Factory size={14} className="text-[#344E41]" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-800 text-sm">{a.mill_name}</p>
                          <p className="text-xs text-slate-400 font-mono">{a.mill_code}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-bold text-[#344E41]">{a.year}</span>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={a.status} />
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-[#344E41]/8 text-[#344E41] font-medium">
                        <Users size={10} />
                        {a.supplier_count ?? 0}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-purple-50 text-purple-600 font-medium">
                        <FileText size={10} />
                        {a.evidence_count ?? 0}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-slate-400 tabular-nums">
                      {fmtDate(a.submitted_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                          className="h-8 border-slate-200 text-slate-600 hover:border-[#344E41] hover:text-[#344E41]"
                        >
                          <Link href={`/assessments/${a.id}`}>
                            {canEdit && !isAdmin ? (
                              <>
                                <FileEdit className="mr-1.5 h-3.5 w-3.5" />
                                Continue TTP Data
                              </>
                            ) : (
                              <>
                                <Eye className="mr-1.5 h-3.5 w-3.5" />
                                View
                              </>
                            )}
                          </Link>
                        </Button>

                        {(canApprove || canReview || canReopen) && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-400"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              {canReview && (
                                <DropdownMenuItem
                                  className="cursor-pointer"
                                  onClick={() =>
                                    statusMutation.mutate({ id: a.id, status: 'under_review' })
                                  }
                                >
                                  <Clock className="mr-2 h-4 w-4 text-amber-500" />
                                  Mark Under Review
                                </DropdownMenuItem>
                              )}
                              {canApprove && (
                                <DropdownMenuItem
                                  className="cursor-pointer"
                                  onClick={() =>
                                    statusMutation.mutate({ id: a.id, status: 'approved' })
                                  }
                                >
                                  <CheckCircle className="mr-2 h-4 w-4 text-emerald-500" />
                                  <span className="text-emerald-600 font-medium">Approve</span>
                                </DropdownMenuItem>
                              )}
                              {(canReview || canApprove) && canReopen && <DropdownMenuSeparator />}
                              {canReopen && (
                                <DropdownMenuItem
                                  className="cursor-pointer"
                                  onClick={() =>
                                    statusMutation.mutate({ id: a.id, status: 'reopened' })
                                  }
                                >
                                  <RotateCcw className="mr-2 h-4 w-4 text-orange-400" />
                                  <span className="text-orange-600">Reopen for Editing</span>
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        {filtered.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-100 bg-slate-50">
            <p className="text-xs text-slate-400">
              Showing {filtered.length} of {counts.all} assessment{counts.all !== 1 ? 's' : ''}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
