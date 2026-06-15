'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import {
  History,
  Search,
  X,
  Filter,
  Download,
  Shield,
  FileText,
  CheckCircle,
  RotateCcw,
  Trash2,
  LogIn,
  Upload,
  Edit,
  Plus,
  RefreshCw,
  ShieldOff,
  ShieldCheck,
  HardHat,
} from 'lucide-react';
import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import RoleGuard from '@/components/role-guard';
import { authClient } from '@/lib/auth-client';

function fmtTimestamp(raw: string | null | undefined): string {
  if (!raw) return '—';
  return raw.replace('T', ' ').slice(0, 19);
}

const ACTION_CONFIG: Record<string, { cls: string; icon: any; label: string }> = {
  create: { cls: 'bg-emerald-100 text-emerald-700', icon: Plus, label: 'Create' },
  edit: { cls: 'bg-blue-100 text-blue-700', icon: Edit, label: 'Edit' },
  delete: { cls: 'bg-red-100 text-red-700', icon: Trash2, label: 'Delete' },
  login: { cls: 'bg-slate-100 text-slate-600', icon: LogIn, label: 'Login' },
  logout: { cls: 'bg-slate-100 text-slate-600', icon: LogIn, label: 'Logout' },
  submit: { cls: 'bg-purple-100 text-purple-700', icon: FileText, label: 'Submit' },
  approve: { cls: 'bg-green-100 text-green-700', icon: CheckCircle, label: 'Approve' },
  reopen: { cls: 'bg-orange-100 text-orange-700', icon: RotateCcw, label: 'Reopen' },
  upload: { cls: 'bg-indigo-100 text-indigo-700', icon: Upload, label: 'Upload' },
  update: { cls: 'bg-cyan-100 text-cyan-700', icon: Edit, label: 'Update' },
  deactivate: { cls: 'bg-rose-100 text-rose-700', icon: Shield, label: 'Deactivate' },
  activate: { cls: 'bg-emerald-100 text-emerald-700', icon: CheckCircle, label: 'Activate' },
  lock: { cls: 'bg-red-100 text-red-700', icon: Shield, label: 'Lock' },
  unlock: { cls: 'bg-teal-100 text-teal-700', icon: CheckCircle, label: 'Unlock' },
  reset_password: { cls: 'bg-amber-100 text-amber-700', icon: Edit, label: 'Reset PW' },
  change_password: { cls: 'bg-violet-100 text-violet-700', icon: Shield, label: 'Change PW' },
};

const ALL_ACTIONS = Object.keys(ACTION_CONFIG);
const ALL_TARGETS = [
  'assessment',
  'supplier',
  'supplier_field',
  'mill',
  'user',
  'year',
  'evidence',
];
const PAGE_SIZES = [25, 50, 100, 200];

const ROLE_BADGE: Record<string, { cls: string; icon: any; label: string }> = {
  master_admin: { cls: 'bg-red-100 text-red-700', icon: ShieldCheck, label: 'Master Admin' },
  admin: { cls: 'bg-blue-100 text-blue-700', icon: Shield, label: 'Admin' },
  mill_user: { cls: 'bg-green-100 text-green-700', icon: HardHat, label: 'Mill User' },
};

export default function AuditLogs() {
  return (
    <RoleGuard allowedRoles={['master_admin', 'admin']}>
      <AuditLogContent />
    </RoleGuard>
  );
}

function AuditLogContent() {
  const { data: session } = authClient.useSession();
  const currentRole = (session?.user as any)?.role ?? '';
  const isAdmin = currentRole === 'admin';
  const isMasterAdmin = currentRole === 'master_admin';

  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [targetFilter, setTargetFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(1);

  const params = new URLSearchParams();
  if (actionFilter !== 'all') params.set('action', actionFilter);
  if (targetFilter !== 'all') params.set('target', targetFilter);
  if (roleFilter !== 'all') params.set('role', roleFilter);
  if (search) params.set('search', search);
  params.set('limit', '500');

  const {
    data: allLogs = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['audit-logs', actionFilter, targetFilter, roleFilter, search],
    queryFn: async () => {
      const qs = params.toString();
      const res = await fetch(`/api/audit-logs${qs ? `?${qs}` : ''}`);
      if (!res.ok) throw new Error('Failed to fetch audit logs');
      return res.json();
    },
  });

  const logs = allLogs as any[];
  const totalPages = Math.max(1, Math.ceil(logs.length / pageSize));
  const pagedLogs = logs.slice((page - 1) * pageSize, page * pageSize);

  const handleExport = async () => {
    try {
      toast.info('Preparing audit log export…');
      const res = await fetch('/api/export?type=audit_logs');
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Export failed');
      }
      const blob = await res.blob();
      // Use the server-supplied filename from Content-Disposition
      const disposition = res.headers.get('Content-Disposition') ?? '';
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match ? match[1] : 'audit_logs.csv';
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success('Audit logs exported');
    } catch (err: any) {
      toast.error(err.message || 'Export failed');
    }
  };

  const clearFilters = useCallback(() => {
    setSearch('');
    setActionFilter('all');
    setTargetFilter('all');
    setRoleFilter('all');
    setPage(1);
  }, []);

  const hasFilters =
    Boolean(search) || actionFilter !== 'all' || targetFilter !== 'all' || roleFilter !== 'all';

  // Action counts for summary chips
  const actionCounts = logs.reduce((acc: Record<string, number>, log: any) => {
    acc[log.action] = (acc[log.action] ?? 0) + 1;
    return acc;
  }, {});
  const topActions = Object.entries(actionCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  // Available role options for filter dropdown (admin cannot see master_admin)
  const availableRoles = isMasterAdmin
    ? ['master_admin', 'admin', 'mill_user']
    : ['admin', 'mill_user'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#344E41]/10 flex items-center justify-center">
              <Shield size={16} className="text-[#344E41]" />
            </div>
            <h2 className="text-2xl font-bold text-[#344E41]">Audit Logs</h2>
          </div>
          <p className="text-slate-500 text-sm mt-1">
            {isMasterAdmin
              ? 'Full system history — all roles visible'
              : 'System history — filtered to your permission level'}
          </p>
        </div>
        <div className="flex gap-2 self-start sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="border-slate-200 text-slate-500"
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Refresh
          </Button>
          <Button size="sm" className="bg-[#344E41] hover:bg-[#3A5A40]" onClick={handleExport}>
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Visibility scope banner — admin only */}
      {isAdmin && (
        <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">
          <ShieldOff size={16} className="flex-shrink-0 mt-0.5 text-blue-500" />
          <div>
            <p className="font-semibold">Filtered view — Admin access level</p>
            <p className="mt-0.5 text-blue-700 text-xs">
              Master Admin activities are not visible to Admin users. You can view Admin and Mill
              User activity only. This restriction also applies to CSV exports.
            </p>
          </div>
        </div>
      )}

      {/* Action summary chips */}
      {!isLoading && topActions.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          {topActions.map(([action, count]) => {
            const cfg = ACTION_CONFIG[action];
            if (!cfg) return null;
            const isActive = actionFilter === action;
            return (
              <button
                key={action}
                onClick={() => {
                  setActionFilter(isActive ? 'all' : action);
                  setPage(1);
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                  isActive
                    ? `${cfg.cls} border-current ring-1 ring-current/30`
                    : `${cfg.cls} border-transparent hover:border-current/30`
                }`}
              >
                <cfg.icon size={11} />
                {cfg.label}
                <span className="bg-black/10 px-1.5 py-0.5 rounded-full">{count}</span>
              </button>
            );
          })}
          <span className="text-xs text-slate-400 ml-1">{logs.length} total</span>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
          <Input
            placeholder="Search by user, target or details…"
            className="pl-10 border-slate-200"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* Performed-by-role filter */}
          <Select
            value={roleFilter}
            onValueChange={(v) => {
              setRoleFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-40 border-slate-200">
              <Shield className="h-3.5 w-3.5 mr-1 text-slate-400" />
              <SelectValue placeholder="All roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              {availableRoles.map((r) => (
                <SelectItem key={r} value={r}>
                  {ROLE_BADGE[r]?.label ?? r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={actionFilter}
            onValueChange={(v) => {
              setActionFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-40 border-slate-200">
              <Filter className="h-3.5 w-3.5 mr-1 text-slate-400" />
              <SelectValue placeholder="All actions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              {ALL_ACTIONS.map((a) => (
                <SelectItem key={a} value={a}>
                  {ACTION_CONFIG[a]?.label ?? a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={targetFilter}
            onValueChange={(v) => {
              setTargetFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-36 border-slate-200">
              <SelectValue placeholder="All targets" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Targets</SelectItem>
              {ALL_TARGETS.map((t) => (
                <SelectItem key={t} value={t} className="capitalize">
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={String(pageSize)}
            onValueChange={(v) => {
              setPageSize(Number(v));
              setPage(1);
            }}
          >
            <SelectTrigger className="w-28 border-slate-200">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n} / page
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasFilters && (
            <Button
              variant="ghost"
              size="icon"
              onClick={clearFilters}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
            Loading audit logs…
          </div>
        ) : pagedLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <History size={32} className="text-slate-300" />
            <p className="text-sm text-slate-400">
              {hasFilters ? 'No logs match your filters' : 'No audit logs yet'}
            </p>
            {hasFilters && (
              <Button size="sm" variant="outline" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="font-semibold text-slate-600 w-44">Timestamp</TableHead>
                <TableHead className="font-semibold text-slate-600 w-48">Performed By</TableHead>
                <TableHead className="font-semibold text-slate-600 w-28">Action</TableHead>
                <TableHead className="font-semibold text-slate-600 w-28">Target</TableHead>
                <TableHead className="font-semibold text-slate-600">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedLogs.map((log: any) => {
                const cfg = ACTION_CONFIG[log.action] ?? {
                  cls: 'bg-slate-100 text-slate-600',
                  icon: History,
                  label: log.action,
                };
                const roleBadge = ROLE_BADGE[log.user_role];
                const RoleIcon = roleBadge?.icon ?? Shield;
                return (
                  <TableRow key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    <TableCell className="text-xs text-slate-400 tabular-nums whitespace-nowrap font-mono">
                      {fmtTimestamp(log.created_at)}
                    </TableCell>
                    <TableCell>
                      <p className="text-sm font-medium text-slate-800">
                        {log.user_name || 'System'}
                      </p>
                      {log.user_email && <p className="text-xs text-slate-400">{log.user_email}</p>}
                      {roleBadge ? (
                        <span
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold mt-0.5 ${roleBadge.cls}`}
                        >
                          <RoleIcon size={9} />
                          {roleBadge.label}
                        </span>
                      ) : log.user_role ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold mt-0.5 bg-slate-100 text-slate-500">
                          {log.user_role.replace(/_/g, ' ')}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${cfg.cls}`}
                      >
                        <cfg.icon size={9} />
                        {cfg.label}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-medium text-slate-600 capitalize">
                        {log.target?.replace(/_/g, ' ') || '—'}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-slate-500 max-w-sm">
                      <span className="truncate block max-w-xs" title={log.details}>
                        {log.details || <span className="text-slate-300 italic">—</span>}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        {/* Pagination footer */}
        {logs.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
            <p className="text-xs text-slate-400">
              {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, logs.length)} of {logs.length}{' '}
              log{logs.length !== 1 ? 's' : ''}
              {hasFilters ? ' (filtered)' : ''}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs border-slate-200"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                ← Prev
              </Button>
              <span className="text-xs text-slate-500 tabular-nums">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs border-slate-200"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next →
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
