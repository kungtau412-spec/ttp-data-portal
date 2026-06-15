'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Edit,
  Calendar,
  CalendarDays,
  CheckCircle2,
  XCircle,
  ClipboardCheck,
  AlertTriangle,
  Lock,
  Unlock,
  MoreVertical,
  FileText,
  Link2,
  Link2Off,
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
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import RoleGuard from '@/components/role-guard';
import Link from 'next/link';

/** Format a raw ISO date string — purely string-based, no Date constructor */
function fmtDate(raw: string | null | undefined): string {
  if (!raw) return '—';
  const d = raw.split('T')[0];
  const parts = d.split('-');
  if (parts.length < 3) return d;
  const yr = parts[0];
  const mo = parseInt(parts[1], 10);
  const dy = parts[2];
  const months = [
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
  const monthName = months[mo - 1] ?? '?';
  return `${dy} ${monthName} ${yr}`;
}

/** Duration in days — pure arithmetic, no Date constructor */
function durationDays(start: string, end: string): number {
  const sp = start.split('T')[0].split('-').map(Number);
  const ep = end.split('T')[0].split('-').map(Number);
  if (sp.length < 3 || ep.length < 3) return 0;
  const s = sp[0] * 365 + sp[1] * 30 + sp[2];
  const e = ep[0] * 365 + ep[1] * 30 + ep[2];
  return Math.max(0, e - s);
}

export default function AssessmentYearManagement() {
  return (
    <RoleGuard allowedRoles={['master_admin']}>
      <AssessmentYearContent />
    </RoleGuard>
  );
}

function AssessmentYearContent() {
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingYear, setEditingYear] = useState<any>(null);

  const { data: years = [], isLoading } = useQuery({
    queryKey: ['years'],
    queryFn: async () => {
      const res = await fetch('/api/years');
      if (!res.ok) throw new Error('Failed to fetch assessment years');
      return res.json();
    },
  });

  // Fetch all published templates for the assignment dropdown
  const { data: publishedTemplates = [] } = useQuery({
    queryKey: ['templates-published'],
    queryFn: async () => {
      const res = await fetch('/api/templates?status=published');
      if (!res.ok) throw new Error('Failed to fetch templates');
      const data = await res.json();
      return (data.templates ?? []) as any[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (body: any) => {
      const res = await fetch('/api/years', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create year');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['years'] });
      toast.success('TTP year created');
      setIsCreateOpen(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: async (body: any) => {
      const res = await fetch('/api/years', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update year');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['years'] });
      queryClient.invalidateQueries({ queryKey: ['templates-published'] });
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      toast.success('TTP year updated');
      setEditingYear(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Standalone template-assignment mutation (no date/status fields required)
  const assignTemplateMutation = useMutation({
    mutationFn: async ({
      year_id,
      template_id,
    }: {
      year_id: number;
      template_id: number | null;
    }) => {
      const res = await fetch('/api/years', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: year_id, template_id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to assign template');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['years'] });
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      queryClient.invalidateQueries({ queryKey: ['templates-published'] });
      toast.success('Template assigned to year');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    createMutation.mutate(Object.fromEntries(fd.entries()));
  };

  const handleUpdate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const values = Object.fromEntries(fd.entries()) as any;
    // template_id is handled separately via assignTemplateMutation in the dialog
    updateMutation.mutate({ ...values, id: editingYear.id });
  };

  const quickToggleStatus = (year: any) => {
    const newStatus = year.status === 'active' ? 'closed' : 'active';
    updateMutation.mutate({
      id: year.id,
      start_date: year.start_date.split('T')[0],
      end_date: year.end_date.split('T')[0],
      status: newStatus,
      extension_reason: year.extension_reason,
    });
  };

  const totalYears = (years as any[]).length;
  const activeYears = (years as any[]).filter((y) => y.status === 'active').length;
  const closedYears = (years as any[]).filter((y) => y.status === 'closed').length;
  const totalAssessments = (years as any[]).reduce(
    (sum: number, y: any) => sum + Number(y.assessment_count || 0),
    0
  );

  const statCards = [
    {
      label: 'Total Years',
      value: totalYears,
      icon: CalendarDays,
      color: 'text-slate-600',
      bg: 'bg-slate-100',
    },
    {
      label: 'Active',
      value: activeYears,
      icon: CheckCircle2,
      color: 'text-emerald-600',
      bg: 'bg-emerald-100',
    },
    {
      label: 'Closed',
      value: closedYears,
      icon: XCircle,
      color: 'text-slate-500',
      bg: 'bg-slate-100',
    },
    {
      label: 'Linked TTP Data',
      value: totalAssessments,
      icon: ClipboardCheck,
      color: 'text-blue-600',
      bg: 'bg-blue-100',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#344E41]">TTP Years</h2>
          <p className="text-slate-500 text-sm mt-0.5">
            Define TTP data collection periods and assign templates per year
          </p>
        </div>

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#344E41] hover:bg-[#3A5A40] shadow-sm self-start sm:self-auto">
              <Plus className="mr-2 h-4 w-4" />
              Add Year
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-[#344E41]">Create TTP Year</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 mt-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">TTP Year</label>
                <Input
                  name="year"
                  type="number"
                  placeholder="e.g. 2025"
                  min="2000"
                  max="2100"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Start Date</label>
                  <Input name="start_date" type="date" required />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">End Date</label>
                  <Input name="end_date" type="date" required />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Initial Status</label>
                <Select name="status" defaultValue="active">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-3 pt-2">
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
                  {createMutation.isPending ? 'Creating…' : 'Create Year'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {statCards.map((s) => (
          <Card key={s.label} className="border border-slate-200 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`${s.bg} p-2 rounded-lg`}>
                <s.icon size={17} className={s.color} />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#344E41]">{s.value}</p>
                <p className="text-xs text-slate-500">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
            Loading TTP years…
          </div>
        ) : (years as any[]).length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <Calendar size={32} className="text-slate-300" />
            <p className="text-sm text-slate-400">No TTP years yet</p>
            <Button
              size="sm"
              variant="outline"
              className="mt-1"
              onClick={() => setIsCreateOpen(true)}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add first year
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="font-semibold text-slate-600">Year</TableHead>
                <TableHead className="font-semibold text-slate-600">Collection Period</TableHead>
                <TableHead className="font-semibold text-slate-600">Duration</TableHead>
                <TableHead className="font-semibold text-slate-600">Template</TableHead>
                <TableHead className="font-semibold text-slate-600">Assessments</TableHead>
                <TableHead className="font-semibold text-slate-600">Status</TableHead>
                <TableHead className="font-semibold text-slate-600">Extension Note</TableHead>
                <TableHead className="text-right font-semibold text-slate-600">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(years as any[]).map((y) => {
                const isActive = y.status === 'active';
                const duration = durationDays(y.start_date, y.end_date);
                const period = `${fmtDate(y.start_date)} → ${fmtDate(y.end_date)}`;
                const assignedTemplate = y.assigned_template ?? null;

                return (
                  <TableRow key={y.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Year */}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-lg bg-[#344E41]/10 flex items-center justify-center">
                          <CalendarDays size={16} className="text-[#344E41]" />
                        </div>
                        <span className="font-bold text-[#344E41] text-lg">{y.year}</span>
                      </div>
                    </TableCell>

                    {/* Period */}
                    <TableCell>
                      <p className="text-sm text-slate-600">{period}</p>
                    </TableCell>

                    {/* Duration */}
                    <TableCell>
                      <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-md">
                        ~{duration} days
                      </span>
                    </TableCell>

                    {/* Assigned Template */}
                    <TableCell>
                      {assignedTemplate ? (
                        <Link
                          href={`/templates/${assignedTemplate.id}`}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#344E41]/8 text-[#344E41] text-xs font-semibold hover:bg-[#344E41]/15 transition-colors"
                        >
                          <FileText size={11} />
                          {assignedTemplate.name}
                          <span className="text-[#344E41]/60 font-normal">
                            v{assignedTemplate.version_number}
                          </span>
                        </Link>
                      ) : (
                        <button
                          onClick={() => setEditingYear(y)}
                          className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-amber-600 transition-colors"
                        >
                          <AlertTriangle size={11} />
                          <span>No template</span>
                        </button>
                      )}
                    </TableCell>

                    {/* Assessment count */}
                    <TableCell>
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700">
                        <ClipboardCheck size={11} />
                        {y.assessment_count ?? 0}
                      </span>
                    </TableCell>

                    {/* Status */}
                    <TableCell>
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-slate-400'}`}
                        />
                        {isActive ? 'Active' : 'Closed'}
                      </span>
                    </TableCell>

                    {/* Extension note */}
                    <TableCell>
                      {y.extension_reason ? (
                        <div className="flex items-center gap-1.5 max-w-[160px]">
                          <AlertTriangle size={12} className="text-amber-400 flex-shrink-0" />
                          <span className="text-xs text-slate-500 truncate">
                            {y.extension_reason}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-300 text-xs">—</span>
                      )}
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-slate-400 hover:text-slate-600"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem
                            className="cursor-pointer"
                            onClick={() => setEditingYear(y)}
                          >
                            <Edit className="mr-2 h-4 w-4 text-slate-400" />
                            Edit Details
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="cursor-pointer"
                            onClick={() => quickToggleStatus(y)}
                          >
                            {isActive ? (
                              <>
                                <Lock className="mr-2 h-4 w-4 text-slate-400" />
                                <span className="text-slate-600">Close Year</span>
                              </>
                            ) : (
                              <>
                                <Unlock className="mr-2 h-4 w-4 text-emerald-500" />
                                <span className="text-emerald-600">Reopen Year</span>
                              </>
                            )}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        {(years as any[]).length > 0 && (
          <div className="px-4 py-3 border-t border-slate-100 bg-slate-50">
            <p className="text-xs text-slate-400">
              {totalYears} year{totalYears !== 1 ? 's' : ''} · {activeYears} active · {closedYears}{' '}
              closed
            </p>
          </div>
        )}
      </div>

      {/* Edit dialog */}
      {editingYear && (
        <Dialog open={!!editingYear} onOpenChange={() => setEditingYear(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-[#344E41]">Edit TTP Year {editingYear.year}</DialogTitle>
            </DialogHeader>

            {Number(editingYear.assessment_count) > 0 && (
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700 mt-2">
                <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                <span>
                  This year has{' '}
                  <strong>{editingYear.assessment_count} linked TTP data entry(ies)</strong>.
                  Closing it will prevent further submissions.
                </span>
              </div>
            )}

            <form onSubmit={handleUpdate} className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Start Date</label>
                  <Input
                    name="start_date"
                    type="date"
                    defaultValue={editingYear.start_date?.split('T')[0]}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">End Date</label>
                  <Input
                    name="end_date"
                    type="date"
                    defaultValue={editingYear.end_date?.split('T')[0]}
                    required
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Status</label>
                <Select name="status" defaultValue={editingYear.status}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">
                  Extension / Closing Note{' '}
                  <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <Textarea
                  name="extension_reason"
                  defaultValue={editingYear.extension_reason ?? ''}
                  placeholder="e.g. Extended due to data submission delays…"
                  rows={2}
                />
              </div>

              {/* ── Template Assignment ── */}
              <Separator />
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  Assigned Template
                  <span className="text-slate-400 font-normal ml-1">(published only)</span>
                </label>
                {publishedTemplates.length === 0 ? (
                  <p className="text-xs text-amber-600 flex items-center gap-1.5">
                    <AlertTriangle size={12} />
                    No published templates available. Publish a template first.
                  </p>
                ) : (
                  <div className="flex gap-2">
                    <Select
                      defaultValue={editingYear.assigned_template?.id?.toString() ?? 'none'}
                      onValueChange={(val) => {
                        const templateId = val === 'none' ? null : parseInt(val);
                        assignTemplateMutation.mutate({
                          year_id: editingYear.id,
                          template_id: templateId,
                        });
                      }}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select template…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">
                          <span className="text-slate-400">— No template assigned —</span>
                        </SelectItem>
                        {(publishedTemplates as any[]).map((t: any) => (
                          <SelectItem key={t.id} value={t.id.toString()}>
                            <span className="flex items-center gap-2">
                              <FileText size={12} className="text-[#344E41]" />
                              {t.name}
                              <span className="text-slate-400 text-xs">v{t.version_number}</span>
                              {t.year_id && t.year_id !== editingYear.id && (
                                <span className="text-amber-500 text-[10px]">
                                  (linked to another year)
                                </span>
                              )}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {editingYear.assigned_template && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-slate-400 hover:text-red-500 flex-shrink-0"
                        onClick={() =>
                          assignTemplateMutation.mutate({
                            year_id: editingYear.id,
                            template_id: null,
                          })
                        }
                        title="Remove template assignment"
                      >
                        <Link2Off size={16} />
                      </Button>
                    )}
                  </div>
                )}
                {editingYear.assigned_template && (
                  <p className="text-xs text-[#344E41] flex items-center gap-1">
                    <Link2 size={11} />
                    Currently:{' '}
                    <strong className="ml-0.5">{editingYear.assigned_template.name}</strong>
                    <span className="text-slate-400 ml-0.5">
                      v{editingYear.assigned_template.version_number}
                    </span>
                  </p>
                )}
                <p className="text-xs text-slate-400">
                  New assessments for year <strong>{editingYear.year}</strong> will automatically
                  use this template.
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setEditingYear(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-[#344E41] hover:bg-[#3A5A40]"
                  disabled={updateMutation.isPending}
                >
                  {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
